import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import { getFavoriteInspirations, unfavoriteInspiration } from "../api/inspirations";
import { getMyPreferences, updateMyPreferences } from "../api/preferences";
import { createConversation } from "../api/messages";
import {
  followUser,
  getFavorites,
  getFollowers,
  getFollowing,
  getMyProfile,
  getPublicProfile,
  getWorks,
  resetAvatar,
  unfollowUser,
  updateProfile,
  uploadAvatar,
} from "../api/profile";
import AvatarUploader from "../components/AvatarUploader";
import PreferenceForm from "../components/PreferenceForm";
import ProfileFavoriteFolderCard from "../components/profile/ProfileFavoriteFolderCard";
import ProfileHero, { parsePersonalityTags } from "../components/profile/ProfileHero";
import ProfileTabNav from "../components/profile/ProfileTabNav";
import ProfileWorkGrid from "../components/profile/ProfileWorkGrid";
import { useAuth } from "../contexts/AuthContext";
import arrow28Svg from "../SVG/arrow-28.svg?url";
import computerSvg from "../SVG/电脑.svg?url";
import hangerSvg from "../SVG/衣架.svg?url";
import type { Inspiration, PortfolioPhoto, Preference, Profile as ProfileType } from "../types";

type Tab = "works" | "favorites" | "following" | "followers" | "preferences";

const privateTabs: Tab[] = ["favorites", "preferences"];

const tabNames: Record<Tab, string> = {
  works: "作品集",
  favorites: "收藏",
  following: "关注",
  followers: "粉丝",
  preferences: "个人偏好",
};

