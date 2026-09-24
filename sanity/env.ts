// Project id and dataset are public identifiers, so they have safe defaults here.
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "uruh3czl";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
export const apiVersion = "2026-09-01";

// Where the Studio lives (used for stega click-to-edit links). Set to the deployed Studio URL in production.
export const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ?? "http://localhost:3333";

// Viewer token: server only. Needed for Draft Mode; published content works without it.
export const readToken = process.env.SANITY_API_READ_TOKEN;
