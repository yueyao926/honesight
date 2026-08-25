import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerification } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";

export default function ResendVerification() {
  const [searchParams] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await resendVerification(String(form.get("email")));
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
        <p className="section-eyebrow mt-6">Resend verification</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">重新发送验证邮件</h1>
        {sent ? (
          <p className="mt-8 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            如果该邮箱尚未验证，我们已发送验证邮件，请查收。
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label">邮箱</label>
              <input className="input ink-focus-frame" name="email" type="email" required defaultValue={searchParams.get("email") || ""} placeholder="you@example.com" />
            </div>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-ink">{error}</p>}
            <button className="btn-primary btn-primary--ink w-full" type="submit" disabled={submitting}>
              {submitting ? "发送中..." : "发送验证邮件"}
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
