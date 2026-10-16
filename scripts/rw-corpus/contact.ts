// CORPUS_CONTACT 검증 — User-Agent 헤더는 ASCII 만 허용(한글이 들어가면 fetch 가 ByteString 오류로 중단).
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PLACEHOLDER = /example\.(com|org|net)|본인|your|yourname|이메일|email@|test@|^<|>$/i;
export function validateContact(v: string | undefined): string | null {
  if (!v || !v.trim()) return "CORPUS_CONTACT 가 비어 있습니다. 실제 이메일 주소(영문·숫자)로 CORPUS_CONTACT 를 지정하세요. 예) CORPUS_CONTACT=name@gmail.com — 원천 사이트가 문제 시 연락할 수 있게 User-Agent 에 들어갑니다.";
  if (/[^\x20-\x7e]/.test(v)) return `CORPUS_CONTACT 에 한글 등 비ASCII 문자가 있습니다(값: ${v}). HTTP 헤더에는 영문·숫자만 쓸 수 있습니다. 실제 이메일 주소(영문·숫자)로 CORPUS_CONTACT 를 지정하세요.`;
  if (!EMAIL.test(v) || PLACEHOLDER.test(v)) return `CORPUS_CONTACT 가 실제 이메일 형식이 아니거나 예시 값입니다(값: ${v}). 실제 이메일 주소(영문·숫자)로 CORPUS_CONTACT 를 지정하세요.`;
  return null;
}
export function userAgent(contact: string): string {
  const err = validateContact(contact);
  if (err) throw new Error(err);
  return `ALTON-corpus-collector/0.1 (RW reading corpus; contact ${contact})`;
}
if (process.argv[1]?.endsWith("contact.ts")) { const e = validateContact(process.env.CORPUS_CONTACT); if (e) { console.error(e); process.exit(1); } }
