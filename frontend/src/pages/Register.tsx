import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await register({
        username: String(form.get("username")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    }
  }

  return (
    <main className="container-page max-w-xl">
      <div className="card">
        <h1 className="text-3xl font-semibold">创建 LensCoach 账号</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div><label className="label">用户名</label><input className="input" name="username" required /></div>
          <div><label className="label">邮箱</label><input className="input" name="email" type="email" required /></div>
          <div><label className="label">密码</label><input className="input" name="password" type="password" minLength={6} required /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit">注册</button>
        </form>
        <p className="mt-5 text-sm text-muted">已有账号？<Link className="text-brand" to="/login">去登录</Link></p>
      </div>
    </main>
  );
}
