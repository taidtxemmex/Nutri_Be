export const CACHE_TTL_LIST_SECONDS = 15; // 15s cho API danh sách (phân trang, tìm kiếm, lọc)
export const CACHE_TTL_DETAIL_SECONDS = 60; // 60s cho API chi tiết (me, getInfo, profile)
export const CACHE_TTL_PERPETUAL = 0; // 0 = Lưu vĩnh viễn đến khi có sự kiện mutation (Rule 23)
export const CACHE_DEBOUNCE_WINDOW_MS = 500; // 500ms debounce window gom cụm mutations (Rule 25)

export const CACHE_TAG_USERS = 'users';
export const CACHE_TAG_PROFILES = 'profiles';
export const CACHE_TAG_CATEGORIES = 'categories';
export const CACHE_TAG_INGREDIENTS = 'ingredients';
export const CACHE_TAG_DISHES = 'dishes';
export const CACHE_TAG_DISEASE_GROUPS = 'disease_groups';
export const CACHE_TAG_EXTENDED_DISEASE_GROUPS = 'extended_disease_groups';
export const CACHE_TAG_PROPOSERS = 'proposers';
export const CACHE_TAG_MENUS = 'menus';
export const CACHE_TAG_DAILY_INTAKES = 'daily_intakes';
export const CACHE_TAG_PATIENTS = 'patients';
export const CACHE_TAG_PACKAGES = 'packages';
export const CACHE_TAG_PLANS = 'plans';
export const CACHE_TAG_SUBSCRIPTIONS = 'subscriptions';

export const CACHE_TTL_LOOKUP_SECONDS = 1800; // 30 phút cho public lookup (dropdown)
export const CACHE_TTL_EXCEL_TEMPLATE_SECONDS = 1800; // 30 phút cho Excel template cache

export const buildUserCacheTag = (userId: string): string => `user:${userId}`;
export const buildUserAuthCacheKey = (userId: string): string => `user:auth:${userId}`;
export const buildUserDetailCacheKey = (userId: string): string => `user:detail:${userId}`;
export const buildProposerCacheTag = (userId: string): string => `proposer:${userId}`;
export const buildMenuCacheTag = (menuId: string | number | bigint): string => `menu:${menuId}`;
export const buildDailyIntakeCacheTag = (patientId: string | number | bigint): string =>
  `daily_intake:${patientId}`;
export const buildPatientCacheTag = (patientId: string | number | bigint): string =>
  `patient:${patientId}`;
export const buildPatientDetailCacheKey = (patientId: string | number | bigint): string =>
  `patient:detail:${patientId}`;
export const buildIngredientCacheTag = (id: string | number | bigint): string => `ingredient:${id}`;
export const buildDishCacheTag = (id: string | number | bigint): string => `dish:${id}`;
export const buildCategoryCacheTag = (id: string | number | bigint): string => `category:${id}`;
export const buildCategoryDetailCacheKey = (id: string | number | bigint): string =>
  `category:detail:${id}`;
export const buildIngredientDetailCacheKey = (id: string | number | bigint): string =>
  `ingredient:detail:${id}`;
export const buildIngredientExistsCacheKey = (id: string | number | bigint): string =>
  `ingredient:exists:${id}`;
export const buildDishDetailCacheKey = (id: string | number | bigint): string =>
  `dish:detail:${id}`;
export const buildDiseaseGroupCacheTag = (id: string | number | bigint): string =>
  `disease_group:${id}`;
export const buildDiseaseGroupDetailCacheKey = (id: string | number | bigint): string =>
  `disease_group:detail:${id}`;
export const buildExtendedDiseaseGroupCacheTag = (id: string | number | bigint): string =>
  `extended_disease_group:${id}`;
export const buildExtendedDiseaseGroupDetailCacheKey = (id: string | number | bigint): string =>
  `extended_disease_group:detail:${id}`;
export const buildPackageCacheTag = (id: string | number | bigint): string => `package:${id}`;
export const buildPlanCacheTag = (id: string | number | bigint): string => `plan:${id}`;
export const buildSubscriptionCacheTag = (id: string | number | bigint): string =>
  `subscription:${id}`;
