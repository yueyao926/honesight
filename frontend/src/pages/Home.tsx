import { Link } from "react-router-dom";
import DailyInspirationSection from "../components/DailyInspirationSection";
import { useAuth } from "../contexts/AuthContext";

const productSteps = [
  {
    number: "01",
    title: "先看见方向",
    description: "选好目标风格和发布平台，先得到一版快速预览，不必等待分析也能判断方向。",
    accent: "bg-rose/35",
  },
  {
    number: "02",
    title: "再看懂照片",
    description: "从构图、光线、色彩和对焦四个维度，找到真正影响画面表达的关键问题。",
    accent: "bg-sand",
  },
  {
    number: "03",
    title: "按你的想法精修",
    description: "带上参考图或直接告诉 AI 新想法，在初步效果上继续调整，而不是被固定模板限制。",
    accent: "bg-blush/55",
  },
  {
    number: "04",
    title: "留下每次进步",
    description: "原图、快速预览、AI 精修图和自己改进后的版本，都可以分类保存到作品集。",
    accent: "bg-rose/25",
  },
];

const featureLinks = [
  {
    eyebrow: "AI Coach",
    title: "分析与精修",
    description: "上传照片，获得四维分析、调色建议和 AI 精修版本。",
    label: "进入 AI 工作室",
    to: "/ai",
    protected: true,
    accent: "bg-brand text-white",
  },
  {
    eyebrow: "Portfolio",
    title: "整理作品集",
    description: "保存原图和每次改进，按主题整理自己的成长轨迹。",
    label: "查看作品集",
    to: "/portfolio",
    protected: true,
    accent: "bg-sage/45 text-ink",
  },
  {
    eyebrow: "Community",
    title: "逛摄影社区",
    description: "发现真实创作，分享作品，并和其他摄影爱好者交流。",
    label: "进入社区",
    to: "/community",
    protected: false,
    accent: "bg-sand text-ink",
  },
  {
    eyebrow: "Profile",
    title: "完善个人主页",
    description: "记录常拍题材、偏好风格和你的摄影签名。",
    label: "打开个人主页",
    to: "/profile",
    protected: true,
    accent: "bg-blush text-ink",
  },
];

