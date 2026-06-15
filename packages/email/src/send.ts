import { getFromAddress, getResendClient } from "./client.js";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  fallbackUrl?: string;
}

function shouldStrictlyFailOnEmailError() {
  return process.env.RESEND_STRICT === "true";
}

function logEmailFallback({
  to,
  subject,
  fallbackUrl,
  reason,
}: {
  to: string;
  subject: string;
  fallbackUrl?: string;
  reason: string;
}) {
  console.warn(`[email] ${reason} — skipped sending "${subject}" to ${to}`);

  if (fallbackUrl) {
    console.log(`[email] fallback link for ${to}: ${fallbackUrl}`);
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  fallbackUrl,
}: SendEmailParams): Promise<void> {
  const client = getResendClient();

  if (!client) {
    logEmailFallback({
      to,
      subject,
      fallbackUrl,
      reason: "RESEND_API_KEY is not set",
    });
    return;
  }

  const { data, error } = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    html,
    text,
  });

  if (error) {
    logEmailFallback({
      to,
      subject,
      fallbackUrl,
      reason: error.message,
    });

    if (shouldStrictlyFailOnEmailError()) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return;
  }

  console.log(
    `[email] sent "${subject}" to ${to} from ${getFromAddress()} (id: ${data?.id ?? "unknown"})`,
  );
}
