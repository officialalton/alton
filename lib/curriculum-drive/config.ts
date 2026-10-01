// 교재 전용 Drive 연결 설정 — 회사 문서 Drive(COMPANY_DOCUMENTS_*)와 **다른 자원**이다.
//
// 2026-09-14 제품 오너: "필요한 교재 전용 자원과 최소 권한을 정리해 두세요. 기존 회사
// 문서 연결의 권한을 임의로 확대하지 않습니다."
//
//   CURRICULUM_DRIVE_ENABLED            'true' 가 아니면 Drive 를 호출하지 않는다(빈 상태).
//   CURRICULUM_DRIVE_ID                 교재 전용 Shared Drive 의 id(이름이 아니라 id).
//   CURRICULUM_DRIVE_ROOT_FOLDER_ID     과목 폴더들이 놓이는 루트 폴더 id(없으면 드라이브 루트).
//   CURRICULUM_DRIVE_ALLOW_REAL_WRITES  'true' 가 아니면 폴더 생성·이름 변경을 하지 않는다.
//                                       읽기(목록·내려받기)는 ENABLED 만으로 된다.
//
// 인증은 기존 Drive 토큰 경로(lib/drive/fetch.ts)를 그대로 쓴다 — 새 인증 체인을 만들지
// 않는다. Preview 는 별도 최소권한 서비스 계정 분기가 이미 있다.

export type CurriculumDriveConfig = {
  driveId: string;
  rootFolderId: string;
  allowRealWrites: boolean;
};

export function curriculumDriveConfig(env: Record<string, string | undefined> = process.env): CurriculumDriveConfig | null {
  if (env.CURRICULUM_DRIVE_ENABLED !== "true") return null;
  const driveId = env.CURRICULUM_DRIVE_ID;
  if (!driveId) return null;
  return {
    driveId,
    rootFolderId: env.CURRICULUM_DRIVE_ROOT_FOLDER_ID || driveId,
    allowRealWrites: env.CURRICULUM_DRIVE_ALLOW_REAL_WRITES === "true",
  };
}
