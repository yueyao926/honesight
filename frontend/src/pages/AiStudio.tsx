import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { previewAnalyze } from "../api/analyze";
import { getAssetUrl } from "../api/client";
import { savePortfolioWithAnalysis } from "../api/portfolio";
import {
  AdvicePanel,
  BenchmarkOverview,
  DimensionCards,
  ParamsPanel,
  PlatformPanel,
  StylePanel,
} from "../components/analysis/AnalysisPanels";
import ExpectedEffectPreview from "../components/ExpectedEffectPreview";
import PhotoUpload from "../components/PhotoUpload";
import StyleReferenceUpload from "../components/StyleReferenceUpload";
import type { PhotoAnalysis } from "../types";

const targetStyles = ["清新自然", "日系", "胶片感", "高级灰", "复古", "高饱和", "生活记录", "商业感"];
const targetPlatforms = ["小红书", "朋友圈", "Instagram", "作品集", "商业约拍"];
const steps = ["上传照片", "风格参考", "确认设置", "AI 分析", "查看建议"];

export default function AiStudio() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [styleRefs, setStyleRefs] = useState<string[]>([]);
  const [targetStyle, setTargetStyle] = useState("清新自然");
  const [targetPlatform, setTargetPlatform] = useState("小红书");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function goNext() {
    setError("");
    if (step === 1 && !photoUrl) {
      setError("请先上传待分析的照片");
      return;
    }
    if (step === 2 && styleRefs.length === 0) {
      setError("请至少上传 1 张风格参考图");
      return;
    }
    setStep(step + 1);
  }

  async function handleAnalyze() {
    if (!photoUrl || styleRefs.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const data = await previewAnalyze({
        image_url: photoUrl,
        style_reference_image_urls: styleRefs,
        target_style: targetStyle,
        target_platform: targetPlatform,
      });
      setAnalysis(data);
      setSaveTitle(`AI 分析 · ${targetStyle}`);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoUrl || !analysis?.analysis_report) return;
    setSaving(true);
    setError("");
    try {
      const result = await savePortfolioWithAnalysis({
        image_url: photoUrl,
        title: saveTitle.trim() || "未命名作品",
        target_style: targetStyle,
        target_platform: targetPlatform,
        analysis_report: analysis.analysis_report,
      });
      navigate(`/portfolio/${result.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleRestart() {
    setStep(1);
    setPhotoUrl(null);
    setStyleRefs([]);
    setAnalysis(null);
    setShowSaveForm(false);
    setError("");
  }

  return (
    <main className="container-page">
      <header className="animate-fade-up">
        <p className="section-eyebrow">AI Studio</p>
        <h1 className="page-title mt-2">先分析，满意再收藏</h1>
        <p className="mt-4 max-w-2xl text-muted leading-7">
          上传你的照片和喜欢的风格参考图，AI 给出修改建议与预期效果。满意后再保存到作品集。
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {steps.map((label, index) => {
          const num = index + 1;
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`step-dot ${isActive ? "step-dot-active" : isDone ? "step-dot-done" : "step-dot-pending"}`}>
                {num}
              </span>
              <span className={`text-sm ${isActive ? "text-ink" : "text-muted"}`}>{label}</span>
              {index < steps.length - 1 && <span className="mx-1 text-sand">·</span>}
            </div>
          );
        })}
      </div>

      <section className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          {photoUrl && step >= 2 && (
            <div className="photo-frame">
              <img className="w-full object-cover" src={getAssetUrl(photoUrl)} alt="待分析" />
            </div>
          )}
          {step === 1 && (
            <div className="card">
              <p className="section-eyebrow">Step 1</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">上传待分析照片</h2>
              <p className="mt-2 text-sm text-muted">这张照片还不会进入作品集，仅用于 AI 分析。</p>
              <div className="mt-6">
                <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {step === 1 && photoUrl && (
            <div className="card">
              <button className="btn-primary" type="button" onClick={goNext}>下一步：上传风格参考</button>
            </div>
          )}

          {step === 2 && (
            <div className="card animate-fade-up">
              <p className="section-eyebrow">Step 2</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">上传风格参考图</h2>
              <p className="mt-2 text-sm text-muted">上传你喜欢的风格样片，AI 会据此识别色调与氛围。</p>
              <div className="mt-6">
                <StyleReferenceUpload value={styleRefs} onChange={setStyleRefs} maxFiles={3} />
              </div>
              <div className="mt-6 flex gap-3">
                <button className="btn-secondary" type="button" onClick={() => setStep(1)}>上一步</button>
                <button className="btn-primary" type="button" onClick={goNext}>下一步</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card animate-fade-up">
              <p className="section-eyebrow">Step 3</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">确认分析设置</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">目标风格</label>
                  <select className="input" value={targetStyle} onChange={(e) => setTargetStyle(e.target.value)}>
                    {targetStyles.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">发布平台</label>
                  <select className="input" value={targetPlatform} onChange={(e) => setTargetPlatform(e.target.value)}>
                    {targetPlatforms.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="btn-secondary" type="button" onClick={() => setStep(2)}>上一步</button>
                <button className="btn-primary" type="button" onClick={goNext}>下一步</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="card animate-fade-up">
              <p className="section-eyebrow">Step 4</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">开始 AI 分析</h2>
              <div className="mt-5 space-y-2 text-sm text-muted">
                <p>目标风格：<span className="text-ink">{targetStyle}</span></p>
                <p>发布平台：<span className="text-ink">{targetPlatform}</span></p>
                <p>风格参考：<span className="text-ink">{styleRefs.length} 张</span></p>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="btn-secondary" type="button" onClick={() => setStep(3)}>上一步</button>
                <button className="btn-primary" type="button" onClick={handleAnalyze} disabled={loading}>
                  {loading ? "AI 分析中..." : "生成修改建议"}
                </button>
              </div>
            </div>
          )}

          {step === 5 && analysis && photoUrl && (
            <>
              <ExpectedEffectPreview
                imageUrl={photoUrl}
                targetStyle={targetStyle}
                description={analysis.expected_effect_description || "修图后将更接近你的目标风格。"}
                referenceUrls={analysis.style_reference_image_urls || styleRefs}
              />
              <BenchmarkOverview analysis={analysis} />
              <DimensionCards analysis={analysis} />
              <StylePanel analysis={analysis} />
              <AdvicePanel analysis={analysis} />
              <ParamsPanel analysis={analysis} />
              <PlatformPanel analysis={analysis} />

              <div className="card-soft">
                {!showSaveForm ? (
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary" type="button" onClick={() => setShowSaveForm(true)}>
                      满意，保存到作品集
                    </button>
                    <button className="btn-secondary" type="button" onClick={handleRestart}>重新分析</button>
                    <Link className="btn-ghost" to="/portfolio">暂不保存，查看作品集</Link>
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4">
                    <p className="font-display text-xl font-semibold">保存到作品集</p>
                    <div>
                      <label className="label">作品标题</label>
                      <input className="input" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} required />
                    </div>
                    <div className="flex gap-3">
                      <button className="btn-primary" type="submit" disabled={saving}>
                        {saving ? "保存中..." : "确认保存"}
                      </button>
                      <button className="btn-secondary" type="button" onClick={() => setShowSaveForm(false)}>取消</button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </section>
    </main>
  );
}
