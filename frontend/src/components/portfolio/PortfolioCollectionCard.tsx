import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import type { PortfolioCollection } from "../../types";

type PortfolioCollectionCardProps = {
  collection: PortfolioCollection;
};

export default function PortfolioCollectionCard({ collection }: PortfolioCollectionCardProps) {
  return (
    <Link
      to={`/portfolio/${collection.id}`}
      className="portfolio-collection-card community-card photo-card"
    >
      <div className="community-card-image portfolio-collection-card__image">
        {collection.cover_image_url ? (
          <img
            src={getAssetUrl(collection.cover_image_url)}
            alt={collection.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="community-card-image-empty portfolio-collection-card__empty">
            <span>空作品集</span>
          </div>
        )}
      </div>
      <div className="community-card-meta portfolio-collection-card__meta">
        <div className="community-card-meta__main">
          <div className="community-card-meta__copy">
            <span className="community-card-meta__title">{collection.name}</span>
            <span className="portfolio-collection-card__count">{collection.photo_count} 张照片</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
