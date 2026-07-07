/**
 * Email behind a typed interface.
 *
 * Real impl: Resend. Mock impl (no RESEND_API_KEY): logs to the server console
 * and records sends in-memory so tests can assert delivery. No PII beyond the
 * recipient is logged.
 */

import { Resend } from "resend";
import { env } from "@/lib/env";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(input: EmailInput): Promise<{ id: string; mocked: boolean }>;
  readonly mocked: boolean;
}

/** Test/introspection hook — recent mock sends. */
export const mockOutbox: EmailInput[] = [];

class MockEmailProvider implements EmailProvider {
  readonly mocked = true;
  async send(input: EmailInput): Promise<{ id: string; mocked: boolean }> {
    mockOutbox.push(input);
    // eslint-disable-next-line no-console
    console.info(`[email:mock] → ${input.to} — ${input.subject}`);
    return { id: `mock_${Date.now()}`, mocked: true };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly mocked = false;
  private resend: Resend;
  constructor(apiKey: string, private from: string) {
    this.resend = new Resend(apiKey);
  }
  async send(input: EmailInput): Promise<{ id: string; mocked: boolean }> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) throw new Error(`Email send failed: ${error.message}`);
    return { id: data?.id ?? "", mocked: false };
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  cached = env.resendApiKey
    ? new ResendEmailProvider(env.resendApiKey, env.emailFrom)
    : new MockEmailProvider();
  return cached;
}
