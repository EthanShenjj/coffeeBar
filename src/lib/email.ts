import { Resend } from "resend";

let resend: Resend | undefined;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendAuthEmail(to: string, subject: string, url: string) {
  const client = getResend();
  if (!client) return;
  await client.emails.send({
    from: process.env.EMAIL_FROM ?? "CoffeeBar <noreply@example.com>",
    to,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px"><h1 style="font-size:24px">CoffeeBar</h1><p>${subject}</p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none;border-radius:999px">继续</a><p style="color:#777;font-size:12px;margin-top:24px">如果不是你本人操作，可以忽略此邮件。</p></div>`,
  });
}
