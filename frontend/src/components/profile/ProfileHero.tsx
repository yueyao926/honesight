import { getAssetUrl } from "../../api/client";
import type { Profile as ProfileType } from "../../types";

type ProfileHeroProps = {
  profile: ProfileType;
  own: boolean;
  initial: string;
  onAvatarClick: () => void;
  onEdit: () => void;
  onFollow: () => void;
  onMessage: () => void;
  onStatClick: (tab: "following" | "followers") => void;
};

export default function ProfileHero({
  profile,
  own,
  initial,
  onAvatarClick,
  onEdit,
  onFollow,
  onMessage,
  onStatClick,
}: ProfileHeroProps) {
  const joined = new Date(profile.created_at).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });

  const avatarContent = profile.avatar_url ? (
    <img src={getAssetUrl(profile.avatar_url)} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="profile-avatar-initial">{initial}</span>
  );

  return (
    <section className="card profile-header animate-fade-up" aria-label="个人资料">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        {own ? (
          <button type="button" className="profile-avatar" onClick={onAvatarClick} aria-label="更换头像">
            {avatarContent}
            <span className="profile-avatar-hint">更换</span>
          </button>
        ) : (
          <div className="profile-avatar" aria-label={`${profile.username} 的头像`}>
            {avatarContent}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="section-eyebrow">{own ? "Profile" : "Photographer"}</p>
          <h1 className="page-title mt-1 break-words">{profile.username}</h1>
          <p className="mt-2 text-lg text-muted">{profile.signature || "用镜头记录正在发生的生活"}</p>
          {profile.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed">{profile.bio}</p>
          )}
          <p className="mt-4 text-sm text-muted">
            {profile.location && `${profile.location} · `}
            加入 HoneSight 于 {joined}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          {own ? (
            <button type="button" className="hand-drawn-outline-button" onClick={onEdit}>
              编辑资料
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`hand-drawn-outline-button${profile.is_following ? " opacity-70" : ""}`}
                onClick={onFollow}
              >
                {profile.is_following ? "已关注" : "关注"}
              </button>
              <button type="button" className="hand-drawn-outline-button" onClick={onMessage}>
                私信
              </button>
            </>
          )}
        </div>
      </div>

      <div className="profile-stats" aria-label="数据统计">
        <div className="profile-stat">
          <strong>{profile.work_count}</strong>
          <span>作品</span>
        </div>
        <button type="button" className="profile-stat profile-stat--clickable" onClick={() => onStatClick("following")}>
          <strong>{profile.following_count}</strong>
          <span>关注</span>
        </button>
        <button type="button" className="profile-stat profile-stat--clickable" onClick={() => onStatClick("followers")}>
          <strong>{profile.follower_count}</strong>
          <span>粉丝</span>
        </button>
      </div>
    </section>
  );
}
