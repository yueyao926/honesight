import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="container-page flex min-h-[70vh] items-center justify-center">
        <div className="card w-full max-w-md animate-fade-up text-center">
          <BackHomeLink />
          <h1 className="mt-2 font-display text-4xl font-semibold">重置密码</h1>
          <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">缺少重置令牌，请从邮件中的链接重新进入。</p>
          <Link className="btn-secondary mt-6 inline-block" to="/forgot-password">重新获取重置链接</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Reset password</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">设置新密码</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="label">新密码</label>
            <input className="input" name="password" type="password" minLength={6} required placeholder="••••••••" />
          </div>
          <div>
            <label className="label">确认密码</label>
            <input className="input" name="confirm" type="password" minLength={6} required placeholder="••••••••" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? "提交中..." : "重置密码"}
          </button>
        </form>
      </div>
    </main>
  );
}
