import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPracticeOverview,
  startPracticeSessionJob,
  waitForPracticeSessionJob,
  type StartPracticePayload,
} from "../api/practice";
import InteractiveCameraPerson from "../components/practice/InteractiveCameraPerson";
import PracticePlanCard from "../components/practice/PracticePlanCard";
import PracticeStarter from "../components/practice/PracticeStarter";
import { formatWeekLabel, getOverviewSessions } from "../components/practice/practiceConstants";
import { assignPracticeThemeIcons } from "../components/practice/practiceThemeIcons";
import PortfolioStarButton from "../components/portfolio/PortfolioStarButton";
import StudioProgressBar from "../components/studio/StudioProgressBar";
import SquigglyText from "../components/ui/SquigglyText";
import type { PracticeOverview } from "../types";
import noSvg from "../SVG/no.svg?url";

export default function Practice() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingText, setWorkingText] = useState("正在准备分析…");
  const [error, setError] = useState("");
  const practiceJobControllerRef = useRef<AbortController | null>(null);

  async function refreshOverview() {
    const next = await getPracticeOverview();
    setOverview(next);
    return next;
  }

  useEffect(() => {
    refreshOverview()
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
      await refreshOverview();
      navigate(`/practice/${result.id}`);
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

  const sessions = getOverviewSessions(overview);
  const sessionIdsKey = sessions.map((item) => item.id).join(",");
  const themeIcons = useMemo(
    () => assignPracticeThemeIcons(sessions.map((item) => item.id), overview?.week_key),
    [overview?.week_key, sessionIdsKey],
  );

  if (loading) return <main className="handwriting-page practice-page container-page"><div className="card animate-pulse text-sm text-muted">正在准备每周训练计划…</div></main>;

  const completedCount = sessions.filter((item) => item.status === "completed").length;
  const hasPrimary = sessions.some((item) => item.plan_role === "primary");
  const primaryCompleted = sessions.some((item) => item.plan_role === "primary" && item.status === "completed");
  const addRole: "primary" | "optional" = hasPrimary ? "optional" : "primary";
  const minutesPercent = overview?.weekly_budget_minutes
    ? Math.min(100, Math.round(((overview.scheduled_minutes || 0) / overview.weekly_budget_minutes) * 100))
    : 0;
  const remainingMinutes = Math.max(0, (overview?.weekly_budget_minutes || 20) - (overview?.scheduled_minutes || 0));

  return (
    <main className="handwriting-page practice-page container-page max-w-5xl">
      <header className="relative mb-8 pr-28 animate-fade-up sm:pr-36 md:pr-[clamp(7.5rem,17vw,11rem)]">
        <div className="min-w-0">
          <p className="section-eyebrow">{formatWeekLabel(overview?.week_key)}</p>
          <h1 className="page-title mt-2">每周一练</h1>
          <p className="mt-2 max-w-2xl text-base">
            <SquigglyText
              as="span"
              stepDuration={70}
              scale={[2, 3.5]}
              baseFrequency={0.018}
              className="text-muted"
            >
              主练完成即可达成本周目标，选练按你的时间自由添加。
            </SquigglyText>
          </p>
        </div>
        {sessions.length > 0 && overview?.can_add && (
          <div className="practice-add-btn-wrap absolute right-0 top-[3.25rem] z-10 translate-x-2 translate-y-1.5 sm:top-[3.5rem] sm:translate-x-4">
            <PortfolioStarButton
              type="button"
              className="practice-add-btn"
              onClick={() => navigate("/practice/add")}
            >
              {addRole === "primary" ? "安排主练" : "添加选练"}
            </PortfolioStarButton>
            <p className="practice-add-btn-hint mt-1.5 text-center text-xs text-muted">一周最多练习三个</p>
          </div>
        )}
        <InteractiveCameraPerson className="interactive-camera-person--practice-header absolute hidden shrink-0 md:block" />
      </header>

      {sessions.length > 0 && (
        <section className="practice-week-progress mb-6 sm:flex sm:items-end sm:justify-between">
          <div className="flex items-end gap-4 sm:gap-5">
            <img
              src={noSvg}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="practice-week-progress__mark"
            />
            <div>
              <p className="text-xs text-muted">本周总进度</p>
              <p className="mt-1 font-display text-2xl font-semibold">{primaryCompleted ? "本周目标已达成" : hasPrimary ? "主练进行中" : "等待安排本周主练"}</p>
              <p className="mt-1 text-xs text-muted">已完成 {completedCount}/{sessions.length} 项练习</p>
            </div>
          </div>
          <div className="mt-4 min-w-56 sm:mt-0 sm:text-right">
            <p className="text-xs text-muted">已安排 {overview?.scheduled_minutes || 0}/{overview?.weekly_budget_minutes || 20} 分钟</p>
            <StudioProgressBar value={minutesPercent} className="practice-week-progress__bar mt-2" />
          </div>
        </section>
      )}

      {sessions.length === 0 && (
        <PracticeStarter role="primary" sessions={sessions} remainingMinutes={remainingMinutes} loading={working} loadingText={workingText} onStart={start} />
      )}

      {sessions.length > 0 && (
        <section className="practice-plan-list" aria-label="本周练习">
          {sessions.map((session, sessionIndex) => (
            <PracticePlanCard
              key={session.id}
              index={sessionIndex + 1}
              session={session}
              titleIcon={themeIcons.get(session.id)}
              onOpen={() => navigate(`/practice/${session.id}`)}
              onReplace={() => navigate(`/practice/${session.id}/replace`)}
            />
          ))}
        </section>
      )}

      {sessions.length > 0 && <p className="mt-5 text-center text-xs text-muted">未完成的练习会一直保留；下次进入可以从当前进度继续。</p>}
      {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
