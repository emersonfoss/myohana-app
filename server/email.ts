import nodemailer from "nodemailer";

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
    console.log("─── DEV EMAIL (no EMAIL_API_KEY set) ───");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html}`);
    console.log("────────────────────────────────────────");
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM_ADDRESS,
    to,
    subject,
    html,
  });
}
