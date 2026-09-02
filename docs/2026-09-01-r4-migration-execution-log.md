# R4 — 마이그레이션·구현 실행 로그

- 목적: R1/R2/R3 실행 로그와 동일한 형식. 장문 조사 내역은 복사하지 않고 핵심 결정·변경·검증·blocker만 기록한다.
- 상태: **완료(2026-09-01), 단 1건 blocker 있음(아래 "남은 blocker" 참고).** 최신 상태는 `docs/CURRENT.md` 참고.

## 완료된 것 (이전 세션에서 구현·로컬 검증 완료, 이번 세션은 커밋+실측만)

- 수업권·결제 스키마: `purchases`/`payment_attempts`/`entitlement_products`/`entitlement_product_versions`/`entitlement_grants`/`entitlement_ledger`(`20260921000000_r2_admin_google_link.sql`은 관리자 Google 연결, `20260922000000_r4_purchase_and_payment.sql`이 구매/결제 본체, `20260923000000_r4_purchase_receipts_lesson_type.sql`까지 로컬 DB 적용 완료 — 최신 마이그레이션 head).
- Stripe Checkout 세션 생성(`app/parent/purchase-actions.ts`)과 웹훅(`app/api/webhooks/stripe/route.ts`) — R4 entitlement 구매 플로우와 레거시 `credit_packages` 플로우를 신호로 분기, 서명 검증 fail-closed, `external_event_receipts(provider='stripe', event_id)` 멱등.
- 관리자 수업권 원장 UI(상품·공지·환불·정산·이전), 보호자 구매 UI(체크아웃·영수증·잔액), 관리자 Google 로그인(선생님 Google 로그인과 완전 분리된 별도 라우트/콜백), 계약 활성화 재시도 UI.
- 로컬 유닛 테스트 640/640(2026-09-01 이번 세션에서 재실행 확인, `npx vitest run`), E2E 34건(R4 신규 3건 `e2e/r4-admin-entitlement-ledger.spec.ts`/`e2e/r4-purchase-flow.spec.ts`/`e2e/r4-webhook-purchase-completion.spec.ts` 포함, 이전 세션에서 통과 확인됨 — 이번 세션은 재실행하지 않음, 아래 "다음에 할 일" 참고).

## 커밋 (이번 세션)

- `a50bf9c` — `test(r4): add E2E specs for entitlement ledger, purchase flow, webhook completion`(위 3개 e2e 스펙, 이전 세션에서 작성돼 미커밋 상태였던 것).
- `6007761` — `docs: add R4-era contract, research, and planning docs`(계약 문안 초안, 리서치 노트, 아키텍처/작업계획 문서 — R4 진행 중 누적된 것 중 R4와 직접 관련된 신규 파일만 커밋. `AGENTS.md`/`CLAUDE.md`/`README.md`/`docs/prompts/`/`docs/superpowers/`의 기존 수정분은 R4 범위와 무관한 별도 변경으로 판단해 이번 세션에서 커밋하지 않음 — 사용자 확인 필요).

## 실제 Stripe TEST 모드 검증 (2026-09-01)

키 확인: `.env.local`의 `STRIPE_SECRET_KEY`가 `sk_test_`로 시작함을 먼저 확인(라이브 키였다면 중단 예정) — 확인됨, 이하 전부 TEST 모드.

