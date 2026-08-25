import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyProfile, getPrivacy, updatePrivacy } from "../api/profile";
import { resendVerification } from "../api/auth";
import OutlineLiftButton from "../components/ui/OutlineLiftButton";
import { useAuth } from "../contexts/AuthContext";
import type { PrivacySettings, Profile } from "../types";
import arrow28Svg from "../SVG/arrow-28.svg?url";

const privacyLabels: Record<keyof PrivacySettings, string> = {
  show_following: "公开关注列表",
  show_followers: "公开粉丝列表",
  allow_work_favorites: "允许收藏公开作品",
  discoverable_by_username: "允许通过用户名搜索",
  allow_follow_notifications: "接收新关注通知",
};

function maskEmail(email?: string | null) {
  if (!email) return "未绑定";
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([getMyProfile(), getPrivacy()])
      .then(([nextProfile, nextPrivacy]) => {
        setProfile(nextProfile);
        setPrivacy(nextPrivacy);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  return (
    <main className="handwriting-page settings-page container-page">
      {toast && <div className="profile-toast">{toast}</div>}

      <Link className="community-back-link" to="/profile" aria-label="返回个人主页">
        <img
          src={arrow28Svg}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="community-back-link__icon"
        />
        <span className="community-back-link__label">返回个人主页</span>
      </Link>

      <p className="section-eyebrow">Account</p>
      <h1 className="page-title mt-2">账户设置</h1>

      {error && <p className="mt-5 text-sm text-ink">{error}</p>}

      <section className="settings-block">
        <h2>绑定邮箱</h2>
        <p className="settings-block__value">{maskEmail(profile?.email)}</p>
        <p className="settings-block__hint">
          {profile?.email_verified ? "已验证" : "尚未验证"}
        </p>
        {profile && !profile.email_verified && (
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={async () => {
              if (!profile.email) return;
              try {
                await resendVerification(profile.email);
                flash("验证邮件已发送，请查收邮箱");
              } catch (e) {
                setError(e instanceof Error ? e.message : "发送失败");
              }
            }}
          >
            重新发送验证邮件
          </button>
        )}
      </section>

      <section className="settings-block">
        <h2>隐私设置</h2>
        {privacy && (
          <div className="settings-privacy-list">
            {Object.entries(privacy).map(([key, value]) => (
              <label className="settings-privacy-row" key={key}>
                <span>{privacyLabels[key as keyof PrivacySettings]}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (event) => {
                    const next = { ...privacy, [key]: event.target.checked };
                    setPrivacy(await updatePrivacy(next));
                    flash("隐私设置已保存");
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="settings-actions">
        <OutlineLiftButton
          type="button"
          variant="solid"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          退出登录
        </OutlineLiftButton>
        <button type="button" className="btn-secondary portfolio-manage-cancel-btn" disabled>
          删除账户（暂未开放）
        </button>
      </section>
    </main>
  );
}
