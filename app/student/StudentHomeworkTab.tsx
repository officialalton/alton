import type { HomeworkBatch } from "@/lib/homework-batch-data";
import HomeworkBatchPanel from "@/app/components/HomeworkBatchPanel";

// 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 발급할 때마다 발급 날짜로 이름
// 붙는 새 배치가 생기고(예: "9월 16일 과제"), 여기서 배치를 눌러 목차·슬라이드로 풀고 채점 결과를
// 본다. 교사 포털 "과제 내역"·세션뷰 과제 탭도 같은 화면(HomeworkBatchPanel)을 그대로 쓴다.

export default function StudentHomeworkTab({ batches }: { batches: HomeworkBatch[] }) {
  return (
    <div className="max-w-[760px]">
      <p className="text-[13px] text-grey-500 mb-4">
        선생님이 낸 과제입니다. 답을 제출하면 선생님이 채점한 뒤 정답과 해설이 열립니다.
      </p>
      <HomeworkBatchPanel batches={batches} viewerRole="student" />
    </div>
  );
}
