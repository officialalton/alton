// DB 통합 테스트 공용 — 선생님의 빈 예약 슬롯을 찾는다.
//
// 통합 테스트는 같은 로컬 Supabase를 공유하고, 수업권 원장·pin된 선택·append-only
// 이벤트 때문에 이전 실행의 예약 행이 정리되지 않고 남는다. 고정 날짜나 무작위 날짜로
// 예약을 넣으면 재실행 때 reservations_no_overlap / teacher_buffer_violation이 난다.
// 여기서는 violates_teacher_buffer()(겹침 + 앞뒤 버퍼)가 false인 첫 슬롯을 DB에 물어서
// 고르고, 동시에 같은 슬롯을 잡은 경우에만 다음 슬롯으로 재시도한다.
//
// 권장 패턴: 파일마다 전용 선생님을 새로 만든다(test/per-run-teacher.ts의
// createPerRunTeacher). 예약이 그 선생님에만 쌓이므로 시드 선생님의 예약 가능 창과 날짜
// 구간이 재실행으로 소모되지 않는다. 이 파일의 헬퍼(findFreeBookableSlot,
// findFreeTeacherSlot, insertReservationInBand)는 전용 선생님 위에서도 그대로 쓴다.
//
// 아래 RESERVATION_DAY_BANDS는 시드 선생님 하나를 여러 파일이 공유하던 시절의 날짜 구간이다.
// 시드 선생님에 예약을 두어야 하는 파일(시드 배정·권한 경계 자체가 검증 대상)만 겹치지 않는
// 구간을 추가해 쓴다. 전용 선생님을 쓰는 파일도 band 키는 남아 있어야 insertReservationInBand가
// 동작한다(선생님이 파일 전용이라 구간 충돌은 없음).

type Psql = (sql: string) => string;

/** 파일별 예약 날짜 구간(일, now() 기준). 새 파일은 겹치지 않는 구간을 추가해 쓴다. */
export const RESERVATION_DAY_BANDS = {
  "session-prepared-selection": [300, 1999],
  "session-content-manifest": [2000, 2999],
  "homework-composition": [3000, 3999],
  "unit-prep-and-start-freeze": [4000, 4999],
  "homework-v3": [5000, 5999],
  "prep-version-through-lesson": [6000, 6999],
  "homework-teacher-view": [7000, 7999],
  "annotation-scopes": [8000, 8999],
  "drive-material-assets": [10000, 19999],
  "session-content-use-events": [20000, 49999],
  "session-annotation-events": [60000, 60999],
  "problem-grading": [61000, 61999],
  "pinned-problem-version-read": [62000, 62999],
  "r8-cutover": [63000, 63999],
  "session-invariant-unlock-token": [64000, 64999],
  "vocab-round2": [65000, 65999],
  "auto-link-next-unit": [66000, 66999],
  "homework-direct-issue": [67000, 67999],
  "workspace-events-idempotency": [68000, 68999],
  "payout-auto-dispatch": [69000, 69999],
  "payout-month-close-and-adjustment": [70000, 70999],
  "contract-dispatch-outbox": [71000, 71999],
  "household-archive": [72000, 72999],
  "problem-answer-leak": [73000, 73999],
  "contract-dispatch-immediate": [76000, 76999],
} as const satisfies Record<string, readonly [number, number]>;

const cursors = new Map<string, number>();

function isOverlapError(err: unknown): boolean {
  const detail = `${(err as { stderr?: unknown })?.stderr ?? ""}${String(err)}`;
  return detail.includes("reservations_no_overlap") || detail.includes("teacher_buffer_violation");
}

/**
 * [fromHours, toHours) 구간(now() 기준 시간, 정각 정렬)에서 stepHours 간격으로 훑어
 * 선생님이 비어 있는 첫 시작 시각(ISO 문자열)을 돌려준다. 같은 key로 다시 부르면 직전에
 * 고른 슬롯 다음부터 찾는다.
 */
