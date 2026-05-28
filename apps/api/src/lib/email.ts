import { Resend } from "resend";
import { config } from "../config.js";
import { logger } from "./logger.js";

function getResend(): Resend | null {
  if (!config.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set — email sending is disabled");
    return null;
  }
  return new Resend(config.RESEND_API_KEY);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const from = `${config.RESEND_FROM_NAME} <${config.RESEND_FROM_EMAIL}>`;
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    logger.error({ error }, "Resend email send failed");
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export function welcomeAdminEmail(name: string, email: string, tempPassword: string, loginUrl: string): SendEmailOptions {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Dorada</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Dorada</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 12px;color:#18181b;font-size:20px;font-weight:600;">Welcome, ${name}!</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                An administrator has created an account for you on Dorada. You can log in using the credentials below.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
                    <p style="margin:0 0 16px;color:#18181b;font-size:15px;">${email}</p>
                    <p style="margin:0 0 8px;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</p>
                    <p style="margin:0;color:#18181b;font-size:15px;font-family:monospace;background:#e4e4e7;display:inline-block;padding:4px 8px;border-radius:4px;">${tempPassword}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                For security, please change your password immediately after your first login.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#18181b;border-radius:6px;">
                    <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Log in to Dorada →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:13px;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Welcome to Dorada, ${name}!\n\nAn administrator has created an account for you.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password immediately:\n${loginUrl}\n\nIf you didn't expect this email, you can safely ignore it.`;

  return { to: email, subject: "Welcome to Dorada — your account is ready", html, text };
}