function GuestHero() {
  return (
    <section className="container-page grid items-center gap-8 !py-10 sm:!py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:!py-24">
      <div className="min-w-0 animate-fade-up">
        <p className="section-eyebrow">为每一次创作，找到下一步</p>
        <h1 className="page-title mt-4">
          照片已经有了感觉，
          <br className="hidden sm:block" />
          我们帮你把它走得更远。
        </h1>
        <p className="mt-5 max-w-xl text-[0.95rem] leading-7 text-muted sm:mt-6 sm:text-base sm:leading-8">
          先看看目标风格下的初步效果，再获得构图、光线、色彩和对焦的专业分析。想继续调整时，带上参考图或一句想法，让 AI 和你一起完成精修。
        </p>

        <div className="-mx-4 mt-7 flex gap-2.5 overflow-x-auto px-4 pb-1 text-sm text-muted sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {["快速预览", "四维分析", "参考图精修", "版本作品集"].map((item) => (
            <span key={item} className="shrink-0 rounded-full border border-sand bg-white/65 px-4 py-2">{item}</span>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:gap-4">
          <Link to="/register" className="btn-primary w-full sm:w-auto">开始创作</Link>
          <a href="#how-it-works" className="btn-secondary w-full sm:w-auto">看看如何完成一张作品</a>
        </div>
      </div>

      <div className="card relative min-w-0 animate-fade-up overflow-hidden !p-4 sm:!p-6 lg:!p-8" style={{ animationDelay: "0.15s" }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3 sm:gap-5">
            <div>
              <p className="section-eyebrow">一次创作，不止一个答案</p>
              <h2 className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">让雨夜街头，更有电影感</h2>
            </div>
            <span className="shrink-0 rounded-full bg-brand px-2.5 py-1.5 text-[0.65rem] font-medium text-white sm:px-3 sm:text-xs">目标匹配 86</span>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[1.5rem] bg-ink sm:mt-5 sm:rounded-[1.75rem]">
            <img
              className="h-64 w-full object-cover object-center sm:h-72 lg:h-80"
              src="/images/ai-goal-analysis-rainy-night.jpg"
              alt="雨夜街道中撑伞行人的摄影创作示例"
              width="900"
              height="1125"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/35 to-transparent px-4 pb-4 pt-14 text-white sm:px-5 sm:pb-5 sm:pt-16">
              <p className="text-[0.65rem] text-white/70 sm:text-xs">本次想法</p>
              <p className="mt-1 text-xs font-medium leading-5 sm:text-sm">保留雨夜的安静，让冷暖光线自然叙事</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:mt-5 sm:gap-2.5">
            {[
              ["快速预览", "确认方向"],
              ["四维分析", "看清问题"],
              ["AI 精修", "继续表达"],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl bg-sand/55 px-1.5 py-2.5 sm:px-2 sm:py-3">
                <p className="text-[0.68rem] font-medium text-brand-deep sm:text-xs">{title}</p>
                <p className="mt-1 text-[0.62rem] text-muted sm:text-[0.68rem]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MemberHero() {
  return (
    <section className="container-page !py-6 sm:!py-10">
      <div className="relative grid overflow-hidden rounded-[2rem] bg-ink text-white md:grid-cols-[1.1fr_0.9fr] md:rounded-[2.5rem]">
        <div className="relative z-10 px-6 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
          <p className="font-display text-sm italic tracking-wide text-rose">今天的摄影练习</p>
          <h1 className="mt-3 max-w-2xl font-display text-[2.35rem] font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
            把一张喜欢的照片，
            <br className="hidden sm:block" />
            再往前推一步。
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/65 sm:text-base">
            从上传、分析到精修，清晰完成一次创作，也可以先看看今天为你挑选的摄影灵感。
          </p>
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
            <Link to="/ai" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-ink transition hover:bg-blush">
              上传照片开始分析
            </Link>
            <a href="#daily-inspiration" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-medium text-white transition hover:bg-white/10">
              看今日灵感
            </a>
          </div>
        </div>
        <div className="relative min-h-56 overflow-hidden sm:min-h-72 md:min-h-full">
          <img
            className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
            src="/images/ai-goal-analysis-rainy-night.jpg"
            alt="雨夜街头摄影创作示例"
            width="900"
            height="1125"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-transparent to-ink/70 md:bg-gradient-to-r md:from-ink md:via-ink/15 md:to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-ink/30 p-4 backdrop-blur-md sm:bottom-7 sm:left-7 sm:right-7">
            <p className="text-xs text-white/60">推荐练习</p>
            <p className="mt-1 text-sm font-medium">尝试用冷暖对比，让夜景更有叙事感</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickAccess({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="container-page !pb-12 !pt-4 sm:!pb-16 sm:!pt-6" aria-labelledby="quick-access-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">{isAuthenticated ? "Quick Access" : "Explore LensCoach"}</p>
          <h2 id="quick-access-title" className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            {isAuthenticated ? "今天想去哪里？" : "每个功能，都可以直接开始"}
          </h2>
        </div>
        {isAuthenticated && <span className="hidden text-xs tracking-widest text-muted sm:block">4 个常用入口</span>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {featureLinks.map((feature) => {
          const target = feature.protected && !isAuthenticated ? "/register" : feature.to;
          return (
            <Link
              key={feature.title}
              to={target}
              className="group flex min-h-52 flex-col rounded-[1.6rem] border border-white/70 bg-white/70 p-4 shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose/50 sm:min-h-56 sm:p-6"
              aria-label={`${feature.label}：${feature.description}`}
            >
              <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-wider sm:text-xs ${feature.accent}`}>
                {feature.eyebrow}
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold leading-tight sm:text-2xl">{feature.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted sm:text-sm sm:leading-6">{feature.description}</p>
              <span className="mt-auto flex items-center justify-between pt-5 text-xs font-medium text-brand-deep sm:text-sm">
                <span>{feature.protected && !isAuthenticated ? "注册后使用" : feature.label}</span>
                <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ProductJourney() {
  return (
    <section id="how-it-works" className="container-page scroll-mt-24 !pb-16 !pt-4 sm:!pb-20 lg:!pb-28">
      <div className="max-w-2xl">
        <p className="section-eyebrow">从一张照片，到更清晰的表达</p>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-5xl">不是只给一个分数，而是陪你走完创作的下一段。</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:mt-5 sm:text-base sm:leading-8">每一步都有可以带走的结果。你可以停在满意的版本，也可以继续把想法往前推。</p>
      </div>

      <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4">
        {productSteps.map((item) => (
          <Link
            key={item.number}
            to="/register"
            className="card group relative flex min-h-64 w-[82vw] shrink-0 snap-center flex-col overflow-hidden !p-5 transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose/50 sm:w-[22rem] md:w-auto md:!p-6 lg:!p-8"
          >
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${item.accent} blur-2xl transition group-hover:scale-125`} />
            <span className="relative font-display text-4xl font-semibold text-brand/35">{item.number}</span>
            <h3 className="relative mt-auto pt-10 font-display text-2xl font-semibold">{item.title}</h3>
            <p className="relative mt-3 text-sm leading-7 text-muted">{item.description}</p>
            <span className="relative mt-5 flex items-center justify-between text-sm font-medium text-brand-deep">
              体验这一步 <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-5 rounded-[2rem] bg-ink px-6 py-7 text-white sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:px-9">
        <div>
          <p className="font-display text-2xl font-semibold">下一张照片，不必一个人琢磨。</p>
          <p className="mt-2 text-sm leading-6 text-white/65">带上照片和你想抵达的方向，剩下的我们一起看。</p>
        </div>
        <Link to="/register" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-ink transition hover:bg-blush">
          开始创作
        </Link>
      </div>
    </section>
  );
}

export function LandingHome({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <main>
      {isAuthenticated ? <MemberHero /> : <GuestHero />}
      <QuickAccess isAuthenticated={isAuthenticated} />
      {!isAuthenticated && <ProductJourney />}
      <div id="daily-inspiration" className="scroll-mt-20">
        <DailyInspirationSection />
      </div>
    </main>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  return <LandingHome isAuthenticated={isAuthenticated} />;
}
