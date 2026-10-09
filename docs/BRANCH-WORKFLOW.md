# 브랜치 분업 워크플로 (2026-09-18 확정)

## 왜 이 문서가 생겼나

2026-09-18 이전에는 여러 Claude 세션이 **같은 working tree를 공유**하며 동시에
작업했다. 이 때문에 실제 사고가 두 번 났다:

1. 마이그레이션이 비프로덕션(`worpsqwqgnspddnrtnvq`)에는 `db push --linked`로
   적용됐지만 파일이 git에는 커밋되지 않은 채 남는 사고가 **서로 다른 세션에서
   두 번** 발생(뒤늦게 발견·정리한 커밋 `599b468`, `6777fd6`). Supabase는
   마이그레이션을 파일 내용이 아니라 **버전 번호로만** 추적하므로, 이 상태에서
   다른 세션이 `git pull`/새 clone을 하면 "원격은 이미 적용됐다고 하는데 로컬엔
   파일이 없는" 상태가 되어 다음 `db push`가 무엇을 적용해야 하는지 알 수 없게
   된다.
2. 한 세션의 미커밋 변경 파일이 `git add -A`/`git add .`를 쓴 다른 세션의 커밋에
   같이 쓸려 들어갈 뻔한 near-miss(같은 working tree에 여러 세션의 손대지 않은
   파일이 동시에 널려 있었기 때문).

**해결 방향**: 기능마다 별도 git 브랜치 + 별도 세션으로 격리하고, "팀장/배포
담당" 역할의 조정 세션이 통합·마이그레이션 적용·배포를 전담한다. 이렇게 하면
한 세션의 미완료 상태가 다른 세션의 working tree에 섞일 수 없고, "누가 무엇을
언제 실제로 non-prod에 반영했는지"의 단일 진실 소스가 통합 세션 하나로 좁혀진다.

## 세션 시작 시 읽는 순서 (전체 문서를 통째로 읽지 않는다)

1. `CLAUDE.md`
2. `docs/CURRENT.md`
3. 이 문서(`docs/BRANCH-WORKFLOW.md`)
4. 조정(팀장) 세션이 이번에 준 기능 브리핑

날짜가 박힌 과거 상세 문서(`docs/2026-*-*.md` 다수)는 **역사 기록**이다. 위
순서로 시작한 뒤 필요할 때만(특정 정책의 원문 근거를 찾을 때 등) 검색한다.
세션 시작 시 통째로 읽지 않는다.

## 작업 위치 규칙 (2026-09-28 추가)

- 정본 clone `~/Developer/ALTON`(통합 브랜치, 조정 세션 전용) + 기능 worktree
  `~/Developer/ALTON-worktrees/<기능명>`. iCloud 경로의 옛 저장소·`.claude/worktrees/*`는
  폐기됐고 삭제된다(사유·격리 Supabase 스택 절차는 `CLAUDE.md` "작업 위치" 절).
- 로컬 Supabase 컨테이너는 worktree 간 공유되므로 `supabase db reset`은 **조정 세션만**
  실행한다. 기능 세션은 격리 스택(`CLAUDE.md` 참고)에서 DB 검증한다.

## 기능 세션(브랜치 담당)이 지켜야 하는 것

(a) **작업 시작 전 항상 확인**: `git branch --show-current`로 배정받은 기능
브랜치에 있는지 확인한다. `main`이나 통합 브랜치(`preview/m4-integration-verification`)
위에서 직접 코드를 고치지 않는다.

(b) **`git add -A` / `git add .` 금지**: 항상 파일을 경로로 지정해서 스테이징한다
(`git add app/foo.tsx supabase/migrations/2026....sql`). working tree가 다시
공유되는 사고가 나더라도, 경로를 명시하면 남의 미완료 파일을 실수로 쓸어 담을
수 없다.

(c) **커밋 직전 항상 확인**: `git diff --cached --name-only`를 실행해 나열된
파일 전부가 이번 작업에서 실제로 의도한 파일인지 확인한다. 낯선 파일이 하나라도
보이면 커밋을 멈추고 원인을 확인한다.