export function findFreeTeacherSlot(
  psql: Psql,
  opts: { teacherId: string; fromHours: number; toHours: number; stepHours?: number; durationMinutes?: number; key?: string },
): string {
  const step = opts.stepHours ?? 2;
  const duration = opts.durationMinutes ?? 60;
  const key = opts.key ?? `${opts.teacherId}:${opts.fromHours}`;
  const from = Math.max(cursors.get(key) ?? opts.fromHours, opts.fromHours);
  // order by가 있으면 Postgres가 구간 전체 후보에 violates_teacher_buffer()를 먼저 다 돌린 뒤
  // 정렬한다(10000일 구간 ≈ 17초). 후보를 작은 묶음으로 나눠 앞에서부터 찾는다.
  const chunk = step * 500;
  let row = "";
  for (let lo = from; lo < opts.toHours && !row; lo += chunk) {
    const hi = Math.min(lo + chunk, opts.toHours) - 1;
    row = psql(
      `select h || '|' || (date_trunc('hour', now()) + make_interval(hours => h))::text
       from generate_series(${lo}, ${hi}, ${step}) h
       where not violates_teacher_buffer('${opts.teacherId}',
         date_trunc('hour', now()) + make_interval(hours => h),
         date_trunc('hour', now()) + make_interval(hours => h) + make_interval(mins => ${duration}))
       order by h limit 1;`,
    );
  }
  if (!row) throw new Error(`빈 예약 슬롯 없음: teacher=${opts.teacherId} hours=[${from}, ${opts.toHours})`);
  const [hours, startsAt] = row.split("|");
  cursors.set(key, Number(hours) + step);
  return startsAt;
}

/**
 * 파일 전용 날짜 구간 안의 빈 슬롯에 확정 lesson 예약을 직접 넣고 reservation id를 돌려준다.
 */
export function insertReservationInBand(
  psql: Psql,
  opts: {
    band: keyof typeof RESERVATION_DAY_BANDS;
    enrollmentId: string;
    teacherId: string;
    durationMinutes?: number;
    status?: string;
    kind?: string;
  },
): string {
  const [fromDay, toDay] = RESERVATION_DAY_BANDS[opts.band];
  const duration = opts.durationMinutes ?? 60;
  for (let attempt = 0; attempt < 20; attempt++) {
    const startsAt = findFreeTeacherSlot(psql, {
      teacherId: opts.teacherId,
      fromHours: fromDay * 24,
      toHours: (toDay + 1) * 24,
      durationMinutes: duration,
      key: `band:${opts.band}:${opts.teacherId}`,
    });
    try {
      return psql(
        `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
         values ('${opts.kind ?? "lesson"}', '${opts.enrollmentId}', '${opts.teacherId}', '${startsAt}'::timestamptz,
                 '${startsAt}'::timestamptz + make_interval(mins => ${duration}), '${opts.status ?? "confirmed"}') returning id;`,
      );
    } catch (err) {
      if (!isOverlapError(err)) throw err;
    }
  }
  throw new Error(`예약 슬롯 확보 재시도 초과: band=${opts.band}`);
}

/**
 * 예약 가능 기간(24시간 뒤 ~ 8주) 안에서 선생님이 비어 있는 슬롯을 돌려준다 —
 * confirm_lesson_booking()처럼 예약 창·가능 시간 검사를 거치는 경로용. hoursUtc로
 * 선생님 가능 시간 규칙 안의 시간대만 고른다. minDays 이후 날짜부터 찾는다.
 */
export function findFreeBookableSlot(
  psql: Psql,
  opts: { teacherId: string; minDays?: number; maxDays?: number; hoursUtc?: readonly number[]; durationMinutes?: number },
): { startsAt: string; endsAt: string } {
  const minDays = opts.minDays ?? 2;
  const maxDays = opts.maxDays ?? 50;
  const duration = opts.durationMinutes ?? 60;
  const hours = (opts.hoursUtc ?? [15, 16, 17, 18, 19, 20, 21, 22]).join(",");
  const row = psql(
    `select s::text || '|' || (s + make_interval(mins => ${duration}))::text
     from generate_series(${minDays}, ${maxDays}) d
     cross join unnest(array[${hours}]) h
     cross join lateral (select date_trunc('day', now() at time zone 'utc') at time zone 'utc'
                                + make_interval(days => d, hours => h) as s) x
     where not violates_teacher_buffer('${opts.teacherId}', s, s + make_interval(mins => ${duration}))
     order by d, h limit 1;`,
  );
  if (!row) throw new Error(`예약 가능 기간 안에 빈 슬롯 없음: teacher=${opts.teacherId}`);
  const [startsAt, endsAt] = row.split("|");
  return { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
}
