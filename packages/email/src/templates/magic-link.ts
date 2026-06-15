interface MagicLinkTemplateParams {
  url: string;
}

export function magicLinkSubject() {
  return "Sign in to Devin";
}

export function magicLinkHtml({ url }: MagicLinkTemplateParams) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in to Devin</title>
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
                  Click the button below to sign in to your account. This link expires in 5 minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${url}" style="display:inline-block;background-color:#4a90e2;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
                  Sign in to Devin
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
                  If you did not request this email, you can safely ignore it.
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

export function magicLinkText({ url }: MagicLinkTemplateParams) {
  return `Sign in to Devin

Click the link below to sign in to your account. This link expires in 5 minutes.

${url}

If you did not request this email, you can safely ignore it.`;
}
