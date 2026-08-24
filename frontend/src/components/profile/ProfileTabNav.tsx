type ProfileTabNavProps<T extends string> = {
  tabs: T[];
  tabNames: Record<T, string>;
  tabCounts?: Partial<Record<T, number>>;
  active: T;
  onChange: (tab: T) => void;
};

export default function ProfileTabNav<T extends string>({
  tabs,
  tabNames,
  tabCounts,
  active,
  onChange,
}: ProfileTabNavProps<T>) {
  return (
    <nav className="profile-tabs" aria-label="个人主页分类">
      {tabs.map((value) => {
        const isActive = active === value;
        const count = tabCounts?.[value];
        return (
          <button
            key={value}
            type="button"
            className={`profile-tab${isActive ? " profile-tab--active" : ""}`}
            onClick={() => onChange(value)}
            aria-current={isActive ? "page" : undefined}
          >
            {tabNames[value]}
            {count != null && <span className="profile-tab-count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
