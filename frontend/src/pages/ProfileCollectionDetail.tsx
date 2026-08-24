import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPublicProfile, getUserCollection } from "../api/profile";
import ProfileWorkGrid from "../components/profile/ProfileWorkGrid";
import { useAuth } from "../contexts/AuthContext";
import arrow28Svg from "../SVG/arrow-28.svg?url";
import type { PortfolioCollectionDetail, PortfolioPhoto, Profile as ProfileType } from "../types";

export default function ProfileCollectionDetail() {
  const { userId, collectionId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [collection, setCollection] = useState<PortfolioCollectionDetail | null>(null);
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const own = profile?.is_self ?? false;
  const profilePath = own ? "/profile" : `/users/${userId}`;

  useEffect(() => {
    if (!userId || !collectionId) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [userProfile, detail] = await Promise.all([
          getPublicProfile(Number(userId)),
          getUserCollection(userId, collectionId),
        ]);
        setProfile(userProfile);
        setCollection(detail);
        setPhotos(detail.photos);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, collectionId]);

  if (loading) {
    return (
      <main className="handwriting-page profile-page container-page">
        <div className="profile-hero-skeleton" aria-hidden="true" />
      </main>
    );
  }

  if (error || !collection || !profile) {
    return (
      <main className="handwriting-page profile-page container-page">
        <p className="text-muted">{error || "作品集不存在"}</p>
        <Link className="community-back-link mt-5 inline-flex" to={profilePath}>
          <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
          <span className="community-back-link__label">返回个人主页</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="handwriting-page profile-page container-page">
      <Link className="community-back-link mb-5 inline-flex" to={profilePath}>
        <img src={arrow28Svg} alt="" aria-hidden="true" draggable={false} className="community-back-link__icon" />
        <span className="community-back-link__label">返回 {profile.username} 的主页</span>
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl">{collection.name}</h1>
        <p className="mt-2 text-sm text-muted">{collection.photo_count} 张照片</p>
      </header>

      {photos.length ? (
        <ProfileWorkGrid
          works={photos}
          own={own}
          isAuthenticated={isAuthenticated}
          setWorks={setPhotos}
        />
      ) : (
        <div className="profile-empty">
          <p className="text-muted">{own ? "这个作品集还没有照片。" : "暂时没有可展示的照片。"}</p>
          {own && (
            <button type="button" className="cta mt-5" onClick={() => navigate(`/portfolio/${collection.id}`)}>
              去上传照片
            </button>
          )}
        </div>
      )}
    </main>
  );
}
