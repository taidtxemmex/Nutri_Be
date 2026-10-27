export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
export const ACCESS_TOKEN_EXPIRES_IN = '15m';
export const JWT_ACCESS_EXPIRATION = '15m';

export const REFRESH_TOKEN_TTL_DAYS = 7;
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const JWT_REFRESH_EXPIRATION = '7d';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const BCRYPT_SALT_ROUNDS = 10;
export const EMAIL_VERIFY_TOKEN_TTL_HOURS = 24;
export const PASSWORD_RESET_OTP_TTL_MINUTES = 15;
export const MAX_LOGIN_ATTEMPTS_PER_MINUTE = 5;

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
export const SKIP_TRANSFORM_KEY = 'skipTransform';
export const IDOR_OWNERSHIP_KEY = 'idorOwnership';
export const REQUIRE_PRO_KEY = 'require_pro';

export const REFRESH_TOKEN_CACHE_TAG = 'refresh_token';
export const REFRESH_TOKEN_KEY_PREFIX = 'rt:';
export const TOKEN_DENYLIST_PREFIX = 'denylist:token:';
export const USER_TOKENS_TAG_PREFIX = 'user_tokens:';

export const AUTH_ERROR_UNAUTHORIZED = 'AUTH_001';
export const AUTH_ERROR_TOKEN_EXPIRED = 'AUTH_002';
export const AUTH_ERROR_FORBIDDEN = 'AUTH_403';
export const AUTH_ERROR_IDOR_VIOLATION = 'ERR_IDOR_VIOLATION';
export const AUTH_ERROR_REPLAY_ATTACK = 'AUTH_REPLAY_ATTACK';
export const AUTH_ERROR_USER_NOT_FOUND = 'USER_NOT_FOUND';
export const AUTH_ERROR_INACTIVE_ACCOUNT = 'USER_INACTIVE';
export const ERR_PRO_SUBSCRIPTION_REQUIRED = 'ERR_PRO_SUBSCRIPTION_REQUIRED';

export const THROTTLE_AUTH_LIMIT = 5;
export const THROTTLE_AUTH_TTL = 60;
export const THROTTLE_SENSITIVE_LIMIT = 3;
export const THROTTLE_SENSITIVE_TTL = 60;
export const THROTTLE_DEFAULT_LIMIT = 100;
export const THROTTLE_DEFAULT_TTL = 60;
