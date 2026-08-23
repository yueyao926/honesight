import vectorBorderSvg from "../../SVG/Vector.svg?url";

type ProfileFavoriteFolderCardProps = {
  title: string;
  description: string;
  count: number;
  onClick: () => void;
};

export default function ProfileFavoriteFolderCard({
  title,
  description,
  count,
  onClick,
}: ProfileFavoriteFolderCardProps) {
  return (
    <button type="button" className="profile-favorite-folder" onClick={onClick}>
      <span className="drawn-vector-frame profile-favorite-folder__frame">
        <span className="drawn-vector-frame-inner profile-favorite-folder__inner">
          <div className="profile-favorite-folder__copy">
            <p className="section-eyebrow">Collection</p>
            <h2 className="mt-2 text-2xl sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
          <strong className="profile-favorite-folder__count text-3xl text-brand-deep sm:text-4xl">{count}</strong>
        </span>
        <img
          src={vectorBorderSvg}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="drawn-vector-frame-border"
        />
      </span>
    </button>
  );
}
