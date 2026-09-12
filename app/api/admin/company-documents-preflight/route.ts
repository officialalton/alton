import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { driveFetch, getDriveTokenForCurrentEnv, DRIVE_API } from "@/lib/drive/fetch";

// P4-3 4단계 — 회사 문서 Drive 연결 **읽기 전용 점검**.
//
// 이 경로가 필요한 이유: Drive 토큰은 Vercel OIDC로만 발급된다(서비스 계정 키
// 파일이 없다 — 설계상 의도). 그래서 개발 환경에서는 Drive를 아예 호출할 수
// 없고, "서비스 계정이 어떤 드라이브를 볼 수 있는가"를 배포된 환경에서만
// 확인할 수 있다.
//
// 관리자 UI 어디에도 버튼으로 노출하지 않는다. 관리자 세션으로 이 주소를
// 직접 열어 한 번 확인하는 운영 점검 전용이다(workspace-preflight와 같은 관례).
//
// 응답에 담는 것: 드라이브 id·이름, 폴더 이름, 개수, 성공/실패와 HTTP 상태 코드.
// 담지 않는 것: 토큰·JWT 원문, Google 오류 응답 본문, 파일 내용.
//
// **아무것도 만들지 않는다** — 드라이브·폴더 생성, 권한 변경, 파일 쓰기 없음.

type Step = { step: string; ok: boolean; detail?: string };

function short(e: unknown): string {
  const message = e instanceof Error ? e.message : "알 수 없는 오류";
  // driveFetch는 응답 본문 300자를 에러에 담는다 — 상태 코드만 남기고 버린다.
  const status = message.match(/status (\d{3})/);
  return status ? `status ${status[1]}` : "요청 실패";
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자만 확인할 수 있습니다." }, { status: 403 });
  }

  const steps: Step[] = [];
  const env = {
    enabled: process.env.COMPANY_DOCUMENTS_ENABLED === "true",
    hasDriveId: Boolean(process.env.COMPANY_DOCUMENTS_DRIVE_ID),
    hasRootFolderId: Boolean(process.env.COMPANY_DOCUMENTS_ROOT_FOLDER_ID),
  };

  let token: string;
  try {
    token = await getDriveTokenForCurrentEnv();
    steps.push({ step: "drive_token", ok: true });
  } catch (e) {
    steps.push({ step: "drive_token", ok: false, detail: short(e) });
    return NextResponse.json({ env, steps, drives: [] });
  }

  // 서비스 계정이 멤버로 초대된 공유 드라이브 목록. 초대가 됐는지 확인하는
  // 가장 직접적인 신호다.
  let drives: Array<{ id: string; name: string }> = [];
  try {
    const res = await driveFetch(`${DRIVE_API}/drives?pageSize=50&fields=drives(id,name)`, token);
    const data = (await res.json()) as { drives?: Array<{ id: string; name: string }> };
    drives = data.drives ?? [];
    steps.push({ step: "drives_list", ok: true, detail: `${drives.length}개` });
  } catch (e) {
    steps.push({ step: "drives_list", ok: false, detail: short(e) });
  }

  // 환경변수가 이미 설정돼 있으면 그 드라이브에 실제로 접근되는지까지 본다.
  let rootFolders: string[] = [];
  const driveId = process.env.COMPANY_DOCUMENTS_DRIVE_ID;
  if (driveId) {
    const parent = process.env.COMPANY_DOCUMENTS_ROOT_FOLDER_ID || driveId;
    try {
      const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
      const res = await driveFetch(
        `${DRIVE_API}/files?q=${q}&corpora=drive&driveId=${driveId}` +
          `&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(name,mimeType)`,
        token
      );
      const data = (await res.json()) as {
        files?: Array<{ name: string; mimeType: string }>;
      };
      rootFolders = (data.files ?? [])
        .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
        .map((f) => f.name);
      steps.push({ step: "root_listing", ok: true, detail: `${data.files?.length ?? 0}개 항목` });
    } catch (e) {
      steps.push({ step: "root_listing", ok: false, detail: short(e) });
    }
  }

  return NextResponse.json({ env, steps, drives, rootFolders });
}
