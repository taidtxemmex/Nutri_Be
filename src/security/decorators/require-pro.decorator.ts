import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PRO_KEY } from '../../config/constants/auth.constants';

export { REQUIRE_PRO_KEY };

/**
 * Decorator đánh dấu endpoint yêu cầu quyền gói tài khoản PRO còn hiệu lực.
 * Được xác thực bởi SubscriptionGuard.
 */
export const RequirePro = () => SetMetadata(REQUIRE_PRO_KEY, true);
