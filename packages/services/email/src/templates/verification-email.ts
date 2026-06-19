import { sendEmail } from "../send.js";
import {
  magicLinkHtml,
  magicLinkSubject,
  magicLinkText,
} from "./magic-link.js";

export async function sendMagicLinkEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to,
    subject: magicLinkSubject(),
    html: magicLinkHtml({ url }),
    text: magicLinkText({ url }),
    fallbackUrl: url,
  });
}

export async function sendVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to,
    subject: verificationEmailSubject(),
    html: verificationEmailHtml({ url }),
    text: verificationEmailText({ url }),
    fallbackUrl: url,
  });
}

function verificationEmailSubject() {
  return "Verify your Devin account";
}

function verificationEmailHtml({ url }: { url: string }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your Devin account</title>
  </head>
  <body style="margin:0;padding:0;background-color:#121212;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#121212;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#1e1e1e;border:1px solid #333;border-radius:12px;padding:40px 32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <p style="margin:0;font-size:24px;font-weight:600;color:#ffffff;">Welcome to Devin</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:28px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#9ca3af;text-align:center;">
                  Confirm your email address to finish creating your account.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${url}" style="display:inline-block;background-color:#4a90e2;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
                  Verify email
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
                  If you did not create a Devin account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function verificationEmailText({ url }: { url: string }) {
  return `Verify your Devin account

Confirm your email address to finish creating your account.

${url}

If you did not create a Devin account, you can safely ignore this email.`;
}
