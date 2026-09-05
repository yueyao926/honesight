import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  startAnalysisDetails,
  startPreviewAnalysis,
  startQuickAnalysis,
  waitForAnalysisJob,
} from "../api/analyze";
import type { QuickAnalysis } from "../api/analyze";
import { getAssetUrl } from "../api/client";
import {
  startProcessedImageJob,
  waitForProcessedImageJob,
} from "../api/imageProcess";
import type { ImageProcessJob } from "../api/imageProcess";
import { listPortfolio, savePhotoToPortfolio } from "../api/portfolio";
import type { PortfolioPhotoSource } from "../api/portfolio";
import {
  AdvicePanel,
  BenchmarkOverview,
  DimensionCards,
  EditingDetailsPanel,
} from "../components/analysis/AnalysisPanels";
import PhotoUpload from "../components/PhotoUpload";
import StyleReferenceUpload from "../components/StyleReferenceUpload";
import StudioAdvicePager, { type StudioAdvicePage } from "../components/studio/StudioAdvicePager";
import SquigglyText from "../components/ui/SquigglyText";
import archerySvg from "../SVG/archery.svg?url";
import peep5Svg from "../SVG/5.svg?url";
import thumbsUpSvg from "../SVG/大拇指.svg?url";
import misc14Svg from "../SVG/misc-14.svg?url";
import misc22Svg from "../SVG/misc-22.svg?url";
import puzzledSvg from "../SVG/emoji-puzzled.svg?url";
import wrenchSvg from "../SVG/扳手.svg?url";
import type { PhotoAnalysis, PhotoTag, PortfolioCollection } from "../types";

const targetStyles = [
  "清新自然",
  "明亮通透",
  "日系清透",
  "韩系柔光",
  "胶片质感",
  "电影感",
  "复古怀旧",
  "港风",
  "法式浪漫",
  "森系",
  "莫兰迪",
  "高级灰",
  "低饱和",
  "高饱和",
  "暗调情绪",
  "黑白纪实",
  "纪实街拍",
  "人像写真",
  "生活记录",
  "商业质感",
  "赛博朋克",
  "极简主义",
];
const targetPlatforms = [
  "小红书",
  "微信朋友圈",
  "抖音",
  "微博",
  "Instagram",
  "作品集",
  "个人网站",
  "商业约拍",
];
const steps = ["上传照片", "设置目标", "查看建议"];
const ANALYSIS_GUIDANCE_MAX_LENGTH = 8000;
const EDIT_INSTRUCTION_MAX_LENGTH = 600;

type SaveCandidate = {
  imageUrl: string;
  source: PortfolioPhotoSource;
  title: string;
};

type GeneratedImage = {
  imageUrl: string;
  thumbnailUrl?: string;
  editingStrategy?: string;
};

const sourceLabels: Record<PortfolioPhotoSource, string> = {
  ai_original: "原图",
  ai_refined: "AI 精修图",
  user_improved: "改进后的作品",
};

function scrollToStep(ref: RefObject<HTMLElement>) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function joinLatestInstructions(instructions: string[], maxLength: number): string {
  const selected: string[] = [];
  let remaining = maxLength;
  for (let index = instructions.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const separatorLength = selected.length ? 1 : 0;
    const available = remaining - separatorLength;
    if (available <= 0) break;
    const instruction = instructions[index].trim();
    if (!instruction) continue;
    selected.unshift(instruction.length <= available ? instruction : instruction.slice(-available));
    remaining -= Math.min(instruction.length, available) + separatorLength;
  }
  return selected.join("；");
}

