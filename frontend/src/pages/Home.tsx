import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import DailyInspirationSection from "../components/DailyInspirationSection";

export default function Home() {
  const { isAuthenticated } = useAuth();
  // 匿名用户先注册，已登录用户直接进入对应功能，避免被鉴权重定向弹走
  return (
    <main>
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="animate-fade-up">
          <p className="section-eyebrow">AI Photography Coach</p>
          <h1 className="page-title mt-4">
            用你喜欢的风格，
            <br />
            找到下一次拍摄的方向。
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted">
            上传作品与风格参考，告诉 AI 这一次想抵达的方向，获得关于构图、光线与色彩的具体建议。
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/ai" className="btn-primary">开始 AI 分析</Link>
                <Link to="/portfolio" className="btn-secondary">我的作品集</Link>
              </>
            ) : (
              <>
                <Link to="/portfolio" className="btn-primary">开始创建作品集</Link>
              </>
            )}
          </div>
        </div>

        <div className="card animate-fade-up relative overflow-hidden" style={{ animationDelay: "0.15s" }}>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose/30 blur-3xl" />
          <div className="relative">
            <p className="section-eyebrow">AI 目标分析示例</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">让雨夜街头，更有电影感</h2>

            <div className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-ink">
              <img
                className="h-64 w-full object-cover object-center sm:h-72 lg:h-64 xl:h-72"
                src="/images/ai-goal-analysis-rainy-night.jpg"
                alt="雨夜街道中撑伞行人的摄影分析示例"
                width="900"
                height="1125"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-5 pt-12 text-white">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-white/70">本次目标</p>
                <p className="mt-1 text-sm font-medium">保留雨夜的安静，让冷暖光线自然叙事</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-sm leading-6">
              <div className="flex gap-3 rounded-2xl bg-sand/45 px-4 py-3">
                <span className="shrink-0 font-medium text-brand-deep">构图</span>
                <p className="text-muted">人物略向右移，为前方街景留出呼吸。</p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-sand/45 px-4 py-3">
                <span className="shrink-0 font-medium text-brand-deep">光线</span>
                <p className="text-muted">压住路灯高光，让倒影自然引导视线。</p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-sand/45 px-4 py-3">
                <span className="shrink-0 font-medium text-brand-deep">色彩</span>
                <p className="text-muted">保留冷蓝与暖橙之间克制的对话。</p>
              </div>
            </div>

            <div className="mt-5 border-t border-sand pt-5">
              <p className="text-xs leading-5 text-muted">AI 提供观察与调整的方向，最后的表达仍由你决定。</p>
              <Link className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-deep transition hover:gap-3" to="/ai">
                带上一张照片，听听光影的建议 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DailyInspirationSection />
    </main>
  );
}
