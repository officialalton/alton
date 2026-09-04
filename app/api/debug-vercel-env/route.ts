import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_ORG_ID: process.env.VERCEL_ORG_ID ?? null,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID ?? null,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER ?? null,
    VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG ?? null,
    VERCEL: process.env.VERCEL ?? null,
    expected: {
      allow: process.env.GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW ?? null,
      orgId: process.env.GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_ORG_ID ?? null,
      projectId: process.env.GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_PROJECT_ID ?? null,
      branch: process.env.GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_BRANCH ?? null,
    },
  });
}
