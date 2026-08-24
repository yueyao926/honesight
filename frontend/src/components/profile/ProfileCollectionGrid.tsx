import PortfolioCollectionCard from "../portfolio/PortfolioCollectionCard";
import type { PortfolioCollection } from "../../types";

type ProfileCollectionGridProps = {
  collections: PortfolioCollection[];
  userId: number;
  own: boolean;
};

export default function ProfileCollectionGrid({ collections, userId, own }: ProfileCollectionGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {collections.map((collection) => (
        <PortfolioCollectionCard
          key={collection.id}
          collection={collection}
          to={own ? `/portfolio/${collection.id}` : `/users/${userId}/collections/${collection.id}`}
        />
      ))}
    </div>
  );
}
