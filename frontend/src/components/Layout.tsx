import { NavLink, Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAssetUrl } from "../api/client";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

export default function Layout() {
  const { isAuthenticated, logout, user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-cream/80 backdrop-blur-md">
        <nav className="container-page flex items-center justify-between py-5">
          <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-ink">
            LensCoach
          </Link>
          <div className="flex items-center gap-1 md:gap-2">
            {isAuthenticated && <NavLink to="/dashboard" className={navClass}>首页</NavLink>}
            {isAuthenticated && <NavLink to="/portfolio" className={navClass}>作品集</NavLink>}
            {isAuthenticated && <NavLink to="/community" className={navClass}>社区</NavLink>}
            {isAuthenticated && <NavLink to="/ai" className={navClass}>AI 工作室</NavLink>}
            {isAuthenticated && <NavLink to="/profile" className={navClass}>个人</NavLink>}
            {!isAuthenticated ? (
              <>
                <NavLink to="/login" className={navClass}>登录</NavLink>
                <Link to="/register" className="btn-primary ml-2 py-2 text-xs md:text-sm">注册</Link>
              </>
            ) : (
              <Link className="ml-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-blush text-sm font-medium text-brand-deep" to="/profile" aria-label="个人主页">
                {user?.avatar_url ? <img className="h-full w-full object-cover" src={getAssetUrl(user.avatar_url)} alt="" /> : user?.username?.slice(0, 1).toUpperCase()}
              </Link>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
      <footer className="border-t border-sand/50 py-8 text-center text-xs text-muted">
        LensCoach · 陪你建立稳定的摄影成长路径 · <a className="transition hover:text-ink" href="/#contact">联系我们</a>
      </footer>
    </div>
  );
}
