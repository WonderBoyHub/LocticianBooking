import type { InstagramPost, InstagramPostDto } from '../types';

export const mapInstagramPostDto = (post: InstagramPostDto): InstagramPost => ({
  id: post.id,
  instagramId: post.instagram_id,
  postType: post.post_type,
  caption: post.caption ?? null,
  mediaUrl: post.media_url,
  thumbnailUrl: post.thumbnail_url ?? null,
  permalink: post.permalink,
  likesCount: post.likes_count,
  commentsCount: post.comments_count,
  postedAt: post.posted_at,
  isFeatured: post.is_featured,
  displayOrder: post.display_order,
  syncedAt: post.synced_at ?? null,
  syncError: post.sync_error ?? null,
});
