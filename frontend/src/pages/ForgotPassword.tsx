import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await requestPasswordReset(String(form.get("email")));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="handwriting-page container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Forgot password</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">找回密码</h1>
        {sent ? (
          <p className="mt-8 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            如果该邮箱已注册，我们会发送密码重置链接。为避免重复邮件，同一邮箱 60 秒内只发送一次；
            若刚操作过，请等待一分钟再试，并检查垃圾邮件。
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label">邮箱</label>
              <input className="input ink-focus-frame" name="email" type="email" required placeholder="you@example.com" />
            </div>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-ink">{error}</p>}
            <button className="btn-primary btn-primary--ink w-full" type="submit" disabled={submitting}>
              {submitting ? "发送中..." : "发送重置链接"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          记起来了？<Link className="ml-1 text-ink" to="/login">去登录</Link>
        </p>
      </div>
    </main>
  );
}
