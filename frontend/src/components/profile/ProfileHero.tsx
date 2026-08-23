import { FormEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import type { Profile as ProfileType } from "../../types";
import arrow8Svg from "../../SVG/arrow-8.svg?url";
import hopeSvg from "../../SVG/hope.svg?url";
import ProfileHeroSpeeder from "./ProfileHeroSpeeder";

type ProfileHeroProps = {
  profile: ProfileType;
  own: boolean;
  initial: string;
  onAvatarClick: () => void;
  onEdit: () => void;
  onFollow: () => void;
  onMessage: () => void;
  onSaveTags: (tags: string[]) => Promise<void>;
};

function formatJoined(createdAt: string) {
  const joined = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `Joined ${joined}`;
}

export function parsePersonalityTags(raw: string) {
  const tags: string[] = [];
  for (const part of raw.split(/[\s,，#]+/)) {
    const name = part.trim();
    if (!name || tags.includes(name)) continue;
    tags.push(name.slice(0, 16));
    if (tags.length >= 6) break;
  }
  return tags;
}

function formatHashtag(tag: string) {
  const name = tag.replace(/^#/, "").trim();
  return name ? `#${name}` : "";
}

export default function ProfileHero({
  profile,
  own,
  initial,
  onAvatarClick,
  onEdit,
  onFollow,
  onMessage,
  onSaveTags,
}: ProfileHeroProps) {
  const index = String(profile.id).padStart(3, "0");
  const bio = profile.signature || profile.bio || "用镜头记录正在发生的生活";
  const tags = (profile.personality_tags || []).map(formatHashtag).filter(Boolean);
  const meta = [profile.location, formatJoined(profile.created_at)].filter(Boolean).join(" · ");
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const skipBlurSave = useRef(false);

  function startEditingTags() {
    setTagDraft((profile.personality_tags || []).join(" "));
    setEditingTags(true);
  }

  async function saveTags(event?: FormEvent) {
    event?.preventDefault();
    if (savingTags) return;
    setSavingTags(true);
    try {
      await onSaveTags(parsePersonalityTags(tagDraft));
      setEditingTags(false);
    } finally {
      setSavingTags(false);
    }
  }

  const avatarContent = profile.avatar_url ? (
    <img src={getAssetUrl(profile.avatar_url)} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="profile-avatar-initial">{initial}</span>
  );

  return (
    <section className="profile-header animate-fade-up" aria-label="个人资料">
      <div className="profile-hero-grid">
        <p className="profile-hero-kicker">PROFILE / {index}</p>
        {own ? (
          <div className="profile-hero-top-actions">
            <Link className="profile-hero-settings" to="/settings">
              账户设置
              <img src={arrow8Svg} alt="" aria-hidden="true" draggable={false} className="profile-hero-link__arrow" />
            </Link>
            <button type="button" className="profile-hero-link" onClick={onEdit}>
              编辑资料
              <img src={arrow8Svg} alt="" aria-hidden="true" draggable={false} className="profile-hero-link__arrow" />
            </button>
          </div>
        ) : (
          <div className="profile-hero-top-spacer" aria-hidden="true" />
        )}

        <div className="profile-hero-row">
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

        <div className="profile-hero-body">
          <div className="profile-hero-copy">
              <h1 className="profile-hero-name">{profile.username}</h1>
              <p className="profile-hero-bio">{bio}</p>
              <p className="profile-hero-meta">{meta}</p>
              {own ? (
                editingTags ? (
                  <form className="profile-hero-tags-form" onSubmit={saveTags}>
                    <label className="profile-hero-tags-sizer">
                      <span className="profile-hero-tags-sizer__mirror" aria-hidden="true">
                        {tagDraft || " "}
                      </span>
                      <input
                        className="profile-hero-tags-input"
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        onBlur={() => {
                          if (skipBlurSave.current) {
                            skipBlurSave.current = false;
                            return;
                          }
                          void saveTags();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            skipBlurSave.current = true;
                            setEditingTags(false);
                          }
                        }}
                        placeholder=""
                        maxLength={80}
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={savingTags}
                        aria-label="个性标签"
                      />
                    </label>
                  </form>
                ) : tags.length > 0 ? (
                  <button type="button" className="profile-hero-tags profile-hero-tags--edit" onClick={startEditingTags}>
                    {tags.join(" ")}
                  </button>
                ) : (
                  <button type="button" className="profile-hero-tags profile-hero-tags--empty" onClick={startEditingTags}>
                    添加个性标签
                  </button>
                )
              ) : (
                tags.length > 0 && <p className="profile-hero-tags">{tags.join(" ")}</p>
              )}
            </div>

          {!own && (
            <div className="profile-hero-actions">
              <button type="button" className="profile-hero-link" onClick={onFollow}>
                {profile.is_following ? "已关注" : "关注"}
              </button>
              <button type="button" className="profile-hero-link" onClick={onMessage}>
                私信 →
              </button>
            </div>
          )}
        </div>
        </div>

        <ProfileHeroSpeeder />

        <img
          className="profile-hero-hope"
          src={hopeSvg}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </div>
    </section>
  );
}
