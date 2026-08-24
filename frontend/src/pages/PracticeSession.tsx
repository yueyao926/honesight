import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  completePracticeSession,
  getPracticeOverview,
  markPracticeStarted,
  startPracticeAttemptJob,
  updatePracticeDifficulty,
  waitForPracticeAttemptJob,
} from "../api/practice";
import { FeedbackView, TaskBrief } from "../components/practice/PracticeSessionPanels";
import { getOverviewSessions, type DifficultyValue } from "../components/practice/practiceConstants";
import { assignPracticeThemeIcons } from "../components/practice/practiceThemeIcons";
import type { PracticeOverview, PracticeSession } from "../types";
import arrow28Svg from "../SVG/arrow-28.svg?url";

export default function PracticeSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingText, setWorkingText] = useState("正在准备分析…");
  const [error, setError] = useState("");
  const practiceJobControllerRef = useRef<AbortController | null>(null);

  async function refreshOverview() {
    const next = await getPracticeOverview();
    setOverview(next);
    const sessions = getOverviewSessions(next);
    const current = sessions.find((item) => item.id === Number(sessionId)) || null;
    setSession(current);
    return next;
  }

  useEffect(() => {
    refreshOverview()
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入练习"))
      .finally(() => setLoading(false));
    return () => practiceJobControllerRef.current?.abort();
  }, [sessionId]);

  async function beginSession() {
    if (!session) return false;
    setWorking(true);
    setError("");
    try {
      await markPracticeStarted(session.id);
      await refreshOverview();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存练习进度");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function submit(images: string[], reflection: string) {
    if (!session) return false;
    practiceJobControllerRef.current?.abort();
    const controller = new AbortController();
    practiceJobControllerRef.current = controller;
    setWorking(true);
    setWorkingText("正在准备分析…");
    setError("");
    try {
      const job = await startPracticeAttemptJob(session.id, { image_urls: images, self_reflection: reflection }, controller.signal);
      await waitForPracticeAttemptJob(job, controller.signal, (current) => {
        const labels: Record<string, string> = {
          preparing: "正在准备照片…",
          queued: "正在等待分析…",
          analyzing: "正在查看当前练习重点…",
          organizing: "正在整理本轮反馈…",
          completed: "反馈已生成",
        };
        setWorkingText(labels[current.stage] || "正在生成反馈…");
      });
      await refreshOverview();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
      return false;
    } finally {
      if (practiceJobControllerRef.current === controller) {
        practiceJobControllerRef.current = null;
        setWorking(false);
      }
    }
  }

  async function complete() {
    if (!session) return;
    setWorking(true);
    setError("");
    try {
      await completePracticeSession(session.id);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成状态保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function rate(value: DifficultyValue) {
    if (!session) return;
    setWorking(true);
    setError("");
    try {
      await updatePracticeDifficulty(session.id, value);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "难度反馈保存失败");
    } finally {
      setWorking(false);
    }
  }

  const sessions = getOverviewSessions(overview);
  const sessionIdsKey = sessions.map((item) => item.id).join(",");
  const themeIcons = useMemo(
    () => assignPracticeThemeIcons(sessions.map((item) => item.id), overview?.week_key),
    [overview?.week_key, sessionIdsKey],
  );
  const titleIcon = session ? themeIcons.get(session.id) : undefined;

  if (loading) {
    return (
      <main className="handwriting-page practice-page container-page max-w-5xl">
        <div className="card animate-pulse text-sm text-muted">正在加载练习…</div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="handwriting-page practice-page container-page max-w-5xl">
        <Link className="community-back-link" to="/practice">
          <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
          <span className="community-back-link__label">返回每周一练</span>
        </Link>
        <p className="mt-8 text-muted">{error || "找不到这项练习"}</p>
      </main>
    );
  }

  return (
    <main className="handwriting-page practice-page container-page max-w-5xl">
      <Link className="community-back-link" to="/practice">
        <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
        <span className="community-back-link__label">返回每周一练</span>
      </Link>

      <div className="mt-6">
        {session.attempts.length === 0 ? (
          <TaskBrief
            key={session.id}
            session={session}
            titleIcon={titleIcon}
            onStart={beginSession}
            onReplace={() => navigate(`/practice/${session.id}/replace`)}
            onSubmit={submit}
            onClose={() => navigate("/practice")}
            working={working}
            workingText={workingText}
          />
        ) : (
          <FeedbackView
            key={session.id}
            session={session}
            onRate={rate}
            onComplete={complete}
            onSubmit={submit}
            onClose={() => navigate("/practice")}
            working={working}
            workingText={workingText}
          />
        )}
      </div>

      {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
