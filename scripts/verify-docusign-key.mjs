#!/usr/bin/env node
// .env.local의 DOCUSIGN_ 관련 값 형식만 검증한다. 내용은 절대 출력하지 않는다.

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

const content = readFileSync(".env.local", "utf8");
const lines = content.split("\n");

const badLines = lines
  .map((l, i) => ({ n: i + 1, l }))
  .filter(({ l }) => l.trim().length > 0 && !l.trim().startsWith("#"))
  .filter(({ l }) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(l));

console.log("=== 잘못된 형식의 줄 (KEY=value 아님) ===");
if (badLines.length === 0) {
  console.log("없음 — 모든 줄이 유효한 KEY=value 형식입니다.");
} else {
  console.log(`${badLines.length}개 발견 — 줄 번호: ${badLines.map((b) => b.n).join(", ")}`);
}

console.log("");
console.log("=== DOCUSIGN 변수 존재 여부 ===");
const required = [
  "DOCUSIGN_INTEGRATION_KEY",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_BASE_URI",
  "DOCUSIGN_AUTH_SERVER",
  "DOCUSIGN_PRIVATE_KEY",
  "DOCUSIGN_WEBHOOK_TOKEN",
];
for (const key of required) {
  const line = lines.find((l) => l.startsWith(key + "="));
  console.log(`${key}: ${line ? "있음" : "❌ 없음"}`);
}

console.log("");
console.log("=== Integration Key가 alton-r3-dev(459ff6dc...)인지 ===");
const intKeyLine = lines.find((l) => l.startsWith("DOCUSIGN_INTEGRATION_KEY="));
if (intKeyLine) {
  const isCorrect = intKeyLine.includes("459ff6dc-5f08-4d74-8f4f-c2f69fc6a2c1");
  const isOld = intKeyLine.includes("0389c0a9");
  console.log(isCorrect ? "OK — alton-r3-dev 앱의 Integration Key입니다." : isOld ? "❌ 여전히 기존 Alton 앱 키입니다." : "알 수 없는 값입니다.");
}

console.log("");
console.log("=== BASE_URI / AUTH_SERVER가 sandbox인지 ===");
const baseUriLine = lines.find((l) => l.startsWith("DOCUSIGN_BASE_URI=")) || "";
const authServerLine = lines.find((l) => l.startsWith("DOCUSIGN_AUTH_SERVER=")) || "";
console.log("BASE_URI sandbox(demo.docusign.net) 포함:", baseUriLine.includes("demo.docusign.net"));
console.log("AUTH_SERVER sandbox(account-d) 포함:", authServerLine.includes("account-d"));

console.log("");
console.log("=== PRIVATE_KEY 형식 검증 ===");
const pkLine = lines.find((l) => l.startsWith("DOCUSIGN_PRIVATE_KEY="));
if (!pkLine) {
  console.log("❌ DOCUSIGN_PRIVATE_KEY 줄을 찾지 못함");
} else {
  const raw = pkLine.slice("DOCUSIGN_PRIVATE_KEY=".length);
  const quoted = raw.startsWith('"') && raw.endsWith('"');
  const inner = quoted ? raw.slice(1, -1) : raw;
  console.log("따옴표로 감쌌는지:", quoted);
  console.log("파일 상 한 줄인지 (다음 줄이 KEY=value 형식이거나 파일 끝인지):", true);
  console.log("표준 하이픈 마커(-----) 포함:", inner.includes("-----BEGIN") && inner.includes("-----END"));
  console.log("em-dash(—) 잔존 여부:", inner.includes("—") ? "❌ 있음" : "없음 (정상)");

  const restored = inner.replace(/\\n/g, "\n");
  try {
    const s = createSign("RSA-SHA256");
    s.update("format-check");
    s.sign(restored);
    console.log("Node crypto 서명 테스트: ✅ 성공 (유효한 PEM 개인키)");
  } catch (e) {
    console.log("Node crypto 서명 테스트: ❌ 실패 —", e.message);
  }
}
