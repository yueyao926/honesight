"""Send one SMTP smoke-test message using the application's runtime settings."""

import argparse

from app.services.email import EmailDeliveryError, send_email


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a HoneSight SMTP test email")
    parser.add_argument("--to", required=True, help="Recipient email address")
    args = parser.parse_args()

    try:
        send_email(
            to_email=args.to,
            subject="HoneSight SMTP 测试",
            html_body=(
                "<p>HoneSight SMTP 配置测试成功。</p>"
                "<p>如果你收到这封邮件，注册验证邮件已经可以正常发送。</p>"
            ),
        )
    except EmailDeliveryError as exc:
        parser.exit(1, f"SMTP test failed: {exc}\n")

    print(f"SMTP test accepted for delivery to {args.to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
