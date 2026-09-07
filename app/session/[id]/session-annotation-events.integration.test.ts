import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// R8 follow-up (2026-09-07) — session_annotation_events(append-only 이벤트 로그,
// supabase/migrations/20261223000000_r8_session_annotation_events.sql)를 로컬
// Postgres에 직접 psql로 검증한다(app/admin/trial-sessions-guardian-consent.
// integration.test.ts 등과 동일한 패턴 — RLS/트리거는 mocked 클라이언트로는
// 검증할 수 없다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 선생님 (seed)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 선생님 (seed, 무관한 제3자)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 관리자 (seed, role='admin')
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001"; // 지훈 household (seed)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(userId: string, sql: string): string {
  // set_config()를 SELECT로 부르면 그 반환값(userId)이 아래 실제 쿼리 결과 앞에
  // 섞여 출력된다(-t -A는 여러 statement의 결과를 그냥 이어붙인다) — DO 블록 안에서
  // PERFORM으로 호출해 출력 없이 세션 GUC만 설정한다.
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

let sessionId: string;
let contractId: string;
let enrollmentId: string;
let reservationId: string;

beforeAll(() => {
  contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  // 같은 선생님으로 반복 실행할 때 실제 예약과 겹치지 않도록 먼 미래 슬롯을 쓴다
  // (reservations_no_overlap 배타 제약).
  reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '500 days', now() + interval '500 days 1 hour', 'confirmed') returning id;`
  );
  sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
});

afterAll(() => {
  // session_annotation_events는 실제로 append-only(트리거로 UPDATE/DELETE 전면
  // 차단)이므로, 테스트 fixture 정리에는 이 마이그레이션이 정의한 bypass GUC를
  // 명시적으로 써야 한다(app/admin 등 어떤 앱 코드도 이 GUC를 켤 수 없음 — RLS/권한
  // grant 대상이 아니라 superuser가 직접 psql로만 설정 가능).
  psql(`
    set app.bypass_annotation_lock = 'true';
    delete from session_annotation_events where session_id = '${sessionId}';
    delete from sessions where id = '${sessionId}';
    delete from reservations where id = '${reservationId}';
    delete from subject_enrollments where id = '${enrollmentId}';
    delete from contracts where id = '${contractId}';
  `);
});

function insertStroke(actorId: string, seqLabel: string) {
  return asUser(
    actorId,
    `insert into session_annotation_events (session_id, author_id, event_type, payload)
     values ('${sessionId}', '${actorId}', 'stroke', '{"x0":0.1,"y0":0.1,"x1":0.2,"y1":0.2,"color":"#1A1A1A","tool":"pen","label":"${seqLabel}"}'::jsonb)
     returning seq;`
  );
}

describe("session_annotation_events — append/replay (실제 DB)", () => {
  it("학생과 선생님이 각각 stroke를 기록하면 append-only로 쌓이고 seq로 재생 순서를 복원할 수 있다", () => {
    const seq1 = insertStroke(STUDENT_ID, "s1");
    const seq2 = insertStroke(TEACHER_ID, "t1");
    const seq3 = insertStroke(STUDENT_ID, "s2");

    // 재생(replay): session_id로 필터링해 seq 오름차순 정렬하면 실제 기록 순서가 그대로 나온다.
    const rows = asUser(
      TEACHER_ID,
      `select payload->>'label' from session_annotation_events where session_id = '${sessionId}' order by seq asc;`
    );
    expect(rows.split("\n")).toEqual(["s1", "t1", "s2"]);
    expect([seq1, seq2, seq3].map(Number)).toEqual([...[seq1, seq2, seq3].map(Number)].sort((a, b) => a - b));
  });

  it("동시(같은 트랜잭션 타임스탬프)에 여러 stroke가 들어와도 seq가 유일한 전체 순서를 보장한다", () => {
    // 여러 insert를 한 트랜잭션/한 psql 호출로 보내 동시성에 가까운 상황을 흉내낸다 —
    // 클라이언트 타임스탬프가 아니라 DB가 부여하는 seq만으로 순서가 결정됨을 검증.
    const out = asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload)
       select '${sessionId}', '${STUDENT_ID}', 'stroke', jsonb_build_object('label', 'race-' || g)
       from generate_series(1, 5) g
       returning seq;`
    );
    const seqs = out.split("\n").map(Number);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted); // insert 순서 == seq 순서 (단조 증가, 중복 없음)
    expect(new Set(seqs).size).toBe(5);
  });

  it("clear_all은 삭제가 아니라 이벤트로 기록되고, 이전 stroke는 그대로 남는다", () => {
    const beforeCount = Number(
      asUser(TEACHER_ID, `select count(*) from session_annotation_events where session_id = '${sessionId}';`)
    );

    asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload)
       values ('${sessionId}', '${TEACHER_ID}', 'clear_all', '{}'::jsonb);`
    );

    const afterCount = Number(
      asUser(TEACHER_ID, `select count(*) from session_annotation_events where session_id = '${sessionId}';`)
    );
    expect(afterCount).toBe(beforeCount + 1);

    const lastType = asUser(
      TEACHER_ID,
      `select event_type from session_annotation_events where session_id = '${sessionId}' order by seq desc limit 1;`
    );
    expect(lastType).toBe("clear_all");
  });

  it("학생/보호자는 clear_all을 기록할 수 없다(RLS로 fail-closed 차단)", () => {
    expect(() =>
      asUser(
        STUDENT_ID,
        `insert into session_annotation_events (session_id, author_id, event_type, payload)
         values ('${sessionId}', '${STUDENT_ID}', 'clear_all', '{}'::jsonb);`
      )
    ).toThrow(/row-level security|policy/i);
  });

  // R9 corrective(Defect 2) — 정책은 "clear_all은 선생님 또는 관리자"인데 UI(canClearAll)가
  // teacher만 허용해 admin이 버튼을 볼 수 없었다. DB(RLS)는 b4fd788에서 이미
  // `is_session_teacher_v3(session_id) or is_admin()`로 admin을 포함하고 있었으므로
  // 여기서는 그 사실을 role matrix로 명시적으로 고정한다 — {student, teacher, admin} ×
  // clear_all 시도 결과가 UI 가시성(ScratchpadTab.test.tsx)과 정확히 일치해야 한다.
  describe("clear_all 권한 role matrix — {student, teacher, admin} (실제 DB, UI 가시성과 일치해야 함)", () => {
    it("teacher는 clear_all을 기록할 수 있다(UI에서도 버튼 노출)", () => {
      expect(() =>
        asUser(
          TEACHER_ID,
          `insert into session_annotation_events (session_id, author_id, event_type, payload)
           values ('${sessionId}', '${TEACHER_ID}', 'clear_all', '{}'::jsonb);`
        )
      ).not.toThrow();
    });

    it("admin은 clear_all을 기록할 수 있다(UI에서도 버튼 노출 — 이번 수정 대상)", () => {
      expect(() =>
        asUser(
          ADMIN_ID,
          `insert into session_annotation_events (session_id, author_id, event_type, payload)
           values ('${sessionId}', '${ADMIN_ID}', 'clear_all', '{}'::jsonb);`
        )
      ).not.toThrow();
    });

    it("student는 clear_all을 기록할 수 없다(UI에서도 버튼 비노출)", () => {
      expect(() =>
        asUser(
          STUDENT_ID,
          `insert into session_annotation_events (session_id, author_id, event_type, payload)
           values ('${sessionId}', '${STUDENT_ID}', 'clear_all', '{}'::jsonb);`
        )
      ).toThrow(/row-level security|policy/i);
    });
  });

  it("세션과 무관한 제3자 선생님은 이 세션에 stroke조차 기록할 수 없다", () => {
    expect(() =>
      asUser(
        OTHER_TEACHER_ID,
        `insert into session_annotation_events (session_id, author_id, event_type, payload)
         values ('${sessionId}', '${OTHER_TEACHER_ID}', 'stroke', '{}'::jsonb);`
      )
    ).toThrow(/row-level security|policy/i);
  });

  it("author_id를 자기 자신이 아닌 값으로 위조해 기록할 수 없다", () => {
    expect(() =>
      asUser(
        STUDENT_ID,
        `insert into session_annotation_events (session_id, author_id, event_type, payload)
         values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb);`
      )
    ).toThrow(/row-level security|policy/i);
  });

  // R9 corrective(최종 라운드, 2026-09-07) — append_stroke_events(uuid, jsonb) RPC
  // (supabase/migrations/20261227000000_r9_atomic_append_stroke_events.sql)를 실제
  // DB로 검증한다: 순서 보존, 원자적 all-or-nothing(부분 실패 시 0건 잔존).
  describe("append_stroke_events RPC — 스트로크 전체를 단일 호출로 원자적 append", () => {
    function callAppend(actorId: string, segmentsJson: string): string {
      return asUser(
        actorId,
        `select payload->>'label' from append_stroke_events('${sessionId}'::uuid, '${segmentsJson}'::jsonb) order by seq asc;`
      );
    }

    function countForSession(): number {
      return Number(
        asUser(
          TEACHER_ID,
          `select count(*) from session_annotation_events where session_id = '${sessionId}';`
        )
      );
    }

    it("여러 세그먼트를 한 번에 보내면 입력 순서 그대로 seq 오름차순으로 append된다(순서 보존)", () => {
      const before = countForSession();
      const segments = JSON.stringify([
        { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#1A1A1A", tool: "pen", label: "seg-a" },
        { x0: 0.2, y0: 0.2, x1: 0.3, y1: 0.1, color: "#1A1A1A", tool: "pen", label: "seg-b" },
        { x0: 0.3, y0: 0.1, x1: 0.15, y1: 0.25, color: "#1A1A1A", tool: "pen", label: "seg-c" },
      ]).replace(/'/g, "''");

      const rows = callAppend(TEACHER_ID, segments);
      expect(rows.split("\n")).toEqual(["seg-a", "seg-b", "seg-c"]);

      // replay 경로(seq 오름차순 전체 조회)로도 같은 순서가 그대로 재구성됨을 확인 —
      // SSR/mount replay와 두 번째 클라이언트의 realtime 재구성이 동일한 경로를
      // 타므로, 이 select 하나로 두 경로 모두를 대표해서 검증한다.
      const replayed = asUser(
        TEACHER_ID,
        `select payload->>'label' from session_annotation_events where session_id = '${sessionId}' and payload->>'label' like 'seg-%' order by seq asc;`
      );
      expect(replayed.split("\n")).toEqual(["seg-a", "seg-b", "seg-c"]);
      expect(countForSession()).toBe(before + 3);
    });

    it("부분 실패 시(중간 세그먼트 payload 모양이 깨짐) 전체가 롤백되어 0건도 저장되지 않는다(원자성)", () => {
      const before = countForSession();
      // 5개 중 3번째(atomic-c)가 필수 필드(tool)를 빠뜨려 함수 내부 검증에서
      // exception이 발생한다 — 앞서 이미 만들어졌을 atomic-a/atomic-b를 포함해
      // 이 호출 전체(하나의 트랜잭션)가 롤백되어야 한다.
      const segments = JSON.stringify([
        { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#1A1A1A", tool: "pen", label: "atomic-a" },
        { x0: 0.2, y0: 0.2, x1: 0.3, y1: 0.1, color: "#1A1A1A", tool: "pen", label: "atomic-b" },
        { x0: 0.3, y0: 0.1, x1: 0.15, y1: 0.25, color: "#1A1A1A", label: "atomic-c" }, // tool 누락
        { x0: 0.15, y0: 0.25, x1: 0.4, y1: 0.4, color: "#1A1A1A", tool: "pen", label: "atomic-d" },
        { x0: 0.4, y0: 0.4, x1: 0.5, y1: 0.5, color: "#1A1A1A", tool: "pen", label: "atomic-e" },
      ]).replace(/'/g, "''");

      expect(() => callAppend(TEACHER_ID, segments)).toThrow(/필수 필드/);

      // 0건도 남지 않았는지(부분 성공 없음) — atomic-a/atomic-b조차 없어야 한다.
      expect(countForSession()).toBe(before);
      const leftover = asUser(
        TEACHER_ID,
        `select count(*) from session_annotation_events where session_id = '${sessionId}' and payload->>'label' like 'atomic-%';`
      );
      expect(Number(leftover)).toBe(0);
    });

    it("세션과 무관한 제3자 선생님이 호출하면 RLS로 전체가 거부되고 0건 저장된다", () => {
      const before = countForSession();
      const segments = JSON.stringify([
        { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#1A1A1A", tool: "pen", label: "intruder-a" },
        { x0: 0.2, y0: 0.2, x1: 0.3, y1: 0.1, color: "#1A1A1A", tool: "pen", label: "intruder-b" },
      ]).replace(/'/g, "''");

      expect(() => callAppend(OTHER_TEACHER_ID, segments)).toThrow(/row-level security|policy/i);
      expect(countForSession()).toBe(before);
    });

    it("빈 배열/비배열 jsonb를 보내면 즉시 거부되고 아무 것도 저장되지 않는다", () => {
      const before = countForSession();
      expect(() =>
        asUser(
          TEACHER_ID,
          `select * from append_stroke_events('${sessionId}'::uuid, '[]'::jsonb);`
        )
      ).toThrow(/비어있지 않은/);
      expect(countForSession()).toBe(before);
    });
  });

  it("append-only: 기록된 이벤트는 UPDATE/DELETE 둘 다 트리거로 차단된다", () => {
    const id = asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb) returning id;`
    );

    // authenticated 역할은 UPDATE/DELETE 정책 자체가 없어(RLS 기본 거부) 트리거까지
    // 가지 않고 대상 행이 0건으로 걸러진다 — 에러 없이 조용히 아무 것도 바뀌지 않는다.
    // 트리거가 실제로 발동하는지는 RLS를 우회하는 service_role(아래)로 확인한다.
    asUser(TEACHER_ID, `update session_annotation_events set payload = '{"x":1}'::jsonb where id = '${id}';`);
    asUser(TEACHER_ID, `delete from session_annotation_events where id = '${id}';`);
    const stillThere = asUser(
      TEACHER_ID,
      `select payload from session_annotation_events where id = '${id}';`
    );
    expect(stillThere).toBe("{}"); // 원본 payload 그대로, 삭제도 안 됨

    // service_role(RLS 우회)로도 막혀야 진짜 append-only다.
    expect(() => psql(`update session_annotation_events set payload = '{"x":1}'::jsonb where id = '${id}';`)).toThrow(
      /append-only/
    );
  });
});