export default function Profile() {
  const { isAuthenticated, refreshMe } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const own = !userId;
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [works, setWorks] = useState<PortfolioPhoto[]>([]);
  const [people, setPeople] = useState<ProfileType[]>([]);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [inspirationFavorites, setInspirationFavorites] = useState<Inspiration[]>([]);
  const [favoriteFolder, setFavoriteFolder] = useState<"root" | "inspirations" | "works">("root");
  const [tab, setTab] = useState<Tab>("works");
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const value = own ? await getMyProfile() : await getPublicProfile(Number(userId));
      setProfile(value);
      setWorks(await getWorks(value.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (own && !isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    load();
  }, [userId, isAuthenticated]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        if (tab === "favorites" && own) {
          const [savedWorks, savedInspirations] = await Promise.all([getFavorites(), getFavoriteInspirations()]);
          setWorks(savedWorks);
          setInspirationFavorites(savedInspirations);
          setFavoriteFolder("root");
        }
        if (tab === "following") setPeople(await getFollowing(profile.id));
        if (tab === "followers") setPeople(await getFollowers(profile.id));
        if (tab === "preferences" && own) setPreference(await getMyPreferences().catch(() => null));
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, [tab, profile?.id]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return (
      <main className="handwriting-page profile-page container-page">
        <div className="profile-hero-skeleton" aria-hidden="true" />
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="handwriting-page profile-page container-page">
        <div className="card text-center">
          <h1 className="page-title">无法打开个人主页</h1>
          <p className="mt-3 text-muted">{error}</p>
          <button type="button" className="hand-drawn-outline-button mt-6" onClick={load}>
            重试
          </button>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const initial = profile.username.slice(0, 1).toUpperCase();
  const tabs = (Object.keys(tabNames) as Tab[]).filter((value) => own || !privateTabs.includes(value));

  async function toggleFollow() {
    if (!isAuthenticated) return navigate("/login", { state: { from: location } });
    if (!profile) return;
    if (profile.is_following) await unfollowUser(profile.id);
    else await followUser(profile.id);
    setProfile({
      ...profile,
      is_following: !profile.is_following,
      follower_count: profile.follower_count + (profile.is_following ? -1 : 1),
    });
  }

  async function startMessage() {
    if (!profile) return;
    if (!isAuthenticated) return navigate("/login", { state: { from: location } });
    try {
      const conversation = await createConversation(profile.id);
      navigate(`/community/messages/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法发起私信");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = await updateProfile({
      username: String(form.get("username")),
      signature: String(form.get("signature")),
      bio: String(form.get("bio")),
      location: String(form.get("location")),
      photography_level: String(form.get("photography_level")),
      equipment: String(form.get("equipment")),
      personality_tags: parsePersonalityTags(String(form.get("personality_tags") || "")),
    });
    setProfile(updated);
    await refreshMe();
    setEditing(false);
    flash("资料已保存");
  }

  return (
    <main className="handwriting-page profile-page container-page">
      {toast && <div className="profile-toast">{toast}</div>}

      <ProfileHero
        profile={profile}
        own={own}
        initial={initial}
        onAvatarClick={() => own && setAvatar(true)}
        onEdit={() => setEditing(true)}
        onFollow={toggleFollow}
        onMessage={startMessage}
        onSaveTags={async (tags) => {
          const updated = await updateProfile({ personality_tags: tags });
          setProfile(updated);
        }}
      />

      <ProfileTabNav
        tabs={tabs}
        tabNames={tabNames}
        tabCounts={{
          works: profile.collection_count ?? 0,
          favorites: profile.favorite_count ?? 0,
          following: profile.following_count,
          followers: profile.follower_count,
        }}
        active={tab}
        onChange={setTab}
      />

      {tab === "works" && (
        <section className="profile-tab-panel">
          {works.length ? (
            <ProfileWorkGrid works={works} own={own} isAuthenticated={isAuthenticated} setWorks={setWorks} />
          ) : (
            <div className="profile-empty">
              <h2 className="text-xl">这里还没有内容</h2>
              <p className="mt-2 text-sm text-muted">
                {own ? "去作品集上传第一张照片吧。" : "暂时没有可展示的作品。"}
              </p>
              {own && (
                <Link className="cta mt-5 inline-block" to="/portfolio">
                  上传作品
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "favorites" && own && (
        <section className="profile-tab-panel">
          {favoriteFolder === "root" && (
            <div className="grid gap-5 md:grid-cols-2">
              <ProfileFavoriteFolderCard
                title="首页灵感收藏夹"
                description="你在首页个性化推荐中收藏的摄影作品。"
                count={inspirationFavorites.length}
                onClick={() => setFavoriteFolder("inspirations")}
              />
              <ProfileFavoriteFolderCard
                title="作品收藏"
                description="你收藏的 LensCoach 用户公开作品。"
                count={works.length}
                onClick={() => setFavoriteFolder("works")}
              />
            </div>
          )}

          {favoriteFolder !== "root" && (
            <button type="button" className="community-back-link mb-5" onClick={() => setFavoriteFolder("root")}>
              <img
                src={arrow28Svg}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="community-back-link__icon"
              />
              <span className="community-back-link__label">返回我的收藏</span>
            </button>
          )}

          {favoriteFolder === "inspirations" &&
            (inspirationFavorites.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {inspirationFavorites.map((photo) => (
                  <article key={photo.id} className="group overflow-hidden rounded-3xl bg-white/75 shadow-card">
                    <a className="block aspect-square overflow-hidden" href={photo.source_page_url} target="_blank" rel="noreferrer">
                      <img
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        src={photo.thumbnail_url || photo.image_url}
                        alt={photo.title}
                      />
                    </a>
                    <div className="p-4">
                      <h3 className="truncate">{photo.title}</h3>
                      <p className="mt-1 truncate text-xs text-muted">
                        摄影：{photo.photographer_name} · {photo.source_name}
                      </p>
                      <button
                        type="button"
                        className="mt-3 text-xs text-brand-deep"
                        onClick={async () => {
                          await unfavoriteInspiration(photo.id);
                          setInspirationFavorites((items) => items.filter((item) => item.id !== photo.id));
                          flash("已取消收藏");
                        }}
                      >
                        取消收藏
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="profile-empty">
                <img
                  src={computerSvg}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="profile-empty-illustration"
                />
                <p className="text-muted">首页灵感收藏夹还是空的</p>
              </div>
            ))}

          {favoriteFolder === "works" &&
            (works.length ? (
              <ProfileWorkGrid works={works} own={false} isAuthenticated={isAuthenticated} setWorks={setWorks} />
            ) : (
              <div className="profile-empty">
                <img
                  src={hangerSvg}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="profile-empty-illustration profile-empty-illustration--hanger"
                />
                <p className="text-muted">还没有收藏用户作品</p>
              </div>
            ))}
        </section>
      )}

      {(tab === "following" || tab === "followers") && (
        <section className="profile-tab-panel space-y-3">
          {people.length ? (
            people.map((person) => (
              <Link key={person.id} to={`/users/${person.id}`} className="card flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush">
                  {person.avatar_url ? (
                    <img src={getAssetUrl(person.avatar_url)} alt="" />
                  ) : (
                    person.username[0]
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate">{person.username}</h3>
                  <p className="truncate text-sm text-muted">{person.signature || "LensCoach 摄影用户"}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="profile-empty text-muted">暂无{tabNames[tab]}</p>
          )}
        </section>
      )}

      {tab === "preferences" && own && (
        <section className="profile-tab-panel profile-preferences">
          <h2 className="text-xl">个人偏好</h2>
          <p className="mt-2 text-sm text-muted">仅你可见，用于优化首页推荐。</p>
          <div className="mt-7">
            <PreferenceForm
              initial={preference}
              submitText="保存偏好"
              onSubmit={async (payload) => {
                setPreference(await updateMyPreferences(payload));
                flash("偏好已保存");
              }}
            />
          </div>
        </section>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
          <form className="profile-edit-modal" onSubmit={saveProfile}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl">编辑资料</h2>
              <button type="button" className="hand-drawn-outline-button" onClick={() => setEditing(false)}>
                取消
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label>
                <span className="label">用户名</span>
                <input className="input" name="username" minLength={2} maxLength={80} required defaultValue={profile.username} />
              </label>
              <label>
                <span className="label">个性签名（80字）</span>
                <input className="input" name="signature" maxLength={80} defaultValue={profile.signature || ""} />
              </label>
              <label className="md:col-span-2">
                <span className="label">个人简介（300字）</span>
                <textarea className="input min-h-28" name="bio" maxLength={300} defaultValue={profile.bio || ""} />
              </label>
              <label>
                <span className="label">地区</span>
                <input className="input" name="location" defaultValue={profile.location || ""} />
              </label>
              <label>
                <span className="label">摄影水平</span>
                <select className="input" name="photography_level" defaultValue={profile.photography_level || ""}>
                  <option value="">未选择</option>
                  <option>初学者</option>
                  <option>入门</option>
                  <option>进阶</option>
                  <option>专业</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="label">常用设备</span>
                <input className="input" name="equipment" defaultValue={profile.equipment || ""} />
              </label>
              <label className="md:col-span-2">
                <span className="label">个性标签</span>
                <input
                  className="input"
                  name="personality_tags"
                  defaultValue={(profile.personality_tags || []).join(" ")}
                  placeholder="用空格分开，例如：街拍 夜色 生活观察"
                  maxLength={80}
                  autoComplete="off"
                />
              </label>
            </div>

            <button type="submit" className="hand-drawn-outline-button mt-7">
              保存资料
            </button>
          </form>
        </div>
      )}

      {avatar && (
        <AvatarUploader
          onClose={() => setAvatar(false)}
          onSave={async (blob) => {
            setProfile(await uploadAvatar(blob));
            await refreshMe();
            flash("头像已更新");
          }}
          onReset={async () => {
            setProfile(await resetAvatar());
            await refreshMe();
            flash("已恢复默认头像");
          }}
        />
      )}
    </main>
  );
}
