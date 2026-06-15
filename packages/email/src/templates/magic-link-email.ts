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
