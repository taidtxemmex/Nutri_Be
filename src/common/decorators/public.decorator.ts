import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../../config/constants/auth.constants';

export { IS_PUBLIC_KEY };
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
