import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      await register({
        username: String(form.get("username")),
        email,
        password,
      });
      // 注册成功后直接登录，避免用户再手动输一遍账号密码
      await login(email, password);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="handwriting-page container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Join us</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">创建账号</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div><label className="label">用户名</label><input className="input" name="username" required /></div>
          <div><label className="label">邮箱</label><input className="input" name="email" type="email" required /></div>
          <div><label className="label">密码</label><input className="input" name="password" type="password" minLength={6} required /></div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? "创建中..." : "注册"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">已有账号？<Link className="ml-1 text-brand-deep" to="/login">去登录</Link></p>
      </div>
    </main>
  );
}
