// 격리 Supabase 스택 정리(stop/컨테이너 삭제) 전 안전 검사(순수 함수). 공유 스택(project_id ALTON, 포트 54420~54429·54325, supabase_*_ALTON)이면 항상 차단한다.
// 정리는 반드시 락 파일에 기록된 격리 project id 를 --project-id 로 명시해서만 실행한다(인자 없는 `supabase stop` 금지: config.toml 이 원복된 뒤에는 공유 스택을 가리킨다).
export const SHARED_PROJECT_ID = "ALTON";
const SHARED_PORTS = new Set([54320, 54321, 54322, 54323, 54324, 54325, 54327, 54329, ...Array.from({ length: 10 }, (_, i) => 54420 + i)]);

export type StackSnapshot = { containers: string[]; ports: number[] };
export type GuardInput = { projectId: string | undefined; lockProjectId: string | undefined; snapshot: StackSnapshot };
export type GuardResult = { ok: true } | { ok: false; reason: string };

const deny = (reason: string): GuardResult => ({ ok: false, reason });

/** `docker ps -a --format '{{.Names}}|{{.Ports}}'` 출력 → 대상 project id 의 컨테이너·호스트 포트. */
export function snapshotFromDockerPs(output: string, projectId: string): StackSnapshot {
  const containers: string[] = []; const ports: number[] = [];
  for (const line of output.split("\n")) {
    const [name, portText = ""] = line.trim().split("|");
    if (!name || !name.startsWith("supabase_") || !name.endsWith(`_${projectId}`)) continue;
    containers.push(name);
    for (const m of portText.matchAll(/:(\d+)->/g)) ports.push(Number(m[1]));
  }
  return { containers, ports };
}

export function checkIsolatedTeardown(i: GuardInput): GuardResult {
  const id = i.projectId?.trim();
  if (!id) return deny("대상 project id 가 없습니다. 인자 없는 stop 은 허용되지 않습니다.");
  if (!i.lockProjectId?.trim()) return deny("락 파일에 격리 project id 가 없습니다(이 래퍼로 시작한 스택만 정리 가능).");
  if (i.lockProjectId.trim() !== id) return deny(`락의 project id(${i.lockProjectId.trim()})와 대상(${id})이 다릅니다.`);
  if (id.toLowerCase() === SHARED_PROJECT_ID.toLowerCase()) return deny("공유 스택(ALTON) 입니다. 차단.");
  if (!/^ALTON_[A-Za-z0-9]+$/.test(id)) return deny(`격리 project id 는 ALTON_<이름> 형식이어야 합니다(받은 값: ${id}).`);
  if (i.snapshot.containers.length === 0) return deny("대상 project id 의 컨테이너가 없습니다(이미 정리됐거나 id 오류).");
  const sharedC = i.snapshot.containers.find((c) => /^supabase_.+_ALTON$/.test(c));
  if (sharedC) return deny(`공유 스택 컨테이너(${sharedC}) 가 대상에 포함돼 있습니다. 차단.`);
  const bad = i.snapshot.containers.find((c) => !c.endsWith(`_${id}`));
  if (bad) return deny(`대상 project id 와 무관한 컨테이너(${bad}).`);
  const sharedP = i.snapshot.ports.find((p) => SHARED_PORTS.has(p));
  if (sharedP) return deny(`공유 스택 포트 계열(${sharedP}) 을 쓰고 있습니다. 차단.`);
  return { ok: true };
}

/** 시작 전: config.toml 의 project_id 와 포트가 공유 스택 값이면 격리로 인정하지 않는다. */
export function checkIsolatedConfig(projectId: string | undefined, ports: number[]): GuardResult {
  if (!projectId || projectId === SHARED_PROJECT_ID || !/^ALTON_[A-Za-z0-9]+$/.test(projectId)) return deny(`config.toml project_id 가 격리 값이 아닙니다(${projectId ?? "없음"}).`);
  const p = ports.find((x) => SHARED_PORTS.has(x));
  return p ? deny(`config.toml 포트 ${p} 는 공유 스택 계열입니다.`) : { ok: true };
}
