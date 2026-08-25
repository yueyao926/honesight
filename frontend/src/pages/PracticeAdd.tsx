import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getPracticeOverview,
  startPracticeSessionJob,
  waitForPracticeSessionJob,
  type StartPracticePayload,
} from "../api/practice";
import PracticeStarter from "../components/practice/PracticeStarter";
import PageLoader from "../components/PageLoader";
import { formatWeekLabel } from "../components/practice/practiceConstants";
import type { PracticeOverview } from "../types";
import arrow28Svg from "../SVG/arrow-28.svg?url";
import changeSvg from "../SVG/change.svg?url";

export default function PracticeAdd() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingText, setWorkingText] = useState("正在准备分析…");
  const [error, setError] = useState("");
  const practiceJobControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getPracticeOverview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入每周练习"))
      .finally(() => setLoading(false));
    return () => practiceJobControllerRef.current?.abort();
  }, []);

  async function start(payload: StartPracticePayload) {
    practiceJobControllerRef.current?.abort();
    const controller = new AbortController();
    practiceJobControllerRef.current = controller;
    setWorking(true);
    setWorkingText("正在准备任务…");
    setError("");
    try {
      const job = await startPracticeSessionJob(payload, controller.signal);
      const result = await waitForPracticeSessionJob(job, controller.signal, (current) => {
        const labels: Record<string, string> = {
          preparing: "正在准备任务…",
          queued: "正在等待分析…",
          analyzing: "正在判断最值得练的重点…",
          organizing: "正在匹配具体任务…",
          completed: "练习已加入计划",
        };
        setWorkingText(labels[current.stage] || "正在安排任务…");
      });
      navigate(`/practice/${result.id}`, { replace: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "任务生成失败，请稍后重试");
    } finally {
      if (practiceJobControllerRef.current === controller) {
        practiceJobControllerRef.current = null;
        setWorking(false);
      }
    }
  }

  if (loading) {
    return <PageLoader variant="route" />;
  }

  const sessions = overview?.current_sessions || (overview?.current ? [overview.current] : []);
  const hasPrimary = sessions.some((item) => item.plan_role === "primary");
  const addRole: "primary" | "optional" = hasPrimary ? "optional" : "primary";
  const remainingMinutes = Math.max(0, (overview?.weekly_budget_minutes || 20) - (overview?.scheduled_minutes || 0));

  if (sessions.length > 0 && !overview?.can_add) {
    return (
      <main className="handwriting-page practice-page container-page max-w-5xl">
        <Link className="community-back-link" to="/practice">
          <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
          <span className="community-back-link__label">返回每周一练</span>
        </Link>
        <p className="mt-8 text-muted">本周已无法再添加练习。</p>
      </main>
    );
  }

  return (
    <main className="handwriting-page practice-page container-page max-w-5xl">
      <Link className="community-back-link" to="/practice">
        <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
        <span className="community-back-link__label">返回每周一练</span>
      </Link>

      <header className="practice-page-intro mt-6 mb-6 animate-fade-up">
        <p className="section-eyebrow">{formatWeekLabel(overview?.week_key)}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="practice-page-intro__title-row">
            <h1 className="page-title">{addRole === "primary" ? "安排主练" : "添加选练"}</h1>
            <img
              src={changeSvg}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="practice-page-intro__icon"
            />
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={() => navigate("/practice")}>
            取消
          </button>
        </div>
        <p className="practice-starter-lead">这次想练出什么变化？</p>
        <p className="mt-1 text-sm text-muted">
          {remainingMinutes > 0
            ? `本周还可安排约 ${remainingMinutes} 分钟。`
            : "本周时间已排满，仍可按需要添加选练。"}
        </p>
      </header>

      <PracticeStarter
        role={addRole}
        sessions={sessions}
        remainingMinutes={remainingMinutes}
        loading={working}
        loadingText={workingText}
        hideIntro
        onStart={start}
      />

      {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
