export const CACHE_TTL_LIST_SECONDS = 15; // 15s cho API danh sách (phân trang, tìm kiếm, lọc)
export const CACHE_TTL_DETAIL_SECONDS = 60; // 60s cho API chi tiết (me, getInfo, profile)
export const CACHE_DEBOUNCE_WINDOW_MS = 500; // 500ms debounce window gom cụm mutations (Rule 25)

export const CACHE_TAG_USERS = 'users';
export const CACHE_TAG_PROFILES = 'profiles';

export const buildUserCacheTag = (userId: string): string => `user:${userId}`;
