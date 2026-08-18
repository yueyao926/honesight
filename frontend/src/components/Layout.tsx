import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAssetUrl } from "../api/client";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

const authenticatedNavItems = [
  { to: "/dashboard", label: "首页" },
  { to: "/practice", label: "每周一练" },
  { to: "/ai", label: "AI 工作室" },
  { to: "/portfolio", label: "作品集" },
  { to: "/community", label: "社区" },
  { to: "/profile", label: "个人" },
];

export default function Layout() {
  const { isAuthenticated, logout, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  async function handleLogout() {
    await logout();
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-cream/80 backdrop-blur-md">
        <nav className="container-page relative flex items-center justify-center !py-4 md:!py-5" aria-label="主导航">
          <div className="hidden items-center justify-center gap-1 md:flex lg:gap-2">
            <Link to="/" className="home-logo-type mr-2 text-[1.75rem] leading-none text-ink lg:mr-4 lg:text-[2rem]">
              HoneSight
            </Link>
            {isAuthenticated && authenticatedNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>{item.label}</NavLink>
            ))}
            {!isAuthenticated ? (
              <>
                <NavLink to="/login" className={navClass}>登录</NavLink>
                <Link to="/register" className="btn-primary ml-1 py-2 text-xs md:text-sm">注册</Link>
              </>
            ) : (
              <Link className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-blush text-sm font-medium text-ink" to="/profile" aria-label="个人主页">
                {user?.avatar_url ? <img className="h-full w-full object-cover" src={getAssetUrl(user.avatar_url)} alt="" /> : user?.username?.slice(0, 1).toUpperCase()}
              </Link>
            )}
          </div>

          <Link to="/" className="home-logo-type text-[1.75rem] leading-none text-ink md:hidden">
            HoneSight
          </Link>

          <button
            type="button"
            className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full border border-sand bg-white/75 text-ink transition hover:border-brand sm:right-6 md:hidden"
            aria-label={mobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className="sr-only">{mobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}</span>
            <span aria-hidden="true" className="relative block h-4 w-5">
              <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${mobileMenuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${mobileMenuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </span>
          </button>
        </nav>
        <div
          id="mobile-navigation"
          className={`overflow-hidden border-t border-sand/60 bg-cream/95 transition-[max-height,opacity] duration-300 md:hidden ${mobileMenuOpen ? "max-h-[32rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"}`}
        >
          <div className="container-page !py-4">
            {isAuthenticated ? (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/70 p-3">
                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blush font-medium text-ink">
                    {user?.avatar_url ? <img className="h-full w-full object-cover" src={getAssetUrl(user.avatar_url)} alt="" /> : user?.username?.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user?.username || "摄影创作者"}</p>
                    <p className="text-xs text-muted">继续今天的摄影练习</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {authenticatedNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? "bg-brand text-white" : "bg-white/65 text-ink hover:bg-blush"}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
                <button type="button" className="mt-3 w-full rounded-2xl px-4 py-3 text-left text-sm text-muted transition hover:bg-white/65 hover:text-ink" onClick={handleLogout}>
                  退出登录
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/login" className="btn-secondary w-full">登录</Link>
                <Link to="/register" className="btn-primary w-full">免费注册</Link>
                <Link to="/community" className="col-span-2 rounded-2xl bg-white/65 px-4 py-3 text-center text-sm font-medium text-ink">
                  先逛逛摄影社区
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-sand/50 px-4 py-7 text-center text-sm text-muted">
        <a
          className="transition hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose/50"
          href="https://github.com/yueyao926/HoneSight/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          有使用问题或改进建议？欢迎前往 GitHub 提交 Issue。
        </a>
      </footer>
    </div>
  );
}
