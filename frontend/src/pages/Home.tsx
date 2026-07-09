import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="container-page">
      <section className="grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-brand">AI Photography Coach</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-ink md:text-6xl">
            不只是看照片，而是陪你建立稳定的摄影成长路径。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            不是简单给照片打分，而是根据你的目标风格，给出可执行的摄影成长建议。
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/register" className="btn-primary">开始创建我的作品集</Link>
            <Link to="/login" className="btn-secondary">我已有账号</Link>
          </div>
        </div>
        <div className="card">
          <p className="text-sm font-semibold text-brand">示例分析报告</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">清新自然 · 小红书封面</h2>
          <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
            <p><span className="font-semibold text-ink">构图：</span>主体已经明确，可以预留右侧留白，方便封面标题排版。</p>
            <p><span className="font-semibold text-ink">光线：</span>建议略微提高阴影，让肤色更通透，同时压住高光。</p>
            <p><span className="font-semibold text-ink">调色：</span>降低绿色饱和度，保留蓝色明度，整体更接近日系清透感。</p>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {["个性化摄影偏好", "AI 照片分析报告", "个人作品集成长记录"].map((title) => (
          <div key={title} className="card">
            <h3 className="text-xl font-semibold text-ink">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              用简洁稳定的流程，把每一次上传都转化成下一次拍摄可以执行的动作。
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
