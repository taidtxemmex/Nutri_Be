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
  user?: AuthenticatedUser;
  userId?: string;
  refreshToken?: string;
  sessionId?: string;
  authHeader?: string;
  accessToken?: string;
}

export class GoogleLoginParamDto {
  dto: GoogleAuthDto;
  ip?: string;
  userAgent?: string;
}

export class ForgotPasswordParamDto {
  dto: ForgotPasswordDto;
  clientOrigin?: string;
  redirectUrl?: string;
}

export class ResetPasswordParamDto {
  dto: ResetPasswordDto;
}

export class VerifyResetTokenParamDto {
  token: string;
}
