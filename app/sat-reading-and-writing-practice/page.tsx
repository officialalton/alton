import { SatTopicView, satTopicMetadata } from "@/app/components/public/SatTopicView";

export const revalidate = 3600;
export const metadata = satTopicMetadata("/sat-reading-and-writing-practice");
export default function Page() {
  return <SatTopicView path="/sat-reading-and-writing-practice" />;
}
