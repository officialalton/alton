// 배포 전 Stripe 환경 점검: node scripts/check-stripe-env.mjs  (환경변수만 읽는다. Stripe 호출 없음)
// STRIPE_MODE(live|test) 명시, 키 접두사와 일치, 웹훅 시크릿 존재, 자동 회수 플래그 상태 확인.
const key = process.env.STRIPE_SECRET_KEY ?? "";
const mode = process.env.STRIPE_MODE;
const problems = [];
const keyLive = /^(sk|rk)_live_/.test(key);
const keyTest = /^(sk|rk)_test_/.test(key);
if (!keyLive && !keyTest) problems.push("STRIPE_SECRET_KEY 가 없거나 sk_/rk_ live|test 형식이 아님");
if (mode !== "live" && mode !== "test") problems.push("STRIPE_MODE 는 live 또는 test 로 명시해야 함");
else if ((mode === "live") !== keyLive) problems.push(`STRIPE_MODE=${mode} 와 키 모드(${keyLive ? "live" : "test"}) 불일치`);
if (!(process.env.STRIPE_WEBHOOK_SECRET ?? "").startsWith("whsec_")) problems.push("STRIPE_WEBHOOK_SECRET(whsec_) 없음");
console.log(`mode=${mode ?? "(unset)"} key=${keyLive ? "live" : keyTest ? "test" : "?"} autoRevokeOnRefund=${process.env.STRIPE_AUTO_REVOKE_ON_REFUND === "true" ? "ON" : "off(default)"}`);
if (problems.length) {
  console.error(problems.map((p) => `FAIL: ${p}`).join("\n"));
  process.exit(1);
}
console.log("OK");
