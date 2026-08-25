import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import BackHomeLink from "../components/BackHomeLink";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("缺少验证令牌，请从邮件中的链接重新进入。");
      return;
    }
    let active = true;
    verifyEmail(token)
      .then(() => {
        if (active) setStatus("success");
      })
      .catch((err) => {
        if (active) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "验证失败");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="handwriting-page container-page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md animate-fade-up text-center">
        <BackHomeLink />
        <p className="section-eyebrow mt-6">Email verification</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">邮箱验证</h1>
        {status === "loading" && <p className="mt-8 text-muted">正在验证，请稍候…</p>}
        {status === "success" && (
          <>
            <p className="mt-8 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">验证成功，现在可以登录了。</p>
            <Link className="btn-primary btn-primary--ink mt-6 inline-block" to="/login">去登录</Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-ink">{message}</p>
            <Link className="btn-secondary mt-6 inline-block" to="/resend-verification">重新发送验证邮件</Link>
          </>
        )}
      </div>
    </main>
  );
}
