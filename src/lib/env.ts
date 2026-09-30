/** True only for the production deployment (the go-live branch on Vercel).
 * Preview/staging deployments and local dev return false. Used to keep
 * placeholder marketing content (e.g. testimonials) out of the live site
 * while still letting it render on staging for review. */
export function isLiveProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.TEMPO_LAUNCH_GATE === "true";
}
