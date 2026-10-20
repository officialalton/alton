import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schemaTypes";
import { projectId, dataset } from "./sanity/env";

/**
 * ALTON Insights 스튜디오. 앱 번들에 포함하지 않는다(/studio 라우트 없음) —
 * 로컬에서 `npm run sanity:dev`, 호스팅은 오너가 `npx sanity deploy`로 별도 진행.
 */
export default defineConfig({
  name: "alton-insights",
  title: "ALTON Insights",
  projectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [structureTool()],
});
