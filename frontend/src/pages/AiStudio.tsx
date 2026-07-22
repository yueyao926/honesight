import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
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

function scrollToStep(ref: RefObject<HTMLElement>) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function StepSection({
  number,
  title,
  state,
  sectionRef,
  children,
}: {
  number: number;
  title: string;
  state: "active" | "done" | "pending";
  sectionRef: RefObject<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section ref={sectionRef} className={`studio-step studio-step-${state}`}>
      <div className="studio-step-rail" aria-label={`步骤 ${number}：${title}`}>
        <span className="studio-step-number">{number}</span>
        <span className="studio-step-label">{title}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

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
  const stepOneRef = useRef<HTMLElement>(null);
  const stepTwoRef = useRef<HTMLElement>(null);
  const stepThreeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    listPortfolio()
      .then((data) => {
        setCollections(data);
        if (data[0]) setCollectionChoice(String(data[0].id));
      })
      .catch(() => setCollections([]));
  }, []);

  function handlePhotoChange(url: string | null) {
    setPhotoUrl(url);
    setError("");
    if (!url) {
      setStep(1);
      setAnalysis(null);
      setGeneratedImageUrl(null);
      return;
    }
    setStep(2);
    setAnalysis(null);
    setGeneratedImageUrl(null);
    scrollToStep(stepTwoRef);
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
      scrollToStep(stepThreeRef);
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
    scrollToStep(stepOneRef);
  }

  return (
    <main className="container-page studio-page">
      <header className="animate-fade-up max-w-3xl">
        <p className="section-eyebrow">AI Studio</p>
        <h1 className="page-title mt-2">让照片更接近你想要的样子</h1>
        <p className="mt-3 text-muted">上传一张照片，获得针对性的拍摄与调色建议。</p>
      </header>

      <div className="studio-flow">
        <StepSection number={1} title={steps[0]} state={step > 1 ? "done" : "active"} sectionRef={stepOneRef}>
          <div className="card studio-step-card">
            <h2 className="font-display text-2xl font-semibold">选择照片</h2>
            <div className="mt-5">
              <PhotoUpload value={photoUrl} onChange={handlePhotoChange} />
            </div>
          </div>
        </StepSection>

        <StepSection
          number={2}
          title={steps[1]}
          state={step > 2 ? "done" : step === 2 ? "active" : "pending"}
          sectionRef={stepTwoRef}
        >
          {photoUrl ? (
            <div className="card studio-step-card animate-fade-up">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold">你想把它调整成什么样？</h2>
                  <p className="mt-2 text-sm text-muted">选择目标，AI 会据此分析照片。</p>
                </div>
                <img className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-4 ring-white" src={getAssetUrl(photoUrl)} alt="已上传照片" />
              </div>

              <fieldset className="mt-7">
                <legend className="label">目标风格</legend>
                <div className="choice-grid">
                  {targetStyles.map((style) => (
                    <button
                      key={style}
                      className={`choice-chip ${targetStyle === style ? "choice-chip-active" : ""}`}
                      type="button"
                      aria-pressed={targetStyle === style}
                      onClick={() => setTargetStyle(style)}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-7">
                <legend className="label">发布平台</legend>
                <div className="choice-grid">
                  {targetPlatforms.map((platform) => (
                    <button
                      key={platform}
                      className={`choice-chip ${targetPlatform === platform ? "choice-chip-active" : ""}`}
                      type="button"
                      aria-pressed={targetPlatform === platform}
                      onClick={() => setTargetPlatform(platform)}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-7 border-t border-sand/70 pt-6">
                <div className="mb-4">
                  <p className="label mb-1">参考图（可选）</p>
                  <p className="text-xs text-muted">添加喜欢的样片，让建议更接近你的目标。</p>
                </div>
                <StyleReferenceUpload value={styleRefs} onChange={setStyleRefs} maxFiles={3} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button className="btn-primary" type="button" onClick={handleAnalyze} disabled={loading}>
                  {loading ? "正在分析…" : analysis ? "重新分析" : "开始分析"}
                </button>
                <button className="btn-ghost" type="button" onClick={() => scrollToStep(stepOneRef)}>更换照片</button>
              </div>

              {loading && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-blush/35 px-4 py-3 text-sm text-brand-deep" role="status">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  正在分析画面与目标风格…
                </div>
              )}
              {error && step === 2 && <p className="mt-4 text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="studio-step-placeholder">上传照片后，这里会自动展开。</div>
          )}
        </StepSection>

        <StepSection number={3} title={steps[2]} state={step === 3 ? "active" : "pending"} sectionRef={stepThreeRef}>
          {analysis && photoUrl ? (
            <div className="space-y-5 animate-fade-up">
              <BenchmarkOverview analysis={analysis} />
              <ExpectedEffectPreview
                imageUrl={photoUrl}
                generatedImageUrl={generatedImageUrl}
                targetStyle={targetStyle}
                description={analysis.expected_effect_description || ""}
                referenceUrls={analysis.style_reference_image_urls || styleRefs}
              />
              <DimensionCards analysis={analysis} />
              <AdvicePanel analysis={analysis} />
              <ParamsPanel analysis={analysis} />
              <StylePanel analysis={analysis} />
              <PlatformPanel analysis={analysis} />
              <div className="card-soft">
                <p className="section-eyebrow">生成效果图</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">看看调整后的样子</h2>
                <div className="mt-4">
                  <label className="label">补充要求（可选）</label>
                  <textarea
                    className="input min-h-24"
                    value={editInstruction}
                    onChange={(event) => setEditInstruction(event.target.value)}
                    placeholder="例如：降低高光，保留自然肤色，增加一点胶片颗粒"
                    maxLength={600}
                  />
                </div>
                <button className="btn-primary mt-4" type="button" onClick={handleGenerateImage} disabled={generatingImage}>
                  {generatingImage ? "正在生成，可能需要 1–2 分钟…" : generatedImageUrl ? "重新生成" : "生成效果图"}
                </button>
              </div>

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
              {error && step === 3 && <p className="text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="studio-step-placeholder">完成设置并开始分析后，结果会出现在这里。</div>
          )}
        </StepSection>
      </div>
    </main>
  );
}
