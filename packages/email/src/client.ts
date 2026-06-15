import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function getFromAddress(): string {
  const raw = process.env.RESEND_FROM_EMAIL?.trim().replace(/^["']|["']$/g, "");

  if (raw && isValidFromAddress(raw)) {
    return raw;
  }

  return "Devin <onboarding@resend.dev>";
}

function isValidFromAddress(value: string): boolean {
  const emailOnly = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/;
  const named = /^.+<[^\s<>]+@[^\s<>]+\.[^\s<>]+>$/;

  return emailOnly.test(value) || named.test(value);
}
