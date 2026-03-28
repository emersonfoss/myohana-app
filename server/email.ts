import nodemailer from "nodemailer";
import { logger } from "./logger";

const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "noreply@myohana.app";

let transporter: nodemailer.Transporter | null = null;

if (EMAIL_API_KEY) {
  transporter = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: {
      user: "resend",
      pass: EMAIL_API_KEY,
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject }, "DEV EMAIL (no EMAIL_API_KEY set)");
    return;
  }

  // Retry once on transient failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM_ADDRESS,
        to,
        subject,
        html,
      });
      return;
    } catch (err) {
      if (attempt === 0) {
        logger.warn({ err, to, subject }, "Email send failed, retrying in 2s");
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        logger.error({ err, to, subject }, "Email send failed after retry");
        throw err;
      }
    }
  }
}