(d) **마이그레이션은 커밋하되, 직접 적용하지 않는다(기본값)**: DB 변경이
필요하면 마이그레이션 파일을 만들어 로컬 `supabase db reset`으로 검증하고, 그
파일을 **자기 브랜치 커밋에 반드시 포함**시킨다. 하지만 공유 non-prod
(`worpsqwqgnspddnrtnvq`)에 `db push --linked`로 **실제로 적용하는 것은 기본적으로
하지 않는다** — 이건 통합 시점에 조정(팀장) 세션이 한 번에 한다. 이렇게 해야
"지금 이 순간 non-prod에 실제로 뭐가 적용돼 있는가"의 단일 진실 소스가 조정
세션 하나로 유지된다. 조정 세션이 명시적으로 "이 마이그레이션을 지금 바로
`db push`해도 된다"고 지시한 경우에만 예외로 직접 적용한다.

(e) **작성했거나 손댄 마이그레이션 파일은 예외 없이 커밋한다**: `supabase/migrations/`
아래에 파일이 있다는 사실만으로 그것이 "이미 원격에 적용돼 있다"거나 "커밋 안 해도
안전하다"고 가정하지 않는다. 마이그레이션 파일을 새로 만들었거나 수정했다면,
작업을 "완료"로 보고하기 전에 **반드시 자기 브랜치에 그 파일을 커밋한다** —
이것이 오늘 두 번 발생한 "적용은 됐는데 커밋이 안 됨" 사고를 막는 유일한 방법이다.

(f) **작업 완료 보고**: 조정 세션에게 다음을 포함해 보고한다 — 브랜치 이름,
커밋 해시, 실행한 테스트와 결과, 적용이 필요한 마이그레이션 파일 목록(있다면).

## 조정(팀장/배포 담당) 세션이 하는 것

1. 각 기능 브랜치를 통합 브랜치(`preview/m4-integration-verification`, 또는
   지정된 브랜치)로 merge한다.
2. 여러 브랜치에서 온 마이그레이션 파일의 적용 순서(파일명 타임스탬프)를
   충돌 없이 조정한다.
3. 통합된 상태 기준으로 **한 번에** `npx supabase db push --linked`를 실행해
   대기 중인 마이그레이션 전부를 non-prod에 반영한다.
4. Preview에 배포(`vercel deploy`)하고 실제 동작을 검증한다.
5. 결과(merge된 브랜치 목록, 적용된 마이그레이션, Preview URL, 검증 결과)를
   제품 오너에게 보고한다.

## git/마이그레이션 동기화 점검 체크리스트 (조정 세션 전용 — 매번 실행)

이 체크리스트는 **모든 통합/배포 패스 시작 시**, 그리고 **모든 `vercel deploy`
Preview 배포 직전에** 예외 없이 실행한다("가끔"이 아니라 "매번"이다 — drift는
브랜치가 늘어날수록 값싸게 잡을 수 있는 지금 잡아야 나중에 안 커진다). 아래는
그대로 복사해서 실행하는 절차다.

```bash
# (a) 공유 working tree에 미커밋 파일이 있는지 전부 본다
git status --short

# (b) non-prod 마이그레이션 적용 상태에서 local/remote 불일치를 찾는다
#     — local에는 있는데 remote가 비어있거나(=아직 안 알려진 신규 파일일 수도,
#       또는 반대로 remote에는 있는데 local 파일이 없으면 그게 바로 오늘 두 번
#       발생한 "적용은 됐는데 커밋 안 됨" 패턴의 신호다.
npx supabase migration list --linked
# 출력의 각 행에서 "local"과 "remote" 값이 둘 다 있고 같은지 확인한다.
# 한쪽만 값이 있는 행이 있으면 즉시 (c)로 넘어가 원인을 좁힌다.

# (c) 디스크의 마이그레이션 파일마다 git에 커밋되어 있는지 교차 확인한다
for f in supabase/migrations/*.sql; do
  if [ -z "$(git log --oneline -- "$f")" ]; then
    echo "!! UNTRACKED IN GIT: $f"
  fi
done
```

