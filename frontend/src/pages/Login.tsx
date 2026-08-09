import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BackHomeLink from "../components/BackHomeLink";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      // 回跳到登录前想去的页面，没有则进控制台
      navigate(from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请检查邮箱和密码");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">登录</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="label">邮箱</label>
            <input className="input" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">密码</label>
            <input className="input" name="password" type="password" required placeholder="••••••••" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          还没有账号？<Link className="ml-1 text-brand-deep" to="/register">去注册</Link>
        </p>
      </div>
    </main>
  );
}
