export const CACHE_TTL_LIST_SECONDS = 15; // 15s cho API danh sách (phân trang, tìm kiếm, lọc)
export const CACHE_TTL_DETAIL_SECONDS = 60; // 60s cho API chi tiết (me, getInfo, profile)
export const CACHE_DEBOUNCE_WINDOW_MS = 500; // 500ms debounce window gom cụm mutations (Rule 25)

export const CACHE_TAG_USERS = 'users';
export const CACHE_TAG_PROFILES = 'profiles';
export const CACHE_TAG_CATEGORIES = 'categories';
export const CACHE_TAG_DISEASE_GROUPS = 'disease_groups';
export const CACHE_TAG_EXTENDED_DISEASE_GROUPS = 'extended_disease_groups';
export const CACHE_TAG_PROPOSERS = 'proposers';
export const CACHE_TAG_MENUS = 'menus';
export const CACHE_TAG_DAILY_INTAKES = 'daily_intakes';

export const CACHE_TTL_LOOKUP_SECONDS = 1800; // 30 phút cho public lookup (dropdown)
export const CACHE_TTL_EXCEL_TEMPLATE_SECONDS = 1800; // 30 phút cho Excel template cache

export const buildUserCacheTag = (userId: string): string => `user:${userId}`;
export const buildProposerCacheTag = (userId: string): string => `proposer:${userId}`;
export const buildMenuCacheTag = (menuId: string | number | bigint): string => `menu:${menuId}`;
export const buildDailyIntakeCacheTag = (patientId: string | number | bigint): string =>
  `daily_intake:${patientId}`;