- `(b)`에서 `remote`에 값이 있는데 대응하는 파일이 `(c)`에서 `UNTRACKED IN GIT`로
  나오면 — 이것이 정확히 오늘 커밋 `599b468`, `6777fd6`로 고친 사고 패턴이다.
  **즉시 그 파일을 커밋**하고(별도 정리 커밋으로), 원인이 된 세션/브랜치에
  같은 패턴이 더 있는지 확인한다.
- `(a)`에서 낯선 미커밋 파일이 나오면, 그 파일이 지금 작업 중인 브랜치가
  의도한 것인지 확인 후 커밋하거나, 다른 브랜치/세션 소유물이면 건드리지 않고
  해당 세션에 알린다.
- 이 세 단계를 통과하기 전에는 `vercel deploy`도, 다음 브랜치의 merge도 진행하지
  않는다.

## 격리 Supabase 스택 정리 안전 절차 (2026-10-08)

사고: 격리 스택 검증 후 `supabase/config.toml`을 원복한 상태에서 인자 없는 `supabase stop`을 실행해 **공유 스택(ALTON)** 이 내려갔다(데이터는 보존, 즉시 재기동). 재발 방지 규칙:

- 격리 스택은 `scripts/dev/isolated-stack.sh`로만 시작·정리한다. `start ALTON_<이름>` 은 config.toml 의 project_id·포트(+100)를 임시 변경하고 `tmp/isolated-stack.lock` 에 id 를 기록한 뒤 `supabase start`(마이그레이션 전부 처음부터 적용). `stop` 은 락의 id 를 `lib/dev/isolated-stack-guard.ts` 로 검사해 통과할 때만 `supabase stop --project-id <id> --no-backup` 을 실행하고 config 를 원복한다.
- 차단 조건: id 없음, 락 없음/불일치, id 가 `ALTON`(또는 `ALTON_<영숫자>` 형식이 아님), 대상 컨테이너에 `supabase_*_ALTON` 포함, 컨테이너가 대상 id 접미사가 아님, 포트가 54320~54329·54420~54429·54325 계열.
- **금지**: 인자 없는 `npx supabase stop`, `supabase stop --project-id ALTON`, 이름만으로 `docker rm`/`docker volume rm`. 컨테이너·볼륨을 직접 지울 때도 `docker ps -a` 로 이름 접미사(`_ALTON_<이름>`)를 확인한 것만 지운다.
- 공유 DB의 마이그레이션 적용 상태(예: 556 vs 566)는 이 절차에서 맞추지 않는다. 적용은 조정 세션 몫이다.

## config.toml 커밋 가드 (2026-10-09)
격리 스택 래퍼가 임시로 바꾼 `supabase/config.toml`(project_id `ALTON_*`, 545xx·546xx 포트)이 스택이 떠 있는 동안 `git add -A` 로 커밋되는 사고가 3번 있었다. 그래서:
- **훅**: `scripts/dev/isolated-stack.sh start` 가 **그 워크트리에만** `core.hooksPath`(워크트리 로컬 설정)를 `scripts/dev/hooks` 로 지정한다. pre-commit 이 `scripts/dev/check-config-toml.ts` 를 호출해 스테이징된 `supabase/config.toml` 의 project_id 가 `ALTON` 이 아니거나 포트가 공유 544xx 계열(54420~54429, smtp 54325) 밖이면 **커밋을 막는다**. `stop` 이 원래 `core.hooksPath` 를 복원한다.
- **의도된 수정만 예외**: 실제 repo config 를 일부러 고칠 때는 `ALLOW_CONFIG_TOML=1 CONFIG_TOML_NOTE="<작업 메모 8자 이상>" git commit …`. 표식만 있고 메모가 없으면 차단.
- **테스트**: `lib/dev/config-toml-guard.test.ts` 가 순수 함수(양성·음성)와 HEAD 의 `supabase/config.toml` 을 검사한다(격리 값이 커밋되면 vitest 가 실패).
- **스테이징 규칙(재확인)**: 스택이 떠 있는 동안에는 `git add -A`/`git commit -a` 금지 — 경로를 지정해 스테이징한다.
