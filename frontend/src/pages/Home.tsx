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

function GuestHero() {
  return (
    <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <div className="min-w-0 animate-fade-up">
        <p className="section-eyebrow">为每一次创作，找到下一步</p>
        <h1 className="page-title mt-4">
          照片已经有了感觉，
          <br />
          我们帮你把它走得更远。
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-muted">
          先看看目标风格下的初步效果，再获得构图、光线、色彩和对焦的专业分析。想继续调整时，带上参考图或一句想法，让 AI 和你一起完成精修。
        </p>

        <div className="mt-8 flex flex-wrap gap-2.5 text-sm text-muted">
          {["快速预览", "四维分析", "参考图精修", "版本作品集"].map((item) => (
            <span key={item} className="rounded-full border border-sand bg-white/65 px-4 py-2">{item}</span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/register" className="btn-primary">开始创作</Link>
          <a href="#how-it-works" className="btn-secondary">看看如何完成一张作品</a>
        </div>
      </div>

      <div className="card min-w-0 animate-fade-up relative overflow-hidden" style={{ animationDelay: "0.15s" }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="section-eyebrow">一次创作，不止一个答案</p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">让雨夜街头，更有电影感</h2>
            </div>
            <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white">目标匹配 86</span>
          </div>

          <div className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-ink">
            <img
              className="h-72 w-full object-cover object-center lg:h-80"
              src="/images/ai-goal-analysis-rainy-night.jpg"
              alt="雨夜街道中撑伞行人的摄影创作示例"
              width="900"
              height="1125"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 pb-5 pt-16 text-white">
              <p className="text-xs text-white/70">本次想法</p>
              <p className="mt-1 text-sm font-medium">保留雨夜的安静，让冷暖光线自然叙事</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
            {[
              ["快速预览", "先确认方向"],
              ["四维分析", "看清关键问题"],
              ["AI 精修", "继续表达想法"],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl bg-sand/55 px-2 py-3">
                <p className="text-xs font-medium text-brand-deep">{title}</p>
                <p className="mt-1 text-[0.68rem] text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MemberHome({ username }: { username: string }) {
  return (
    <section className="container-page py-12 lg:py-20">
      <header className="animate-fade-up max-w-3xl">
        <p className="section-eyebrow">欢迎回来，{username}</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.08] sm:text-6xl">今天，想从哪张照片开始？</h1>
        <p className="mt-5 text-base leading-8 text-muted">选一条顺手的路径，让新的想法自然发生。</p>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:grid-rows-2">
        <Link
          to="/ai"
          className="group relative min-h-[32rem] overflow-hidden rounded-[2rem] bg-ink text-white shadow-card lg:row-span-2"
        >
          <img
            className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-85"
            src="/images/ai-goal-analysis-rainy-night.jpg"
            alt="进入 AI 工作室"
            width="900"
            height="1125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/20" />
          <div className="relative flex h-full min-h-[32rem] flex-col justify-between p-7 sm:p-10">
            <div className="flex flex-wrap gap-2 text-xs text-white/75">
              <span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 backdrop-blur">设置目标</span>
              <span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 backdrop-blur">四维分析</span>
              <span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 backdrop-blur">AI 精修</span>
            </div>
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">AI Studio</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">带上一张照片，<br />把脑海里的画面做出来。</h2>
              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition group-hover:gap-5">
                开始创作 <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/portfolio"
          className="group card relative flex min-h-60 flex-col overflow-hidden bg-blush/65 transition duration-300 hover:-translate-y-1"
        >
          <div className="absolute -right-8 -top-10 font-display text-[9rem] font-semibold leading-none text-white/55">01</div>
          <div className="relative mt-auto">
            <p className="section-eyebrow">我的作品集</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">回到喜欢的版本，看看自己走了多远。</h2>
            <p className="mt-4 text-sm font-medium text-brand-deep transition group-hover:translate-x-1">打开作品集 →</p>
          </div>
        </Link>

        <a
          href="#daily-inspiration"
          className="group card relative flex min-h-60 flex-col overflow-hidden bg-sand/70 transition duration-300 hover:-translate-y-1"
        >
          <div className="absolute -right-8 -top-10 font-display text-[9rem] font-semibold leading-none text-white/70">02</div>
          <div className="relative mt-auto">
            <p className="section-eyebrow">今日灵感</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">暂时不想修图，也可以先看一张好照片。</h2>
            <p className="mt-4 text-sm font-medium text-brand-deep transition group-hover:translate-x-1">向下看看 →</p>
          </div>
        </a>
      </div>
    </section>
  );
}

function ProductJourney() {
  return (
    <section id="how-it-works" className="container-page scroll-mt-24 pb-20 pt-4 lg:pb-28">
      <div className="max-w-2xl">
        <p className="section-eyebrow">从一张照片，到更清晰的表达</p>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">不是只给一个分数，而是陪你走完创作的下一段。</h2>
        <p className="mt-5 max-w-xl leading-8 text-muted">每一步都有可以带走的结果。你可以停在满意的版本，也可以继续把想法往前推。</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productSteps.map((item) => (
          <article key={item.number} className="card group relative min-h-64 overflow-hidden transition duration-300 hover:-translate-y-1">
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${item.accent} blur-2xl transition group-hover:scale-125`} />
            <div className="relative flex h-full flex-col">
              <span className="font-display text-4xl font-semibold text-brand/35">{item.number}</span>
              <h3 className="mt-auto pt-12 font-display text-2xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{item.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-[2rem] bg-ink px-7 py-7 text-white sm:px-9">
        <div>
          <p className="font-display text-2xl font-semibold">下一张照片，不必一个人琢磨。</p>
          <p className="mt-2 text-sm text-white/65">带上照片和你想抵达的方向，剩下的我们一起看。</p>
        </div>
        <Link to="/register" className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-blush">
          开始创作
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <main>
      {isAuthenticated ? <MemberHome username={user?.username || "摄影师"} /> : <GuestHero />}
      {!isAuthenticated && <ProductJourney />}
      <div id="daily-inspiration" className="scroll-mt-20">
        <DailyInspirationSection />
      </div>
    </main>
  );
}
