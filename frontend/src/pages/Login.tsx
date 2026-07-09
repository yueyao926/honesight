import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <main className="container-page max-w-xl">
      <div className="card">
        <h1 className="text-3xl font-semibold">登录 LensCoach</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div><label className="label">邮箱</label><input className="input" name="email" type="email" required /></div>
          <div><label className="label">密码</label><input className="input" name="password" type="password" required /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit">登录</button>
        </form>
        <p className="mt-5 text-sm text-muted">还没有账号？<Link className="text-brand" to="/register">去注册</Link></p>
      </div>
    </main>
  );
}
