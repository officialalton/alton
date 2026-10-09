// 대학 진학 정보 DB Part 9 — 정보 수집 봇의 안전장치 + 최소 파서.
//
// 이 모듈은 순수 로직만 담는다("use server" 없음) — 실제 DB 읽기/쓰기는
// refresh-actions.ts에서 이 모듈의 함수를 호출해 수행한다. 그래야 SSRF 방지/robots.txt/
// 파싱 로직만 별도로 단위 테스트할 수 있다.

import { lookup as dnsLookup } from "node:dns/promises";

export const BOT_USER_AGENT =
  "AltonUniversityInfoBot/1.0 (+contact: engineering@alton.education; automated research crawler)";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 5000;

// --- SSRF 방지 --------------------------------------------------------------

/** IPv4 문자열이 private/loopback/link-local 대역인지. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true; // 파싱 실패는 안전하게 차단
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

/** IPv6 문자열이 loopback/link-local/ULA(fc00::/7) 대역인지(대략). */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 ULA
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — 안의 IPv4를 다시 검사.
    const v4 = normalized.split(":").pop() ?? "";
    if (v4.includes(".")) return isPrivateIPv4(v4);
  }
  return false;
}

export function isPrivateOrLoopbackIp(ip: string, family: 4 | 6): boolean {
  return family === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

export type UrlSafetyResult = { safe: true } | { safe: false; reason: string };

/**
 * URL의 스킴을 확인하고, 호스트를 실제 DNS 조회해서 나온 IP가 사설/루프백/링크로컬이면
 * 차단한다. 크롤러가 실제 요청을 보내기 직전에 항상 호출해야 한다(SSRF 방지).
 */
export async function checkUrlSafety(rawUrl: string): Promise<UrlSafetyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "URL을 파싱할 수 없습니다." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `허용되지 않는 스킴: ${parsed.protocol}` };
  }
  const hostname = parsed.hostname;
  // 호스트 자체가 IP 리터럴인 경우도 바로 검사.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && isPrivateIPv4(hostname)) {
    return { safe: false, reason: `사설/루프백 IP는 허용되지 않습니다: ${hostname}` };
  }
  if (hostname === "localhost") {
    return { safe: false, reason: "localhost는 허용되지 않습니다." };
  }
  try {
    const { address, family } = await dnsLookup(hostname);
    if (isPrivateOrLoopbackIp(address, family as 4 | 6)) {
      return { safe: false, reason: `DNS 조회 결과가 사설/루프백/링크로컬 IP입니다: ${hostname} -> ${address}` };
    }
  } catch {
    return { safe: false, reason: `DNS 조회 실패: ${hostname}` };
  }
  return { safe: true };
}

// --- robots.txt --------------------------------------------------------------

/** 아주 단순한 robots.txt 파서 — User-agent: * 그룹의 Disallow만 본다(충분히 보수적). */
export function isPathAllowedByRobots(robotsText: string, path: string): boolean {
  const lines = robotsText.split(/\r?\n/).map((l) => l.trim());
  let inWildcardGroup = false;
  let matchedAnyGroup = false;
  const disallows: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      inWildcardGroup = value === "*";
      if (inWildcardGroup) matchedAnyGroup = true;
      continue;
    }
    if (key === "disallow" && inWildcardGroup) {
      if (value) disallows.push(value);
    }
  }
  if (!matchedAnyGroup) return true; // 규칙 없음 = 허용
  return !disallows.some((rule) => path.startsWith(rule));
}

