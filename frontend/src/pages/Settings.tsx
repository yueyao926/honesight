import { useEffect, useState } from "react";
import { getMyPreferences, updateMyPreferences } from "../api/preferences";
import PreferenceForm from "../components/PreferenceForm";
import type { Preference } from "../types";

export default function Settings() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMyPreferences().then(setPreference).catch(() => setPreference(null));
  }, []);

  return (
    <main className="container-page">
      <div className="card">
        <h1 className="text-3xl font-semibold">偏好设置</h1>
        <p className="mt-3 text-muted">修改后，新的作品分析会使用最新偏好。</p>
        <div className="mt-8">
          <PreferenceForm
            initial={preference}
            submitText="保存偏好"
            onSubmit={async (payload) => {
              const updated = await updateMyPreferences(payload);
              setPreference(updated);
              setMessage("已保存");
            }}
          />
        </div>
        {message && <p className="mt-4 text-sm text-ink">{message}</p>}
      </div>
    </main>
  );
}
