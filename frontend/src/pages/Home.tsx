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
            上传作品与风格参考，AI 识别你的审美偏好，给出可执行的摄影建议与预期效果预览。
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
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose/30 blur-2xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted">示例 · 日系清新</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">预期效果预览</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-sand/50 p-3 text-center text-xs text-muted">修图前</div>
            <div className="rounded-2xl bg-blush p-3 text-center text-xs text-brand-deep">修图后</div>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <p><span className="font-medium text-ink">色调</span> — 降低绿色饱和，保留蓝色明度，整体更清透。</p>
            <p><span className="font-medium text-ink">构图</span> — 预留右侧留白，方便小红书封面标题排版。</p>
            <p><span className="font-medium text-ink">光线</span> — 略微提高阴影，肤色更通透，同时压住高光。</p>
          </div>
        </div>
      </section>

      <DailyInspirationSection />
    </main>
  );
}