- **(a) 성공 결제**: `curl https://api.stripe.com/v1/payment_intents -u "$SK:" -d amount=5000 -d currency=usd -d payment_method=pm_card_visa -d confirm=true -d "automatic_payment_methods[enabled]=true" -d "automatic_payment_methods[allow_redirects]=never"` → `status: succeeded`(`pi_3UB2TaICtA5Uy7fu1UJiI9L9`). **통과.**
- **(b) 거절 결제**: 동일 호출을 `payment_method=pm_card_chargeDeclined`로 → `error.decline_code: generic_decline`. **통과.**
- **(c) 환불**: `curl https://api.stripe.com/v1/refunds -u "$SK:" -d payment_intent=pi_3UB2TaICtA5Uy7fu1UJiI9L9` → `status: succeeded, amount: 5000`(`re_3UB2TaICtA5Uy7fu1FfGrjJw`). **통과.**
- **(d) 중복 웹훅 배달(멱등성, 실제 로컬 라우트 코드 대상)**: Stripe CLI 미설치라 `e2e/r4-webhook-purchase-completion.spec.ts`와 동일한 HMAC 서명 방식(Node `crypto`, `t=<ts>,v1=<hmac-sha256 hex>`)으로 격리된 household/child/contract/purchase를 psql로 만든 뒤, 같은 `event.id`의 `checkout.session.completed` payload를 `http://localhost:3000/api/webhooks/stripe`(로컬 `npm run dev`)에 두 번 POST. 1차: `200 {"ok":true}`(payment_attempts 1건 생성, entitlement_grants 1건 생성, purchases.status→`succeeded`). 2차(같은 event.id 재배달): `200 {"ok":true,"skipped":"already processed"}`. 사후 DB 확인: `payment_attempts=1`(기대값과 일치), `entitlement_grants=1`(기대값과 일치) — **멱등성 통과.**
- **(e) 분쟁(chargeback) 이벤트**: 같은 방식으로 `charge.dispute.created`(payment_intent가 (d)에서 만든 구매를 가리킴)를 서명해 POST → `200 {"ok":true}`, 서버 로그에 `charge_dispute_created` 감사 로그(purchaseId 매칭 확인)까지는 정상. **그러나 사후 DB 확인 결과 `purchases.status`가 `disputed`로 바뀌지 않고 `succeeded`로 그대로 남아있음 — 실패.** 원인: `route.ts`의 해당 UPDATE가 `.eq("id", purchase.id)`만 있고 에러를 체크하지 않는데, `purchases.status` 컬럼이 `v3_payment_attempt_status` enum(`created/processing/succeeded/failed/cancelled/reconciliation_needed`)이라 `'disputed'`라는 값 자체가 존재하지 않아 UPDATE가 DB 레벨에서 조용히 실패함(`psql`로 직접 재현: `column ... does not exist`류가 아니라 enum 미매치로 UPDATE 자체가 no-op). `20260922000000_r4_purchase_and_payment.sql`의 설계 주석은 환불/분쟁 같은 파생 상태를 `purchases`에 별도 컬럼으로 두지 않고 `refund_requests`/`entitlement_ledger` 조인으로 계산하도록 의도했다고 밝히고 있어, 지금 `route.ts` 코드가 그 설계와 어긋난 상태로 남아있던 것으로 보임. **이번 세션에서 수정하지 않음** — enum에 값을 추가하는 것과 파생 상태를 조인으로 계산하도록 고치는 것 중 어느 쪽이 맞는 정책인지 결정이 필요해서다(`docs/CURRENT.md` blocker 참고).

검증에 사용한 로컬 환경: `supabase start`(정지 상태였던 것을 이번 세션에서 기동), `npm run dev`(포트 3000, `NEXT_PUBLIC_SITE_URL`은 3010으로 설정돼 있으나 웹훅은 로컬 라우트에 직접 POST하므로 무관). 검증용 household/child/purchase는 매번 새 UUID로 생성해 다른 데이터와 충돌하지 않으며, `purchases`/`payment_attempts`/`entitlement_grants`는 append-only 설계(INSERT-only 트리거·FK)라 삭제하지 않고 그대로 남김 — `external_event_receipts`만 검증 후 정리(FK 제약 없음).

## Vercel Preview 배포 (2026-09-01, 승인된 1회)

- `vercel`/`.vercel/project.json` 링크 확인(`officialalton`으로 이미 인증돼 있었음, `npx vercel whoami` → `officialalton`).
- `npx vercel deploy --yes`로 Preview 1회 배포(Production 아님, `--prod` 미사용) → `https://alton-a4rsis1hw-alton7.vercel.app`(READY, target: null = Preview).
- 브라우저로 직접 열면 Vercel Deployment Protection(SSO)에 막혀 Vercel 로그인 화면으로 리다이렉트됨 — 팀 배포 보호 설정을 끄는 것은 이번 세션 승인 범위 밖이라 건드리지 않음. 대신 `vercel curl`(CLI가 자동 발급하는 bypass 토큰 사용, 별도 설정 변경 없음)로 확인:
  - `GET /login` → `200`, 응답 HTML에 "관리자 — Google로 로그인" 버튼 텍스트 존재 확인.
  - `POST /api/webhooks/stripe` (서명 없이) → `500`(Preview 환경변수가 로컬과 다르거나 일부 미설정일 가능성 — 서명 검증 실패 시 기대값인 401이 아니라 500이 나온 것은 추가 조사 필요하지만, 이번 세션 범위(1회 Preview 배포로 R4 UI 도달 가능성 확인)를 벗어나 원인 규명은 하지 않음. 로컬 라우트의 서명 검증 자체는 위 (d)/(e)에서 이미 실측 검증됨).
