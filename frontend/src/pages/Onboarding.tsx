import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMyPreferences } from "../api/preferences";
import PreferenceForm from "../components/PreferenceForm";

export default function Onboarding() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <main className="container-page">
      <div className="card">
        <h1 className="text-3xl font-semibold">先告诉我们你的摄影偏好</h1>
        <p className="mt-3 text-muted">这些信息会用于生成更贴近你目标的作品分析报告。</p>
        <div className="mt-8">
          <PreferenceForm
            submitText="保存并进入控制台"
            onSubmit={async (payload) => {
              try {
                await createMyPreferences(payload);
                navigate("/dashboard");
              } catch (err) {
                setError(err instanceof Error ? err.message : "保存失败");
              }
            }}
          />
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
