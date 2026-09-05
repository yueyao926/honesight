import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";

export default function Register() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    try {
      await register({
        username: String(form.get("username")),
        email,
        password: String(form.get("password")),
      });
      setRegisteredEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <main className="handwriting-page container-page flex min-h-[70vh] items-center justify-center">
        <div className="card w-full max-w-md animate-fade-up text-center">
          <BackHomeLink />
          <p className="section-eyebrow mt-6">Verify your email</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">验证邮件已发送</h1>
          <p className="mt-8 text-sm leading-7 text-muted">
            我们已向 <span className="font-medium text-ink">{registeredEmail}</span> 发送验证邮件，
            请查收并点击邮件中的链接完成验证后再登录。若收件箱中没有，请同时检查垃圾邮件。
          </p>
          <Link className="btn-primary btn-primary--ink mt-6 inline-block" to="/login">去登录</Link>
          <p className="mt-4 text-center text-sm text-muted">
            没收到？<Link className="ml-1 text-ink" to={`/resend-verification?email=${encodeURIComponent(registeredEmail)}`}>重新发送验证邮件</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="handwriting-page container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Join us</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">创建账号</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div><label className="label">用户名</label><input className="input ink-focus-frame" name="username" required /></div>
          <div><label className="label">邮箱</label><input className="input ink-focus-frame" name="email" type="email" required /></div>
          <div><label className="label">密码</label><input className="input ink-focus-frame" name="password" type="password" minLength={6} required /></div>
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-ink">
              <p>{error}</p>
              {(error.includes("已注册并完成验证") || error.includes("已有未验证账号")) && (
                <p className="mt-2">
                  <Link className="underline" to="/login">去登录</Link>
                  <span className="mx-2">·</span>
                  <Link className="underline" to="/forgot-password">找回密码</Link>
                </p>
              )}
            </div>
          )}
          <button className="btn-primary btn-primary--ink w-full" type="submit" disabled={submitting}>
            {submitting ? "创建中..." : "注册"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">已有账号？<Link className="ml-1 text-ink" to="/login">去登录</Link></p>
      </div>
    </main>
  );
}