export async function fetchRobotsRules(origin: string): Promise<string> {
  try {
    const res = await fetch(new URL("/robots.txt", origin).toString(), {
      headers: { "User-Agent": BOT_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return ""; // robots.txt 없음/오류 = 규칙 없음으로 취급(허용)
    return await res.text();
  } catch {
    return "";
  }
}

// --- 동일 도메인 요청 간 지연 -------------------------------------------------

const lastRequestAtByHost = new Map<string, number>();

function randomDelayMs(): number {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

/** 같은 호스트로의 연속 요청 사이에 최소 지연을 보장한다. */
export async function politeDelay(hostname: string): Promise<void> {
  const last = lastRequestAtByHost.get(hostname);
  const now = Date.now();
  if (last != null) {
    const elapsed = now - last;
    const wanted = randomDelayMs();
    if (elapsed < wanted) {
      await new Promise((resolve) => setTimeout(resolve, wanted - elapsed));
    }
  }
  lastRequestAtByHost.set(hostname, Date.now());
}

// --- 실제 fetch(안전장치 전부 통과 후) ---------------------------------------

export type FetchOutcome =
  | { ok: true; contentType: string; body: string; isPdf: boolean }
  | { ok: false; reason: string };

/** 스킴/사설 IP/robots.txt를 전부 확인한 뒤에만 실제로 fetch한다. */
export async function safeFetch(rawUrl: string): Promise<FetchOutcome> {
  const safety = await checkUrlSafety(rawUrl);
  if (!safety.safe) return { ok: false, reason: safety.reason };

  const parsed = new URL(rawUrl);
  const robotsText = await fetchRobotsRules(parsed.origin);
  if (!isPathAllowedByRobots(robotsText, parsed.pathname)) {
    return { ok: false, reason: `robots.txt에 의해 접근이 금지된 경로입니다: ${parsed.pathname}` };
  }

  await politeDelay(parsed.hostname);

  let res: Response;
  try {
    res = await fetch(rawUrl, {
      headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, reason: `요청 실패: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
  }
  const contentType = res.headers.get("content-type") ?? "";
  const isPdf = contentType.includes("application/pdf") || parsed.pathname.toLowerCase().endsWith(".pdf");

  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (contentLength > MAX_RESPONSE_BYTES) {
    return { ok: false, reason: `응답 크기 초과(${contentLength} bytes)` };
  }

  if (isPdf) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      return { ok: false, reason: `응답 크기 초과(${buf.byteLength} bytes)` };
    }
    try {
      const text = await extractPdfText(buf);
      return { ok: true, contentType, body: text, isPdf: true };
    } catch (err) {
      return { ok: false, reason: `PDF 파싱 실패: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    return { ok: false, reason: `응답 크기 초과(${text.length} chars)` };
  }
  return { ok: true, contentType, body: text, isPdf: false };
}

/** pdfjs-dist(legacy build)로 최소한의 텍스트만 추출 — 레이아웃 복원은 하지 않는다. */
async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }
  const task = pdfjs.getDocument({ data, disableFontFace: true, verbosity: 0 });
  try {
    const doc = await task.promise;
    const chunks: string[] = [];
    const maxPages = Math.min(doc.numPages, 30); // 봇은 요약 추출만 하므로 앞쪽만
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      chunks.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    return chunks.join("\n");
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** HTML에서 사람이 읽는 본문 텍스트만 뽑는다 — 최소 구현(정규식으로 태그/스크립트 제거).
 * 200개교 규모로 갈 때 구조화 파싱이 필요해지면 jsdom 기반으로 교체(결정 필요 참고). */
export function extractHtmlText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

// --- 최소 필드 추출(휴리스틱) -------------------------------------------------
//
// 실제 200개교 규모의 구조화 파싱(각 대학 사이트마다 다른 HTML 구조)은 이번 세션
// 범위 밖이다(E 단계에서 재검토). 여기서는 "마감일" 관련 문구를 정규식으로 찾아
// 사람이 검토할 수 있는 근거 스니펫만 만든다 — 자동으로 확정값을 만들지 않는다.

export type DeadlineCandidate = { label: string; excerpt: string };

const DEADLINE_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "Early Decision", regex: /Early Decision[^.]{0,120}/gi },
  { label: "Early Action", regex: /Early Action[^.]{0,120}/gi },
  { label: "Regular Decision", regex: /Regular Decision[^.]{0,120}/gi },
];

export function extractDeadlineCandidates(text: string): DeadlineCandidate[] {
  const found: DeadlineCandidate[] = [];
  for (const { label, regex } of DEADLINE_PATTERNS) {
    const match = text.match(regex);
    if (match && match[0]) {
      found.push({ label, excerpt: match[0].trim().slice(0, 300) });
    }
  }
  return found;
}
