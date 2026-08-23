import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchAll, suggestions, type SearchResult } from "../api/search";
import CommunityFeedCard from "../components/community/CommunityFeedCard";
import MasonryGrid from "../components/community/MasonryGrid";
import UserSearchResultCard from "../components/search/UserSearchResultCard";
import SearchLetterLoader from "../components/search/SearchLetterLoader";
import SearchMagnifierIcon from "../components/search/SearchMagnifierIcon";
import Vector9TabButton from "../components/search/Vector9TabButton";
import CommunityBackLink from "../components/community/CommunityBackLink";

const TABS = [
  ["all", "综合"],
  ["users", "用户"],
  ["posts", "作品"],
  ["images", "图片"],
  ["tags", "标签"],
] as const;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("q") || "");
  const [tab, setTab] = useState(params.get("type") || "all");
  const [result, setResult] = useState<SearchResult>();
  const [hints, setHints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const q = params.get("q") || "";

  useEffect(() => {
    if (!input.trim()) {
      setHints([]);
      return;
    }
    const t = setTimeout(
      () =>
        suggestions(input)
          .then((r) =>
            setHints(
              [...r.history, ...r.tags, ...r.users, ...r.related]
                .filter((x, i, a) => a.indexOf(x) === i)
                .slice(0, 8),
            ),
          )
          .catch(() => {}),
      300,
    );
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setError("");
    searchAll(q)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q]);

  function submit(value = input) {
    if (!value.trim()) return;
    setParams({ q: value.trim(), type: tab });
    setHints([]);
  }

  const posts = tab === "images" ? result?.images : result?.posts;
  const tagNames = new Set(result?.tags.map((t) => t.name) ?? []);
  const taggedPosts =
    result?.tag_posts ??
    result?.posts.filter((post) => post.tags.some((tag) => tagNames.has(tag.name))) ??
    [];

  return (
    <main className="handwriting-page container-page">
      <CommunityBackLink />
      <header className="w-full">
        <p className="section-eyebrow">Discover</p>
        <h1 className="page-title mt-2">搜索摄影灵感</h1>
        <div className="relative mt-6 w-full">
          <form
            className="search-bar-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="search-input-container">
              <input
                id="search-input"
                className="search-input-field"
                type="text"
                value={input}
                maxLength={120}
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setInput(e.target.value)}
              />
              <label htmlFor="search-input" className="search-input-label">
                例如：雨天夜晚的蓝色街拍
              </label>
              <div className="search-input-underline" aria-hidden="true" />
            </div>
            <button type="submit" className="search-submit-btn" aria-label="搜索">
              <SearchMagnifierIcon className="search-submit-btn__icon" />
            </button>
          </form>
          {hints.length > 0 && (
            <div className="absolute z-20 mt-2 w-full rounded-2xl bg-white p-2 shadow-xl">
              {hints.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="block w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-blush"
                  onClick={() => {
                    setInput(h);
                    submit(h);
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav className="search-tabs">
        {TABS.map(([v, l]) => (
          <Vector9TabButton
            key={v}
            active={tab === v}
            onClick={() => {
              setTab(v);
              if (q) setParams({ q, type: v });
            }}
          >
            {l}
          </Vector9TabButton>
        ))}
      </nav>

      {result && !result.semantic_available && q && (
        <p className="mb-5 rounded-2xl bg-sand/50 p-3 text-xs text-muted">
          当前环境未配置向量模型，结果使用关键词、模糊匹配、标签与摄影语义词扩展。
        </p>
      )}

      {loading ? (
        <SearchLetterLoader />
      ) : error ? (
        <div className="card text-ink">{error}</div>
      ) : !q ? (
        <div className="card text-center text-muted">输入自然语言、用户名、地点或器材开始搜索。</div>
      ) : tab === "users" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {result?.users.map((u) => (
            <UserSearchResultCard key={u.id} user={u} />
          ))}
        </div>
      ) : tab === "tags" ? (
        <div className="space-y-8">
          {result?.tags.length ? (
            <div className="flex flex-wrap gap-3">
              {result.tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setInput(t.name);
                    submit(t.name);
                  }}
                >
                  #{t.name} · {t.usage_count} 篇
                </button>
              ))}
            </div>
          ) : null}
          {taggedPosts.length ? (
            <section>
              <h2 className="font-display text-2xl">相关作品</h2>
              <MasonryGrid className="mt-4">
                {taggedPosts.map((p, index) => (
                  <CommunityFeedCard key={p.id} index={index} post={p} onChange={() => {}} />
                ))}
              </MasonryGrid>
            </section>
          ) : (
            <div className="card text-center text-muted">
              {result?.tags.length ? "这些标签下暂时没有可展示的作品。" : "暂时没有找到相关内容，可以尝试更换关键词或减少筛选条件。"}
            </div>
          )}
        </div>
      ) : tab === "all" ? (
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-2xl">摄影用户</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {result?.users.map((u) => (
                <UserSearchResultCard key={u.id} user={u} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-display text-2xl">相关作品</h2>
            <MasonryGrid className="mt-4">
              {result?.posts.map((p, index) => (
                <CommunityFeedCard key={p.id} index={index} post={p} onChange={() => {}} />
              ))}
            </MasonryGrid>
          </section>
        </div>
      ) : posts?.length ? (
        <MasonryGrid>
          {posts.map((p, index) => (
            <CommunityFeedCard key={p.id} index={index} post={p} onChange={() => {}} />
          ))}
        </MasonryGrid>
      ) : (
        <div className="card text-center text-muted">
          暂时没有找到相关内容，可以尝试更换关键词或减少筛选条件。
        </div>
      )}
    </main>
  );
}
