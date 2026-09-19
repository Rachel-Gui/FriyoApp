// ─────────────────────────────────────────────────────────────────────────────
// services/communityService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, del, request } from './api';
import type { CommunityPost, PostComment, Party, PaginatedResponse, CommunityFeedResponse } from './types';

interface CreatePostData {
  recipeId?:  string;
  caption:    string;
  /** Local file URIs from the image picker (max 5). */
  photoUris?: string[];
}

interface FeedParams {
  page?:   number;
  limit?:  number;
  filter?: 'recent' | 'following' | 'trending' | 'nearby';
}

interface GetCommentsParams {
  page?:  number;
  limit?: number;
}

export const communityService = {

  // ── Feed & Posts ────────────────────────────────────────────────────────────

  /** Paginated community feed. */
  async getFeed(params?: FeedParams): Promise<PaginatedResponse<CommunityPost>> {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set('page',   String(params.page));
    if (params?.limit)  qs.set('limit',  String(params.limit));
    if (params?.filter) qs.set('sort', params.filter);
    const q = qs.toString();
    const res = await get<CommunityFeedResponse>(`/community/feed${q ? `?${q}` : ''}`);
    return {
      data:    res.items ?? [],
      total:   res.total,
      page:    res.page,
      limit:   res.limit,
      hasMore: res.page < res.pages,
      pages:   res.pages,
    };
  },

  /** Single post with full detail. */
  async getPost(postId: string): Promise<CommunityPost> {
    return get<CommunityPost>(`/community/posts/${postId}`);
  },

  /**
   * Create a new community post.
   * If photoUris are provided, uploads them as multipart FormData;
   * otherwise sends JSON.
   */
  async createPost(data: CreatePostData): Promise<CommunityPost> {
    if (data.photoUris && data.photoUris.length > 0) {
      const form = new FormData();
      if (data.recipeId) form.append('recipe_id', data.recipeId);
      form.append('caption', data.caption);
      data.photoUris.forEach((uri, i) => {
        form.append('photos', {
          uri,
          name: `post_photo_${i}.jpg`,
          type: 'image/jpeg',
        } as any);
      });
      return request<CommunityPost>('/community/posts', { method: 'POST', formData: form });
    }
    return post<CommunityPost>('/community/posts', {
      recipeId: data.recipeId,
      caption:  data.caption,
    });
  },

  /**
   * Toggle like on a post.
   * Returns the updated like count and hasLiked state.
   */
  async toggleLike(postId: string): Promise<{ likesCount: number; hasLiked: boolean }> {
    const res = await post<{ likesCount?: number; likes_count?: number; hasLiked?: boolean; liked?: boolean }>(`/community/posts/${postId}/like`, undefined, { raw: true });
    return {
      likesCount: res.likesCount ?? res.likes_count ?? 0,
      hasLiked:   res.hasLiked ?? res.liked ?? true,
    };
  },

  // ── Comments ────────────────────────────────────────────────────────────────

  /** Paginated comments for a post. */
  async getComments(
    postId: string,
    params?: GetCommentsParams,
  ): Promise<PaginatedResponse<PostComment>> {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set('page',  String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    const res = await get<{ items: PostComment[]; total: number; page: number; limit: number; pages: number }>(
      `/community/posts/${postId}/comments${q ? `?${q}` : ''}`,
    );
    return {
      data:    res.items ?? [],
      total:   res.total,
      page:    res.page,
      limit:   res.limit,
      hasMore: res.page < res.pages,
      pages:   res.pages,
    };
  },

  /**
   * Add a comment (or reply) to a post.
   * @param parentCommentId  When set, creates a threaded reply.
   */
  async addComment(
    postId: string,
    content: string,
    parentCommentId?: string,
  ): Promise<PostComment> {
    return post<PostComment>(`/community/posts/${postId}/comments`, {
      content,
      parentCommentId,
    });
  },

  /** Report a post for moderation. */
  async reportContent(postId: string, reason: string): Promise<void> {
    return post<void>('/community/report', {
      content_type: 'post',
      content_id:   postId,
      reason,
    });
  },

  // ── Parties ─────────────────────────────────────────────────────────────────

  /** List all parties the current user belongs to. */
  async getParties(): Promise<Party[]> {
    return get<Party[]>('/community/parties');
  },

  /** Create a new cooking party. Returns the party including its invite code. */
  async createParty(data: {
    name:        string;
    description: string;
    eventDate:   string;   // ISO date string
  }): Promise<Party> {
    return post<Party>('/community/parties', data);
  },

  /**
   * Join an existing party using its invite code.
   * Returns the joined Party.
   */
  async joinParty(inviteCode: string): Promise<Party> {
    return post<Party>('/community/parties/join', { inviteCode });
  },

  /** Paginated posts feed for a specific party. */
  async getPartyPosts(
    partyId: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<CommunityPost>> {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set('page',  String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return get<PaginatedResponse<CommunityPost>>(
      `/community/parties/${partyId}/posts${q ? `?${q}` : ''}`,
    );
  },

  /**
   * Share an existing community post into a party.
   * @param postId   ID of the CommunityPost to share.
   * @param partyId  Target party ID.
   */
  async shareToParty(postId: string, partyId: string): Promise<void> {
    return post<void>(`/community/parties/${partyId}/posts/${postId}`);
  },
};
