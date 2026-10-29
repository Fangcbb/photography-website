import nodemailer from "nodemailer";

type SendResetEmailArgs = {
  to: string;
  url: string;
};

export const sendResetEmail = async ({ to, url }: SendResetEmailArgs) => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    throw new Error("SMTP 配置缺失，无法发送重置邮件");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `"Fang Photography" <${from}>`,
    to,
    subject: "Fang Photography 后台密码重置",
    html: `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">
          <tr><td style="padding:32px 40px 24px;">
            <div style="font-size:20px;font-weight:700;color:#111827;">Fang Photography</div>
            <div style="margin-top:24px;font-size:15px;line-height:1.7;color:#374151;">
              我们收到了你的密码重置请求。点击下面的按钮，在 <strong>15 分钟</strong>内完成密码重置：
            </div>
            <div style="margin:28px 0;">
              <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:10px;">重置密码</a>
            </div>
            <div style="font-size:13px;line-height:1.6;color:#9ca3af;word-break:break-all;">
              如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
              <a href="${url}" style="color:#6366f1;">${url}</a>
            </div>
            <div style="margin-top:24px;font-size:13px;color:#9ca3af;">
              如果不是你本人操作，请忽略此邮件。链接将在 15 分钟后自动失效。
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  });
};
