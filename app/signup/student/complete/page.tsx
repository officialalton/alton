import { provisionFreeMemberAndRedirect } from "../actions";

/**
 * 2026-10-05 무료 학습 회원(S1) — 이메일은 확인했지만 프로비저닝 전에 이탈한 뒤 /login으로 들어온
 * 셀프 가입 대기자(login/actions.ts·post-auth·/login 페이지가 보낸다)를 위한 경유지. 바로 프로비저닝하고
 * /student로 보낸다. 표식이 없는 계정은 액션이 로그아웃+오류로 돌려보낸다.
 */
export default async function StudentSignupCompletePage() {
  await provisionFreeMemberAndRedirect();
  return null;
}
