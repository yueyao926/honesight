import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMyPreferences } from "../api/preferences";
import PreferenceForm from "../components/PreferenceForm";

export default function Onboarding() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <main className="container-page max-w-3xl">
      <div className="card animate-fade-up">
        <p className="section-eyebrow">开始每周一练</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">先认识一下你</h1>
        <p className="mt-3 text-muted">只问四项，用来安排第一周难度。</p>
        <div className="mt-8">
          <PreferenceForm
            submitText="保存并开始"
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
        {error && <p className="mt-4 text-sm text-ink">{error}</p>}
      </div>
    </main>
  );
}
