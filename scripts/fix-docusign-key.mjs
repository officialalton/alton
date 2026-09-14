#!/usr/bin/env node
// .env.local의 DOCUSIGN_PRIVATE_KEY 값을 자동으로 한 줄 형식으로 정리한다.
// - 여러 물리적 줄에 걸쳐 있던 PEM 블록을 \n 이스케이프된 한 줄로 합침
// - em-dash(—) 종료 마커를 표준 하이픈(-----) 마커로 교정
// - 원본은 .env.local.bak으로 백업
// 키 내용은 표준출력에 절대 출력하지 않는다(성공/실패 메시지만 출력).

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
let content;
try {
  content = readFileSync(envPath, "utf8");
} catch (e) {
  console.error("FAIL: .env.local을 읽을 수 없습니다:", e.message);
  process.exit(1);
}

const lines = content.split("\n");
const startIdx = lines.findIndex((l) => l.startsWith("DOCUSIGN_PRIVATE_KEY="));
if (startIdx === -1) {
  console.error("FAIL: DOCUSIGN_PRIVATE_KEY= 줄을 찾지 못했습니다.");
  process.exit(1);
}

// BEGIN 마커를 포함한 줄부터, END 마커(하이픈 또는 em-dash 버전)를 포함한 줄까지 모은다.
let endIdx = startIdx;
const hasEndMarker = (s) =>
  s.includes("END RSA PRIVATE KEY") || s.includes("END PRIVATE KEY");
if (!hasEndMarker(lines[startIdx])) {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (hasEndMarker(lines[i])) {
      endIdx = i;
      break;
    }
  }
}
if (endIdx === startIdx && !hasEndMarker(lines[startIdx])) {
  console.error("FAIL: END 마커를 찾지 못했습니다 — 값이 이미 한 줄인지, 형식이 다른지 확인 필요.");
  process.exit(1);
}

const block = lines.slice(startIdx, endIdx + 1).join("\n");

// DOCUSIGN_PRIVATE_KEY= 뒤의 실제 값 부분만 추출 (첫 줄은 "DOCUSIGN_PRIVATE_KEY=..." 형태)
const firstLineValue = lines[startIdx].slice("DOCUSIGN_PRIVATE_KEY=".length);
const restLines = lines.slice(startIdx + 1, endIdx + 1);
let rawValue = [firstLineValue, ...restLines].join("\n");

// 기존에 감싸져 있던 따옴표 제거
rawValue = rawValue.trim();
if (rawValue.startsWith('"')) rawValue = rawValue.slice(1);
if (rawValue.endsWith('"')) rawValue = rawValue.slice(0, -1);

// 이미 들어있는 리터럴 \n 은 실제 줄바꿈으로 정규화한 뒤, 전체를 다시 실제 줄 단위로 분해
const normalized = rawValue.replace(/\\n/g, "\n");

// em-dash 마커를 표준 하이픈 마커로 교정
const fixedMarkers = normalized
  .replace(/—+BEGIN RSA PRIVATE KEY—+/g, "-----BEGIN RSA PRIVATE KEY-----")
  .replace(/—+END RSA PRIVATE KEY—+/g, "-----END RSA PRIVATE KEY-----")
  .replace(/—+BEGIN PRIVATE KEY—+/g, "-----BEGIN PRIVATE KEY-----")
  .replace(/—+END PRIVATE KEY—+/g, "-----END PRIVATE KEY-----");

const pemLines = fixedMarkers
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

const singleLine = pemLines.join("\\n") + "\\n";

// PEM 유효성 검증 (내용은 출력하지 않음)
const restored = singleLine.replace(/\\n/g, "\n");
let valid = false;
try {
  const { createSign } = await import("node:crypto");
  const s = createSign("RSA-SHA256");
  s.update("format-check");
  s.sign(restored);
  valid = true;
} catch (e) {
  console.error("FAIL: 변환 후에도 유효한 PEM 개인키가 아닙니다 —", e.message);
  process.exit(1);
}

// 백업 후 교체
copyFileSync(envPath, envPath + ".bak");
const newLines = [
  ...lines.slice(0, startIdx),
  `DOCUSIGN_PRIVATE_KEY="${singleLine}"`,
  ...lines.slice(endIdx + 1),
];
writeFileSync(envPath, newLines.join("\n"));

console.log("OK: DOCUSIGN_PRIVATE_KEY를 한 줄 형식으로 정리했습니다.");
console.log("OK: Node crypto 서명 테스트 통과 — 유효한 PEM 개인키입니다.");
console.log("백업 파일: .env.local.bak (문제 없으면 나중에 삭제하세요)");
