export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

/** Pinned so schema/query changes ship deliberately, not on every Sanity release. */
export const apiVersion = "2025-02-01";
