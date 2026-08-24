import { useState } from "react";

const contactEmail = String(import.meta.env.VITE_CONTACT_EMAIL || "").trim();
const feedbackUrl = "https://github.com/yueyao926/HoneSight/issues/new";

export default function ContactSection() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    if (!contactEmail) return;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(contactEmail);
    } else {
      const input = document.createElement("textarea");
      input.value = contactEmail;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section id="contact" className="container-page scroll-mt-24 pb-20 pt-2">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink px-7 py-10 text-white sm:px-10 sm:py-12 lg:flex lg:items-end lg:justify-between lg:gap-12">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="font-display text-sm italic tracking-wide text-rose">联系我们</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">有问题，或者想聊聊合作？</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/65">
            无论是产品建议、使用问题还是合作想法，都欢迎告诉我们。每一条反馈，都会帮助 HoneSight 变得更好。
          </p>
        </div>

        <div className="relative mt-8 flex shrink-0 flex-wrap gap-3 lg:mt-0 lg:justify-end">
          {contactEmail ? (
            <>
              <a className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-blush" href={`mailto:${contactEmail}?subject=HoneSight 联系咨询`}>
                发送邮件
              </a>
              <button className="rounded-full border border-white/25 px-6 py-3 text-sm text-white transition hover:bg-white/10" type="button" onClick={copyEmail}>
                {copied ? "邮箱已复制" : "复制邮箱"}
              </button>
            </>
          ) : (
            <a className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-blush" href={feedbackUrl} target="_blank" rel="noreferrer">
              提交问题或建议
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