function imageProcessStageLabel(job: ImageProcessJob): string {
  const labels: Record<string, string> = {
    queued: "精修任务正在排队…",
    preparing: "正在准备原图与精修方案…",
    strategizing: "正在整理精修方案…",
    generating: "AI 正在生成精修图片…",
    downloading: "图片已生成，正在下载…",
    saving: "正在保存精修图片…",
    completed: "AI 精修完成",
  };
  return labels[job.stage] || (job.status === "processing" ? "AI 正在精修图片…" : "正在准备精修任务…");
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
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);
  const [saveCandidate, setSaveCandidate] = useState<SaveCandidate | null>(null);
  const [collections, setCollections] = useState<PortfolioCollection[]>([]);
  const [collectionChoice, setCollectionChoice] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [analysisStage, setAnalysisStage] = useState("正在准备分析…");
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedGeneratedImageUrl, setSelectedGeneratedImageUrl] = useState<string | null>(null);
  const [refinementInstructions, setRefinementInstructions] = useState<string[]>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [improvedPhotoUrl, setImprovedPhotoUrl] = useState<string | null>(null);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());
  const stepOneRef = useRef<HTMLElement>(null);
  const stepTwoRef = useRef<HTMLElement>(null);
  const stepThreeRef = useRef<HTMLElement>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const detailsControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const analysisRequestIdRef = useRef(0);
  const generationRequestIdRef = useRef(0);
  const generationInFlightRef = useRef(false);

  useEffect(() => {
    listPortfolio()
      .then((data) => {
        setCollections(data);
        setCollectionChoice(data[0] ? String(data[0].id) : "new");
      })
      .catch(() => setCollections([]));

    return () => {
      analysisControllerRef.current?.abort();
      detailsControllerRef.current?.abort();
      generationRequestIdRef.current += 1;
      generationControllerRef.current?.abort();
      generationInFlightRef.current = false;
    };
  }, []);

  function cancelAnalysis() {
    analysisRequestIdRef.current += 1;
    analysisControllerRef.current?.abort();
    detailsControllerRef.current?.abort();
    analysisControllerRef.current = null;
    detailsControllerRef.current = null;
    setLoading(false);
    setDeepLoading(false);
    setDetailsLoading(false);
    setDetailsError("");
    setAnalysisStage("正在准备分析…");
  }

  function cancelGeneration() {
    generationRequestIdRef.current += 1;
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    generationInFlightRef.current = false;
    setGeneratingImage(false);
    setGenerationStage("");
  }

  function handlePhotoChange(url: string | null) {
    cancelAnalysis();
    cancelGeneration();
    setPhotoUrl(url);
    setError("");
    setGenerationError("");
    if (!url) {
      setStep(1);
      setAnalysis(null);
      setQuickAnalysis(null);
      setGeneratedImages([]); setExpandedStrategies(new Set());
      setSelectedGeneratedImageUrl(null);
      setRefinementInstructions([]);
      return;
    }
    setStep(2);
    setAnalysis(null);
    setQuickAnalysis(null);
    setGeneratedImages([]); setExpandedStrategies(new Set());
    setSelectedGeneratedImageUrl(null);
    setRefinementInstructions([]);
    scrollToStep(stepTwoRef);
  }

  function handleTargetStyleChange(value: string) {
    setTargetStyle(value);
    invalidateAnalysis();
  }

  function handleTargetPlatformChange(value: string) {
    setTargetPlatform(value);
    invalidateAnalysis();
  }

  function handleStyleRefsChange(urls: string[]) {
    setStyleRefs(urls);
    invalidateAnalysis();
  }

  function invalidateAnalysis() {
    cancelAnalysis();
    cancelGeneration();
    if (analysis) setStep(2);
    setAnalysis(null);
    setQuickAnalysis(null);
    setGeneratedImages([]); setExpandedStrategies(new Set());
    setSelectedGeneratedImageUrl(null);
    setRefinementInstructions([]);
    setEditInstruction("");
    setError("");
    setGenerationError("");
  }

  async function handleAnalyze() {
    if (!photoUrl) return;
    analysisControllerRef.current?.abort();
    detailsControllerRef.current?.abort();
    detailsControllerRef.current = null;
    const controller = new AbortController();
    const requestId = ++analysisRequestIdRef.current;
    analysisControllerRef.current = controller;
    setLoading(true);
    setDeepLoading(true);
    setDetailsLoading(false);
    setQuickAnalysis(null);
    setAnalysis(null);
    setDetailsError("");
    setAnalysisStage("正在准备分析…");
    setError("");
    const payload = {
      image_url: photoUrl,
      style_reference_image_urls: styleRefs,
      target_style: targetStyle,
      target_platform: targetPlatform,
    };
    let quickSettled = false;
    let showedAnyResult = false;
    const showResultStep = () => {
      setStep(3);
      if (!showedAnyResult) scrollToStep(stepThreeRef);
      showedAnyResult = true;
    };

    try {
      const quickTask = (async (): Promise<Error | null> => {
        try {
          const quickJob = await startQuickAnalysis(payload, controller.signal);
          const quick = await waitForAnalysisJob(quickJob, controller.signal, (current) => {
            const labels: Record<string, string> = {
              preparing: "正在准备照片…",
              queued: "正在等待快速分析…",
              quick_analyzing: "正在快速评估曝光、对焦、构图与色彩…",
              completed: current.cache_hit ? "已找到相同照片的快速评分" : "四项快速评分完成",
            };
            setAnalysisStage(labels[current.stage] || "正在快速分析…");
          }, { maxWaitMs: 60_000 });
          if (requestId !== analysisRequestIdRef.current) return null;
          setQuickAnalysis(quick);
          setSaveSuccess("");
          showResultStep();
          return null;
        } catch (quickError) {
          if (quickError instanceof DOMException && quickError.name === "AbortError") return null;
          if (requestId !== analysisRequestIdRef.current) return null;
          setAnalysisStage("快速评分未返回，详细分析仍在后台继续…");
          return quickError instanceof Error ? quickError : new Error("快速分析失败");
        } finally {
          quickSettled = true;
          if (requestId === analysisRequestIdRef.current) setLoading(false);
        }
      })();

      const fullTask = (async (): Promise<Error | null> => {
        try {
          const fullJob = await startPreviewAnalysis(payload, controller.signal);
          const data = await waitForAnalysisJob(fullJob, controller.signal, (current) => {
            if (!quickSettled) return;
            const labels: Record<string, string> = {
              preparing: "正在准备详细分析…",
              queued: "详细分析正在排队…",
              analyzing: "快速评分已完成，正在补充四项依据与建议…",
              organizing: "正在整理拍摄建议…",
              completed: current.cache_hit ? "已读取详细分析" : "详细分析完成",
            };
            setAnalysisStage(labels[current.stage] || "正在补充详细分析…");
          }, { maxWaitMs: 330_000 });
          if (requestId !== analysisRequestIdRef.current) return null;
          setAnalysis(data);
          showResultStep();
          void loadAnalysisDetails(data, requestId);
          return null;
        } catch (fullError) {
          if (fullError instanceof DOMException && fullError.name === "AbortError") return null;
          if (requestId !== analysisRequestIdRef.current) return null;
          return fullError instanceof Error ? fullError : new Error("详细分析失败");
        } finally {
          if (requestId === analysisRequestIdRef.current) setDeepLoading(false);
        }
      })();

      const [quickError, fullError] = await Promise.all([quickTask, fullTask]);
      if (requestId !== analysisRequestIdRef.current) return;
      if (quickError && fullError) {
        setError(fullError.message || quickError.message || "分析失败，请稍后重试");
      }
    } finally {
      if (requestId === analysisRequestIdRef.current) {
        analysisControllerRef.current = null;
        setLoading(false);
        setDeepLoading(false);
      }
    }
  }

  function handleLoadDetails() {
    if (!analysis) return;
    void loadAnalysisDetails(analysis, analysisRequestIdRef.current);
  }

  async function loadAnalysisDetails(coreAnalysis: PhotoAnalysis, requestId: number) {
    if (!photoUrl || detailsLoading || detailsControllerRef.current) return;
    const controller = new AbortController();
    detailsControllerRef.current = controller;
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const job = await startAnalysisDetails({
        image_url: photoUrl,
        target_style: targetStyle,
        target_platform: targetPlatform,
        analysis_summary: JSON.stringify({
          summary: coreAnalysis.summary,
          benchmark: coreAnalysis.benchmark_detail,
          composition_advice: coreAnalysis.composition_advice,
          lighting_advice: coreAnalysis.lighting_advice,
          color_advice: coreAnalysis.color_advice,
          next_step: coreAnalysis.next_step,
        }),
      }, controller.signal);
      const details = await waitForAnalysisJob(job, controller.signal, () => undefined, { maxWaitMs: 60_000 });
      if (requestId !== analysisRequestIdRef.current) return;
      setAnalysis((current) => current ? {
        ...current,
        editing_params: details.editing_params,
        platform_suggestions: details.platform_suggestions,
      } : current);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId !== analysisRequestIdRef.current) return;
      setDetailsError(err instanceof Error ? err.message : "详细参数生成失败，请稍后重试");
    } finally {
      if (detailsControllerRef.current === controller) {
        detailsControllerRef.current = null;
        setDetailsLoading(false);
      }
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saveCandidate) return;
    if (collectionChoice === "new" && !newCollectionName.trim()) {
      setSaveError("请填写新作品集名称");
      return;
    }
    if (!collectionChoice) {
      setSaveError("请选择一个作品集");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const tags: PhotoTag[] = analysis ? [
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
      ].filter((tag) => Boolean(tag.name)) : [];
      const result = await savePhotoToPortfolio({
        image_url: saveCandidate.imageUrl,
        source: saveCandidate.source,
        title: saveCandidate.title,
        collection_id: collectionChoice === "new" ? undefined : Number(collectionChoice),
        collection_name: collectionChoice === "new" ? newCollectionName.trim() : undefined,
        tags,
      });
      if (collectionChoice === "new") {
        setCollections((current) => [result.collection, ...current]);
        setCollectionChoice(String(result.collection.id));
        setNewCollectionName("");
      }
      setSaveCandidate(null);
      if (saveCandidate.source === "user_improved") {
        setImprovedPhotoUrl(null);
      }
      setSaveSuccess(`${sourceLabels[saveCandidate.source]}已保存到“${result.collection.name}”`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function openSaveCandidate(candidate: SaveCandidate) {
    setSaveError("");
    setSaveSuccess("");
    setSaveCandidate(candidate);
  }

  function handleImprovedPhotoChange(imageUrl: string | null) {
    setImprovedPhotoUrl(imageUrl);
    if (imageUrl) {
      openSaveCandidate({
        imageUrl,
        source: "user_improved",
        title: "改进后的作品",
      });
    }
  }

  function closeSaveDialog() {
    if (saveCandidate?.source === "user_improved") setImprovedPhotoUrl(null);
    setSaveCandidate(null);
    setSaveError("");
  }

  async function handleGenerateImage() {
    if (!photoUrl || generationInFlightRef.current) return;
    const currentInstruction = editInstruction.trim();
    if (generatedImages.length > 0 && !currentInstruction) return;
    const controller = new AbortController();
    const requestId = ++generationRequestIdRef.current;
    generationControllerRef.current = controller;
    generationInFlightRef.current = true;
    setGeneratingImage(true);
    setGenerationStage("正在准备精修任务…");
    setGenerationError("");
    try {
      const analysisGuidance = [
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
        .join("\n")
        .slice(0, ANALYSIS_GUIDANCE_MAX_LENGTH);
      const combinedInstruction = joinLatestInstructions(
        [...refinementInstructions, currentInstruction],
        EDIT_INSTRUCTION_MAX_LENGTH,
      );
      const job = await startProcessedImageJob({
        image_url: photoUrl,
        target_style: targetStyle,
        target_platform: targetPlatform,
        analysis_guidance: analysisGuidance,
        edit_instruction: combinedInstruction || undefined,
        reference_image_urls: styleRefs,
      }, controller.signal);
      const result = await waitForProcessedImageJob(
        job,
        controller.signal,
        (current) => {
          if (requestId !== generationRequestIdRef.current) return;
          setGenerationStage(imageProcessStageLabel(current));
        },
        { maxWaitMs: 8 * 60_000, maxConsecutivePollErrors: 4 },
      );
      if (requestId !== generationRequestIdRef.current) return;
      setGeneratedImages((current) => [...current, { imageUrl: result.image_url, thumbnailUrl: result.thumbnail_url, editingStrategy: result.editing_strategy }]);
      setSelectedGeneratedImageUrl(result.image_url);
      if (currentInstruction) {
        setRefinementInstructions((current) => [...current, currentInstruction]);
      }
      setEditInstruction("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId !== generationRequestIdRef.current) return;
      setGenerationError(err instanceof Error ? err.message : "图片生成失败，请稍后重试");
    } finally {
      if (requestId === generationRequestIdRef.current) {
        generationControllerRef.current = null;
        generationInFlightRef.current = false;
        setGeneratingImage(false);
        setGenerationStage("");
      }
    }
  }

  function handleAnotherPhoto() {
    cancelAnalysis();
    cancelGeneration();
    setStep(1);
    setPhotoUrl(null);
    setStyleRefs([]);
    setAnalysis(null);
    setQuickAnalysis(null);
    setGeneratedImages([]); setExpandedStrategies(new Set());
    setSelectedGeneratedImageUrl(null);
    setRefinementInstructions([]);
    setEditInstruction("");
    setSaveCandidate(null);
    setSaveSuccess("");
    setSaveError("");
    setImprovedPhotoUrl(null);
    setError("");
    setGenerationError("");
    scrollToStep(stepOneRef);
  }

  const advicePages: StudioAdvicePage[] = [];

  if (quickAnalysis) {
    advicePages.push({
      id: "quick",
      content: (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="studio-section-heading">
                <span className="studio-section-loader" aria-hidden="true" />
                <p className="section-eyebrow">先看这一点</p>
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold">{quickAnalysis.priority_issue}</h2>
            </div>
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
              {quickAnalysis.primary_ability}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="快速四项评分">
            {([
              ["曝光", quickAnalysis.exposure_score],
              ["对焦", quickAnalysis.focus_score],
              ["构图", quickAnalysis.composition_score],
              ["色彩", quickAnalysis.color_score],
            ] as const).map(([label, score]) => (
              <div key={label} className="studio-metric-chip">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-ink">{score}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">{quickAnalysis.summary}</p>
          <div className="studio-insight-panel studio-insight-panel--with-mark mt-4">
            <img src={misc22Svg} alt="" aria-hidden="true" className="studio-insight-panel__mark" draggable={false} />
            <div className="studio-insight-panel__copy">
              <p className="text-xs font-medium text-ink">现在可以先这样拍</p>
              <p className="mt-1 text-sm leading-7 text-ink">{quickAnalysis.suggestion}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {quickAnalysis.photo_type} · {quickAnalysis.detected_style || "风格识别中"}
            {quickAnalysis.elapsed_ms > 0 ? ` · ${(quickAnalysis.elapsed_ms / 1000).toFixed(1)} 秒` : ""}
          </p>
        </>
      ),
    });
  }

  if (analysis) {
    advicePages.push({
      id: "benchmark",
      content: <BenchmarkOverview analysis={analysis} targetPlatform={targetPlatform} />,
    });
    advicePages.push({
      id: "dimensions",
      content: <DimensionCards analysis={analysis} />,
    });
    advicePages.push({
      id: "advice",
      content: <AdvicePanel analysis={analysis} />,
    });
    advicePages.push({
      id: "details",
      content: (
        <EditingDetailsPanel
          analysis={analysis}
          targetPlatform={targetPlatform}
          detailsLoading={detailsLoading}
          detailsError={detailsError}
          onLoadDetails={handleLoadDetails}
        />
      ),
    });
  }

  if (generatedImages.length > 0) {
    advicePages.push({
      id: "generated",
      content: (
        <>
          <p className="section-eyebrow text-ink">生成结果</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">AI 精修版本</h2>
          <p className="mt-2 text-sm text-ink/70">点击选择想要保存的版本。</p>
          <div className="mt-5 flex flex-wrap gap-4">
            {generatedImages.map((gen, index) => {
              const isExpanded = expandedStrategies.has(gen.imageUrl);
              return (
                <div key={gen.imageUrl} className={`${isExpanded && gen.editingStrategy ? "flex w-full flex-col gap-4 md:flex-row" : "w-72"}`}>
                  {isExpanded && gen.editingStrategy && (
                    <div className="studio-insight-panel flex-1 p-5 text-sm leading-7 text-ink md:order-first">
                      <p className="mb-2 text-xs font-medium text-ink">AI 修图思路</p>
                      <div className="max-h-80 overflow-y-auto whitespace-pre-line">{gen.editingStrategy}</div>
                    </div>
                  )}
                  <div className={isExpanded && gen.editingStrategy ? "w-full md:w-72 md:shrink-0" : ""}>
                    <div className={`cursor-pointer overflow-hidden rounded-3xl ${selectedGeneratedImageUrl === gen.imageUrl ? "ring-2 ring-ink" : ""}`} onClick={() => setSelectedGeneratedImageUrl(gen.imageUrl)}>
                      <img className="aspect-[4/5] w-full object-cover" src={getAssetUrl(gen.thumbnailUrl || gen.imageUrl)} alt={`AI 精修 ${index + 1}`} loading="lazy" decoding="async" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted">版本 {index + 1}</span>
                      <div className="flex items-center gap-2">
                        {gen.editingStrategy && (
                          <button
                            className="btn-ghost px-2 py-1 text-xs"
                            type="button"
                            onClick={() => setExpandedStrategies((prev) => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(gen.imageUrl) : next.add(gen.imageUrl);
                              return next;
                            })}
                          >
                            {isExpanded ? "收起思路 ▲" : "查看修图思路 ▼"}
                          </button>
                        )}
                        <button
                          className="btn-secondary px-3 py-1 text-xs"
                          type="button"
                          onClick={() => openSaveCandidate({
                            imageUrl: gen.imageUrl,
                            source: "ai_refined",
                            title: `AI 精修 ${index + 1}`,
                          })}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ),
    });
  }

  advicePages.push({
    id: "refine",
    content: (
      <>
        <div className="studio-section-heading">
          <img src={thumbsUpSvg} alt="" aria-hidden="true" className="studio-section-mark studio-section-mark--lg" draggable={false} />
          <p className="section-eyebrow text-ink">AI 精修</p>
        </div>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {generatedImages.length ? "继续告诉 AI 你想怎么改" : "让 AI 完成细节处理"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          {generatedImages.length
            ? "新的要求会与之前的要求一起应用，并保留已有版本。"
            : "AI 会结合目标风格、平台和分析建议完成第一次精修。"}
        </p>
        <div className="mt-4">
          <label className="label text-ink">{generatedImages.length ? "新的修改要求" : "补充要求（可选）"}</label>
          <textarea
            className="input ink-focus-frame min-h-24"
            value={editInstruction}
            onChange={(event) => setEditInstruction(event.target.value)}
            placeholder={generatedImages.length
              ? "例如：再降低一点高光，让肤色更自然"
              : "例如：降低高光，保留自然肤色，增加一点胶片颗粒"}
            maxLength={600}
            disabled={generatingImage}
          />
        </div>
        {refinementInstructions.length > 0 && (
          <div className="studio-insight-panel mt-4">
            <p className="text-xs font-medium text-ink">已应用的要求</p>
            <ol className="mt-2 space-y-1 text-sm text-ink">
              {refinementInstructions.map((instruction, index) => (
                <li key={`${instruction}-${index}`}>{index + 1}. {instruction}</li>
              ))}
            </ol>
          </div>
        )}
        <button
          className="btn-primary btn-primary--ink mt-4"
          type="button"
          onClick={handleGenerateImage}
          disabled={generatingImage || (generatedImages.length > 0 && !editInstruction.trim())}
        >
          {generatingImage
            ? generationStage || "AI 正在精修，可能需要 1–5 分钟…"
            : generatedImages.length ? "生成新版本" : "开始 AI 精修"}
        </button>
        {generatingImage && (
          <p className="mt-2 text-xs text-ink/70" role="status">任务已提交，页面会自动等待结果，请不要重复点击。</p>
        )}
        {generatedImages.length > 0 && !editInstruction.trim() && (
          <p className="mt-2 text-xs text-ink/70">写下新的修改要求后即可继续精修。</p>
        )}
        {generationError && (
          <p className="mt-3 text-sm text-red-500" role="alert">{generationError}</p>
        )}
      </>
    ),
  });

  advicePages.push({
    id: "upload",
    content: (
      <>
        <div className="studio-section-heading">
          <img src={misc14Svg} alt="" aria-hidden="true" className="studio-section-mark studio-section-mark--lg" draggable={false} />
          <p className="section-eyebrow text-ink">上传改进作品</p>
        </div>
        <h2 className="mt-1 font-display text-2xl font-semibold">把你根据建议调整后的照片加入作品集</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">你可以在其他修图工具中实践这些建议，再把最终作品上传回来留档。</p>
        <div className="mt-5 max-w-xl">
          <PhotoUpload value={improvedPhotoUrl} onChange={handleImprovedPhotoChange} label="上传改进后的照片" purpose="portfolio" outlineOnly />
        </div>
        <button className="btn-ghost mt-5 text-ink hover:bg-transparent hover:text-ink" type="button" onClick={handleAnotherPhoto}>再来一张</button>
      </>
    ),
  });

  const advicePagerResetKey = `${photoUrl ?? ""}|${analysis?.id ?? "none"}|${quickAnalysis?.priority_issue ?? "none"}`;

  return (
    <main className="handwriting-page container-page studio-page">
      <header className="animate-fade-up max-w-3xl">
        <p className="section-eyebrow">AI Studio</p>
        <h1 className="page-title messages-page-title mt-2">
          让照片更接近你想要的样子
          <img src={wrenchSvg} alt="" aria-hidden="true" className="studio-title-mark" />
        </h1>
        <p className="mt-3 text-muted">
          <SquigglyText as="span" stepDuration={70} scale={[2, 3.5]} baseFrequency={0.018}>
            上传一张照片，获得针对性的拍摄与调色建议。
          </SquigglyText>
        </p>
      </header>

      <div className="studio-flow">
        <StepSection number={1} title={steps[0]} state={step > 1 ? "done" : "active"} sectionRef={stepOneRef}>
          <div className="studio-step-card studio-step-card--with-peep">
            <div className="studio-step-card-body">
              <h2 className="studio-section-title font-display text-2xl font-semibold">
                <img src={archerySvg} alt="" aria-hidden="true" className="studio-section-mark" />
                选择照片
              </h2>
              <div className="mt-5">
                <PhotoUpload value={photoUrl} onChange={handlePhotoChange} purpose="analysis" outlineOnly />
                <p className="mt-3 text-xs text-muted">未保存的照片将在72小时后自动清理；需要长期保留可存入作品集。</p>
              </div>
            </div>
            <img src={peep5Svg} alt="" aria-hidden="true" draggable={false} className="studio-step-peep" />
          </div>
        </StepSection>

        <StepSection
          number={2}
          title={steps[1]}
          state={step > 2 ? "done" : step === 2 ? "active" : "pending"}
          sectionRef={stepTwoRef}
        >
          {photoUrl ? (
            <div className="studio-step-card animate-fade-up">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="studio-section-title font-display text-2xl font-semibold">
                    <img src={puzzledSvg} alt="" aria-hidden="true" className="studio-section-mark" />
                    你想把它调整成什么样？
                  </h2>
                  <p className="mt-2 text-sm text-muted">选择目标，AI 会据此分析照片。</p>
                </div>
                <div className="flex items-center gap-3">
                  <img className="h-20 w-20 shrink-0 rounded-2xl object-cover" src={getAssetUrl(photoUrl)} alt="已上传照片" />
                  <button
                    className="btn-ghost text-xs"
                    type="button"
                    onClick={() => openSaveCandidate({ imageUrl: photoUrl, source: "ai_original", title: "原图" })}
                  >
                    保存原图
                  </button>
                </div>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="label">目标风格</span>
                  <select className="input ink-focus-frame" value={targetStyle} onChange={(event) => handleTargetStyleChange(event.target.value)}>
                    {targetStyles.map((style) => <option key={style} value={style}>{style}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label">发布平台</span>
                  <select className="input ink-focus-frame" value={targetPlatform} onChange={(event) => handleTargetPlatformChange(event.target.value)}>
                    {targetPlatforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-7 border-t border-sand/70 pt-6">
                <div className="mb-4">
                  <p className="label mb-1 text-ink">参考图（可选）</p>
                  <p className="text-xs text-ink/70">添加样片作为风格参考，AI 分析与精修会参考它们。</p>
                </div>
                <StyleReferenceUpload value={styleRefs} onChange={handleStyleRefsChange} maxFiles={3} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button className="btn-primary btn-primary--ink" type="button" onClick={handleAnalyze} disabled={loading || deepLoading}>
                  {loading ? "正在快速分析…" : deepLoading ? "正在补充详细分析…" : analysis || quickAnalysis ? "重新分析" : "开始分析"}
                </button>
                <button className="btn-ghost text-ink hover:bg-transparent hover:text-ink" type="button" onClick={() => handlePhotoChange(null)}>更换照片</button>
              </div>

              {(loading || deepLoading) && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-blush/35 px-4 py-3 text-sm text-ink" role="status">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <span>{analysisStage}</span>
                  <span className="ml-auto text-xs text-ink/70">分析会在后台继续</span>
                </div>
              )}
              {error && step === 2 && <p className="mt-4 text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="studio-step-placeholder">上传照片后，这里会自动展开。</div>
          )}
        </StepSection>

        <StepSection number={3} title={steps[2]} state={step === 3 ? "active" : "pending"} sectionRef={stepThreeRef}>
          {(quickAnalysis || analysis) && photoUrl ? (
            <div className="animate-fade-up">
              {deepLoading && quickAnalysis && !analysis && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl bg-blush/35 px-4 py-3 text-sm text-ink" role="status">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <span>{analysisStage}</span>
                  <span className="ml-auto text-xs text-ink/70">四项快速评分已可查看</span>
                </div>
              )}

              {detailsLoading && analysis && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl bg-blush/35 px-4 py-3 text-sm text-ink" role="status">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  <span>正在后台补充修图参数与发布建议…</span>
                  <span className="ml-auto text-xs text-ink/70">四维核心结果已可查看</span>
                </div>
              )}

              <StudioAdvicePager pages={advicePages} resetKey={advicePagerResetKey} />

              {error && step === 3 && <p className="mt-4 text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="studio-step-placeholder">完成设置并开始分析后，结果会出现在这里。</div>
          )}
        </StepSection>
      </div>

      {saveSuccess && (
        <div className="fixed right-5 top-24 z-[75] rounded-2xl bg-ink px-5 py-3 text-sm text-white shadow-card" role="status">
          {saveSuccess}
        </div>
      )}

      {saveCandidate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/65 p-4" role="dialog" aria-modal="true" aria-labelledby="save-photo-title">
          <form className="card w-full max-w-lg space-y-4" onSubmit={handleSave}>
            <div>
              <p className="section-eyebrow">保存作品</p>
              <h2 id="save-photo-title" className="mt-1 font-display text-2xl font-semibold">保存{sourceLabels[saveCandidate.source]}</h2>
              <p className="mt-2 text-sm text-muted">选择已有作品集，或新建一个作品集。</p>
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
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            <div className="flex gap-3">
              <button className="btn-primary btn-primary--ink" type="submit" disabled={saving}>{saving ? "保存中..." : "确认保存"}</button>
              <button className="btn-secondary ink-focus-frame text-ink hover:border-ink" type="button" onClick={closeSaveDialog} disabled={saving}>取消</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
