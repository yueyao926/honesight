import { useMemo } from "react";
import type { CommunityPost } from "../../api/community";
import { getNoteCardLayout, isNotePost } from "./communityFeedLayout";
import PhotoCard from "./PhotoCard";
import TextNoteCard from "./TextNoteCard";

type CommunityFeedCardProps = {
  post: CommunityPost;
  index: number;
  onChange: (post: CommunityPost) => void;
};

export default function CommunityFeedCard({ post, index, onChange }: CommunityFeedCardProps) {
  const noteLayout = useMemo(
    () => (isNotePost(post) ? getNoteCardLayout(post, index) : null),
    [post, index],
  );

  if (noteLayout) {
    return <TextNoteCard post={post} layout={noteLayout} onChange={onChange} />;
  }

  return <PhotoCard post={post} onChange={onChange} />;
}
