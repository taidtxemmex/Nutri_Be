import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './index';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export class RegisterParamDto {
  dto: RegisterDto;
}

export class VerifyEmailParamDto {
  token: string;
}

export class LoginParamDto {
  dto: LoginDto;
  ip?: string;
  userAgent?: string;
}

export class RefreshTokenParamDto {
  dto: RefreshTokenDto;
  ip?: string;
  userAgent?: string;
}

export class LogoutParamDto {
  user: AuthenticatedUser;
  refreshToken?: string;
  sessionId?: string;
}

export class GoogleLoginParamDto {
  dto: GoogleAuthDto;
  ip?: string;
  userAgent?: string;
}

export class ForgotPasswordParamDto {
  dto: ForgotPasswordDto;
}

export class ResetPasswordParamDto {
  dto: ResetPasswordDto;
}
