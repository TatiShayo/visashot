/**
 * Central typed env access. Missing keys never crash the build — providers
 * fall back to mocks and the gap is documented under NEEDS HUMAN in
 * PROJECT_STATE.md.
 */

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

export const env = {
  appUrl: str("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",

  supabaseUrl: str("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: str("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: str("SUPABASE_SERVICE_ROLE_KEY"),

  replicateApiToken: str("REPLICATE_API_TOKEN"),

  stripeSecretKey: str("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET"),

  resendApiKey: str("RESEND_API_KEY"),
  emailFrom: str("EMAIL_FROM") ?? "VisaShot <photos@localhost.dev>",

  posthogKey: str("NEXT_PUBLIC_POSTHOG_KEY"),
  posthogHost: str("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://us.i.posthog.com",
  sentryDsn: str("SENTRY_DSN"),

  turnstileSiteKey: str("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
  turnstileSecretKey: str("TURNSTILE_SECRET_KEY"),

  downloadSigningSecret: str("DOWNLOAD_SIGNING_SECRET"),
  cronSecret: str("CRON_SECRET"),
  adminToken: str("ADMIN_TOKEN"),
  adminEmails: (str("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  recoveryEmailsEnabled: str("RECOVERY_EMAILS_ENABLED") === "true",
  recoveryPromoCode: str("RECOVERY_PROMO_CODE"),

  isProd: process.env.NODE_ENV === "production",
} as const;

/** True when Stripe is not configured and the dev mock-payment flow is active. */
export function mockPaymentsActive(): boolean {
  return !env.stripeSecretKey;
}

/**
 * Signing secret with an explicit dev fallback. In production a real secret is
 * REQUIRED — routes that sign/verify will refuse to run without it.
 */
export function requireSigningSecret(): string {
  if (env.downloadSigningSecret) return env.downloadSigningSecret;
  if (env.isProd) {
    throw new Error(
      "DOWNLOAD_SIGNING_SECRET is required in production (see .env.example)"
    );
  }
  return "dev-only-signing-secret-do-not-use-in-prod";
}

/** List of missing provider keys, for the admin page + PROJECT_STATE. */
export function missingKeys(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.replicateApiToken) missing.push("REPLICATE_API_TOKEN");
  if (!env.stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
  if (!env.resendApiKey) missing.push("RESEND_API_KEY");
  if (!env.posthogKey) missing.push("NEXT_PUBLIC_POSTHOG_KEY");
  if (!env.sentryDsn) missing.push("SENTRY_DSN");
  if (!env.turnstileSecretKey) missing.push("TURNSTILE_SECRET_KEY");
  if (!env.downloadSigningSecret) missing.push("DOWNLOAD_SIGNING_SECRET");
  return missing;
}