- Playwright E2E를 Preview 대상으로 실행하려면 SSO 우회 토큰을 `baseURL`/헤더에 심는 별도 설정이 필요한데, 이는 "1회 배포로 도달 가능성만 확인" 범위를 넘어서는 추가 작업이라 이번 세션에서는 하지 않음(미완료로 기록).

## 관리자 Google 로그인 확인 (2026-09-01)

- 로컬 dev 서버(`/login`)에서 "관리자 — Google로 로그인" 버튼 존재는 스크린샷·accessibility tree로 확인됨.
- 버튼을 실제로 클릭해 Google OAuth 리디렉션까지 확인하는 것은 이번 세션의 브라우저 자동화로 완주하지 못함 — 여러 번 클릭을 시도했으나(좌표 클릭, ref 클릭 모두) 서버 로그(`/tmp/nextdev.log`)에 해당 서버 액션 요청 자체가 찍히지 않아 클릭이 등록되지 않은 것으로 보임(원인 미확정 — 도구/렌더링 문제로 추정, 재현 조사는 이번 세션 범위 밖).
- 대신 소스 코드로 로직 확인: `app/admin/google-link-actions.ts`의 `signInWithGoogleForAdmin()`은 `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "${siteUrl}/auth/admin-google-callback", queryParams: { prompt: "select_account" } } })`를 호출해 Supabase가 발급한 Google OAuth URL로 `redirect()`한다 — 선생님 흐름(`app/login/teacher-google-actions.ts`)과 완전히 분리된 별도 콜백(`/auth/admin-google-callback`)을 쓴다. 최종 관리자 승인은 콜백(`app/auth/admin-google-callback/route.ts`)이 `admin_google_identities` 연결 여부 + `role='admin'`을 대조해서 한다(콜드 Google 가입으로는 관리자 권한을 얻을 수 없는 구조).
- **실제 사람이 브라우저로 Google 계정에 로그인해 전체 플로우를 완주하는 것은 이번 세션이 할 수 없다** — 사용자의 실제 참여가 필요하다.

## 남은 blocker

- **`charge.dispute.created` → `purchases.status='disputed'` 갱신 실패**(위 (e) 참고). 실제로는 분쟁이 발생해도 구매가 계속 `succeeded`로 보임 — 결제 감사/환불 판단에 영향. 수정 방향(enum에 `disputed` 추가 vs. 파생 상태를 조인으로 계산하도록 `route.ts`/UI 수정) 결정 필요.
- 실제 세금 계산 서비스 미구현(`purchases.tax_minor` 수동/0), 실제 이메일 발송 미구현(가격 변경 공지는 `outbox`에서 멈춤) — 둘 다 정식 오픈 전 blocker로 이전 세션부터 알려진 상태, 이번 세션에서 다시 확인만 함(미착수).
- Vercel Preview에서 R4/관리자 Google 로그인 UI까지 Playwright로 완주하는 것, 관리자 Google 로그인 실제 완주 — 위 두 항목 모두 사람 참여 또는 추가 설정(SSO 우회 토큰 배선)이 필요해 미완료.

## 외부 변경·플래그 복원 상태 확인 (2026-09-01)

- `.env.local` 수정하지 않음(읽기만 함, git에도 커밋 안 됨 — gitignore 확인됨).
- 로컬 `supabase`(정지 상태였던 것을 기동) — 로컬 개발 인프라이며 운영 데이터 아님, 계속 실행 상태로 둠.
- 로컬 `npm run dev`(포트 3000) — 세션 종료 시 백그라운드 프로세스 정리 권장(아래 참고).
- Stripe: TEST 모드 API만 사용, 라이브 키·라이브 결제 없음. 만든 테스트 객체(PaymentIntent 2건, Refund 1건)는 Stripe TEST 대시보드에만 존재하며 별도 정리 불필요(TEST 모드 데이터).
- Vercel: Preview 배포 1건 생성(`alton-a4rsis1hw-alton7.vercel.app`), **Production 배포·Production 도메인은 전혀 건드리지 않음**. Deployment Protection 설정 자체를 끄지 않았고, `vercel curl`이 자동 발급한 bypass 토큰은 CLI 호출에만 쓰였다(코드/설정에 반영하지 않음).
- Workspace 관련 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`/`WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`는 이번 세션에서 전혀 다루지 않음(기본값 `false` 불변, R4 범위 아님).
