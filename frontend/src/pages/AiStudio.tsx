import { FormEvent, useEffect, useState } from "react";
import { previewAnalyze } from "../api/analyze";
import { getAssetUrl } from "../api/client";
import { generateProcessedImage } from "../api/imageProcess";
import { listPortfolio, saveOriginalToPortfolio } from "../api/portfolio";
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
import type { PhotoAnalysis, PhotoTag, PortfolioCollection } from "../types";

const targetStyles = ["清新自然", "日系", "胶片感", "高级灰", "复古", "高饱和", "生活记录", "商业感"];
const targetPlatforms = ["小红书", "朋友圈", "Instagram", "作品集", "商业约拍"];
const steps = ["上传照片", "设置目标", "查看建议"];

export default function AiStudio() {
  const [step, setStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [styleRefs, setStyleRefs] = useState<string[]>([]);
  const [targetStyle, setTargetStyle] = useState("清新自然");
  const [targetPlatform, setTargetPlatform] = useState("小红书");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [collections, setCollections] = useState<PortfolioCollection[]>([]);
  const [collectionChoice, setCollectionChoice] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");

  useEffect(() => {
    listPortfolio()
      .then((data) => {
        setCollections(data);
        if (data[0]) setCollectionChoice(String(data[0].id));
      })
      .catch(() => setCollections([]));
  }, []);

  function goToSettings() {
    setError("");
    if (!photoUrl) {
      setError("请先上传待分析的照片");
      return;
    }
    setStep(2);
  }

  async function handleAnalyze() {
    if (!photoUrl) return;
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
      setSaveSuccess("");
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoUrl || !analysis) return;
    if (collectionChoice === "new" && !newCollectionName.trim()) {
      setError("请填写新作品集名称");
      return;
    }
    if (!collectionChoice) {
      setError("请选择一个作品集");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const tags: PhotoTag[] = [
        {
          tag_type: "content",
          name: analysis.photo_type,
          confidence: 1,
          source: "ai_analysis",
          model_version: analysis.model_used,
        },
        {
          tag_type: "style",
          name: analysis.detected_style,
          confidence: analysis.style_confidence,
          source: "ai_analysis",
          model_version: analysis.model_used,
        },
      ].filter((tag) => Boolean(tag.name));
      const result = await saveOriginalToPortfolio({
        image_url: photoUrl,
        title: "AI 分析原图",
        collection_id: collectionChoice === "new" ? undefined : Number(collectionChoice),
        collection_name: collectionChoice === "new" ? newCollectionName.trim() : undefined,
        tags,
      });
      if (collectionChoice === "new") {
        setCollections((current) => [result.collection, ...current]);
        setCollectionChoice(String(result.collection.id));
        setNewCollectionName("");
      }
      setShowSaveForm(false);
      setSaveSuccess(`原图已保存到“${result.collection.name}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateImage() {
    if (!photoUrl) return;
    setGeneratingImage(true);
    setError("");
    try {
      const result = await generateProcessedImage({
        image_url: photoUrl,
        target_style: targetStyle,
        target_platform: targetPlatform,
        analysis_guidance: [
          analysis?.summary,
          analysis?.composition_advice,
          analysis?.lighting_advice,
          analysis?.color_advice,
          analysis?.editing_params
            ? `Editing parameters: ${JSON.stringify(analysis.editing_params)}`
            : "",
          analysis?.platform_suggestions
            ? `Platform suggestions: ${JSON.stringify(analysis.platform_suggestions)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        edit_instruction: editInstruction.trim() || undefined,
        reference_image_urls: styleRefs,
      });
      setGeneratedImageUrl(result.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片生成失败，请稍后重试");
    } finally {
      setGeneratingImage(false);
    }
  }

  function handleRestart() {
    setStep(1);
    setPhotoUrl(null);
    setStyleRefs([]);
    setAnalysis(null);
    setGeneratedImageUrl(null);
    setEditInstruction("");
    setShowSaveForm(false);
    setSaveSuccess("");
    setError("");
  }

  return (
    <main className="container-page">
      <header className="animate-fade-up">
        <p className="section-eyebrow">AI Studio</p>
        <h1 className="page-title mt-2">先分析，再决定是否收藏原图</h1>
        <p className="mt-4 max-w-2xl text-muted leading-7">
          上传照片、选好目标风格，AI 给出修改建议与预期效果。作品集只保存你上传的原图和图片标签，不保存分析报告或 AI 效果图。
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
              <button className="btn-primary" type="button" onClick={goToSettings}>下一步：设置目标</button>
            </div>
          )}

          {step === 2 && (
            <div className="card animate-fade-up">
              <p className="section-eyebrow">Step 2</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">设置分析目标</h2>
              <p className="mt-2 text-sm text-muted">选择你想达成的风格和发布平台，AI 会据此给出建议。</p>

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

              <div className="mt-6">
                <label className="label">风格参考图（可选）</label>
                <p className="mb-3 text-xs text-muted">
                  没有也能分析。若上传你喜欢的样片，AI 会更精准地对齐色调与氛围。
                </p>
                <StyleReferenceUpload value={styleRefs} onChange={setStyleRefs} maxFiles={3} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn-secondary" type="button" onClick={() => setStep(1)}>上一步</button>
                <button className="btn-primary" type="button" onClick={handleAnalyze} disabled={loading}>
                  {loading ? "AI 分析中..." : "生成修改建议"}
                </button>
              </div>

              {loading && (
                <div className="mt-6 rounded-2xl bg-blush/30 p-5">
                  <div className="flex items-center gap-3 text-sm text-brand-deep">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    AI 正在对齐目标风格并生成建议，通常需要几十秒，请稍候…
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-sand" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-sand" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-sand" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && analysis && photoUrl && (
            <>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-muted">
                {analysis.analysis_mode === "api"
                  ? `\u771f\u5b9e AI \u5206\u6790 \u00b7 ${analysis.model_used}`
                  : "\u6a21\u62df\u5206\u6790\uff08\u4ec5\u5f00\u53d1\u6a21\u5f0f\uff09"}
              </div>

              <ExpectedEffectPreview
                imageUrl={photoUrl}
                generatedImageUrl={generatedImageUrl}
                targetStyle={targetStyle}
                description={analysis.expected_effect_description || ""}
                referenceUrls={analysis.style_reference_image_urls || styleRefs}
              />
              <div className="card-soft">
                <p className="section-eyebrow">真实 AI 修图</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">生成一张处理后的新图片</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  将调用真实图生图模型并消耗 API 额度。生成结果会保存到服务器，原图不会被覆盖。
                </p>
                <p className="mt-2 text-xs text-brand-deep">效果图仅供预览，不可直接加入作品集。</p>
                <div className="mt-4">
                  <label className="label">额外修改要求（可选）</label>
                  <textarea
                    className="input min-h-24"
                    value={editInstruction}
                    onChange={(event) => setEditInstruction(event.target.value)}
                    placeholder="例如：降低高光，保留自然肤色，增加一点胶片颗粒"
                    maxLength={600}
                  />
                </div>
                <button className="btn-primary mt-4" type="button" onClick={handleGenerateImage} disabled={generatingImage}>
                  {generatingImage ? "AI 正在生成图片，可能需要 1–2 分钟…" : generatedImageUrl ? "重新生成效果图" : "生成真实效果图"}
                </button>
              </div>
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
                      保存原图到作品集
                    </button>
                    <button className="btn-secondary" type="button" onClick={handleRestart}>重新分析</button>
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div>
                      <p className="font-display text-xl font-semibold">保存原图到作品集</p>
                      <p className="mt-2 text-sm text-muted">将保存原图和识别出的类型、风格标签，不保存评分、建议或 AI 效果图。</p>
                    </div>
                    <div>
                      <label className="label">选择作品集</label>
                      <select className="input" value={collectionChoice} onChange={(event) => setCollectionChoice(event.target.value)} required>
                        <option value="" disabled>请选择</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>{collection.name}（{collection.photo_count} 张）</option>
                        ))}
                        <option value="new">＋ 新建作品集</option>
                      </select>
                    </div>
                    {collectionChoice === "new" && (
                      <div>
                        <label className="label">新作品集名称</label>
                        <input
                          className="input"
                          value={newCollectionName}
                          onChange={(event) => setNewCollectionName(event.target.value)}
                          placeholder="例如：夏日街拍"
                          maxLength={120}
                          required
                        />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button className="btn-primary" type="submit" disabled={saving}>
                        {saving ? "保存中..." : "确认保存"}
                      </button>
                      <button className="btn-secondary" type="button" onClick={() => setShowSaveForm(false)}>取消</button>
                    </div>
                  </form>
                )}
                {saveSuccess && <p className="mt-4 text-sm text-brand-deep">{saveSuccess}</p>}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </section>
    </main>
  );
}
