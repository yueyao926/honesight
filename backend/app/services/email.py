import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("lenscoach.email")


def send_email(*, to_email: str, subject: str, html_body: str) -> None:
    """Send an email via SMTP, falling back to the log when SMTP is unconfigured.

    The console fallback keeps the full flow working in local development without
    any SMTP credentials: the email (including any verification/reset link) is
    printed to the backend log instead.
    """
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content("Your email client does not support HTML. Please view this message as HTML.")
    message.add_alternative(html_body, subtype="html")

    if not settings.smtp_host:
        logger.info("EMAIL (no SMTP configured) to=%s subject=%s\n%s", to_email, subject, html_body)
        return

    if settings.smtp_use_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.send_message(message)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.send_message(message)


def send_verification_email(to_email: str, link: str) -> None:
    subject = "验证你的 HoneSight 邮箱 / Verify your email"
    html_body = (
        "<p>你好，欢迎加入 HoneSight！</p>"
        "<p>请点击下方链接完成邮箱验证（24 小时内有效）：</p>"
        f'<p><a href="{link}">验证邮箱</a></p>'
        f'<p>如果按钮无法点击，请复制以下链接到浏览器打开：<br>{link}</p>'
        "<p>如果不是你本人操作，请忽略此邮件。</p>"
    )
    send_email(to_email=to_email, subject=subject, html_body=html_body)


def send_password_reset_email(to_email: str, link: str) -> None:
    subject = "重置你的 HoneSight 密码 / Reset your password"
    html_body = (
        "<p>你好，我们收到了你的密码重置请求。</p>"
        "<p>请点击下方链接设置新密码（30 分钟内有效）：</p>"
        f'<p><a href="{link}">重置密码</a></p>'
        f'<p>如果按钮无法点击，请复制以下链接到浏览器打开：<br>{link}</p>'
        "<p>如果不是你本人操作，请忽略此邮件，你的密码不会被更改。</p>"
    )
    send_email(to_email=to_email, subject=subject, html_body=html_body)
