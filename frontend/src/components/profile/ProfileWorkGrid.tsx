import { useLocation, useNavigate } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import { favoriteWork, unfavoriteWork, updateWork } from "../../api/profile";
import type { PortfolioPhoto } from "../../types";

type ProfileWorkGridProps = {
  works: PortfolioPhoto[];
  own: boolean;
  isAuthenticated: boolean;
  setWorks: React.Dispatch<React.SetStateAction<PortfolioPhoto[]>>;
};

export default function ProfileWorkGrid({ works, own, isAuthenticated, setWorks }: ProfileWorkGridProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {works.map((work) => (
        <article key={work.id} className="group overflow-hidden rounded-3xl bg-white/75 shadow-card">
          <button
            type="button"
            className="block aspect-square w-full overflow-hidden border-0 bg-neutral-100 p-0"
            onClick={() => window.open(getAssetUrl(work.image_url), "_blank")}
          >
            <img
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              src={getAssetUrl(work.thumbnail_url || work.image_url)}
              alt={work.title}
              loading="lazy"
              decoding="async"
            />
          </button>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate">{work.title}</h3>
              {own && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted"
                  onClick={async () => {
                    const updated = await updateWork(work.id, {
                      visibility: work.visibility === "public" ? "private" : "public",
                    });
                    setWorks((items) => items.map((item) => (item.id === updated.id ? updated : item)));
                  }}
                >
                  {work.visibility === "private" ? "🔒 私密" : "公开"}
                </button>
              )}
            </div>
            {!own && (
              <button
                type="button"
                className="mt-3 text-xs text-brand-deep"
                onClick={async () => {
                  if (!isAuthenticated) return navigate("/login", { state: { from: location } });
                  if (work.is_favorited) {
                    await unfavoriteWork(work.id);
                    setWorks((items) => items.filter((item) => item.id !== work.id));
                  } else {
                    await favoriteWork(work.id);
                    setWorks((items) =>
                      items.map((item) => (item.id === work.id ? { ...item, is_favorited: true } : item)),
                    );
                  }
                }}
              >
                {work.is_favorited ? "取消收藏" : "收藏"} · {work.favorite_count}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
