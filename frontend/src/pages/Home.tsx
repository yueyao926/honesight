import { Link } from "react-router-dom";
import DailyInspirationSection from "../components/DailyInspirationSection";
import HomeFeatureIcons from "../components/home/HomeFeatureIcons";
import HomeLogoMark from "../components/home/HomeLogoMark";
import HomePracticeCard from "../components/home/HomePracticeCard";
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

function SketchHero() {
  return (
    <section className="container-page !pb-4 !pt-6 sm:!pt-10 md:!pt-12">
      <HomeFeatureIcons />
      <HomeLogoMark />
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
      <SketchHero />
      <HomePracticeCard isAuthenticated={isAuthenticated} />
      <div id="daily-inspiration" className="scroll-mt-20">
        <DailyInspirationSection />
      </div>
      {!isAuthenticated && <ProductJourney />}
    </main>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  return <LandingHome isAuthenticated={isAuthenticated} />;
}
