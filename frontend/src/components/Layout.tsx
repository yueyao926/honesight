import { NavLink, Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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
            {isAuthenticated && <NavLink to="/dashboard" className={navClass}>控制台</NavLink>}
            {isAuthenticated && <NavLink to="/portfolio" className={navClass}>作品集</NavLink>}
            {isAuthenticated && <NavLink to="/ai" className={navClass}>AI 工作室</NavLink>}
            {isAuthenticated && <NavLink to="/settings" className={navClass}>偏好</NavLink>}
            {!isAuthenticated ? (
              <>
                <NavLink to="/login" className={navClass}>登录</NavLink>
                <Link to="/register" className="btn-primary ml-2 py-2 text-xs md:text-sm">注册</Link>
              </>
            ) : (
              <button className="btn-ghost ml-2" onClick={logout}>
                退出 · {user?.username}
              </button>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
      <footer className="border-t border-sand/50 py-8 text-center text-xs text-muted">
        LensCoach · 陪你建立稳定的摄影成长路径
      </footer>
    </div>
  );
}
