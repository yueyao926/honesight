import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { isAuthenticated, logout, user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/75 backdrop-blur">
        <nav className="container-page flex items-center justify-between py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-ink">
            LensCoach
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted">
            {isAuthenticated && <NavLink to="/dashboard">控制台</NavLink>}
            {isAuthenticated && <NavLink to="/portfolio">作品集</NavLink>}
            {isAuthenticated && <NavLink to="/settings">偏好设置</NavLink>}
            {!isAuthenticated ? (
              <>
                <NavLink to="/login">登录</NavLink>
                <NavLink to="/register" className="btn-primary py-2">
                  注册
                </NavLink>
              </>
            ) : (
              <button className="btn-secondary py-2" onClick={logout}>
                退出 {user?.username}
              </button>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
