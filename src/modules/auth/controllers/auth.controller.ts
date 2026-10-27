import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AuthRateLimitGuard } from '../../../security/rate-limit/auth-rate-limit.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
} from '../dto';
import {
  Public,
  Auth,
  CurrentUser,
  ClientIp,
  UserAgent,
  ApiStandardResponse,
  ApiErrorResponse,
} from '../../../common/decorators';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiStandardResponse({
    status: 201,
    description: 'Đăng ký thành công, chờ xác thực email',
  })
  @ApiErrorResponse(400, 'Dữ liệu đầu vào không hợp lệ')
  @ApiErrorResponse(409, 'Tên đăng nhập hoặc email đã tồn tại')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực tài khoản qua email token' })
  @ApiStandardResponse({
    status: 200,
    description: 'Xác thực tài khoản thành công',
  })
  @ApiErrorResponse(400, 'Mã xác thực không hợp lệ hoặc đã hết hạn')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống bằng tên đăng nhập và mật khẩu' })
  @ApiStandardResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT Access Token & Refresh Token',
    type: AuthResponseDto,
  })
  @ApiErrorResponse(401, 'Sai tên đăng nhập hoặc mật khẩu')
  async login(@Body() dto: LoginDto, @ClientIp() ip: string, @UserAgent() userAgent: string) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post(['refresh', 'refresh-token'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token thông qua Refresh Token Rotation' })
  @ApiStandardResponse({
    status: 200,
    description: 'Cấp token mới thành công',
    type: AuthResponseDto,
  })
  @ApiErrorResponse(401, 'Refresh token không hợp lệ hoặc bị tái sử dụng (Replay Attack)')
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.refreshToken(dto, ip, userAgent);
  }

  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống và hủy phiên làm việc' })
  @ApiStandardResponse({
    status: 200,
    description: 'Đăng xuất thành công, thu hồi token',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', description: 'Refresh token cần thu hồi' },
        sessionId: { type: 'string', description: 'ID phiên đăng nhập' },
      },
    },
    required: false,
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body('refreshToken') refreshToken?: string,
    @Body('sessionId') sessionId?: string,
  ) {
    return this.authService.logout(user, refreshToken, sessionId);
  }

  @Public()
  @Post(['google', 'oauth2/exchange'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hoặc xác thực tài khoản qua Google OAuth2 ID Token' })
  @ApiStandardResponse({
    status: 200,
    description: 'Đăng nhập Google thành công',
    type: AuthResponseDto,
  })
  @ApiErrorResponse(400, 'Token Google không hợp lệ')
  async googleLogin(
    @Body() dto: GoogleAuthDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.googleLogin(dto, ip, userAgent);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua email' })
  @ApiStandardResponse({
    status: 200,
    description: 'Yêu cầu đặt lại mật khẩu đã được tiếp nhận',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng mã OTP/Token' })
  @ApiStandardResponse({
    status: 200,
    description: 'Đặt lại mật khẩu thành công',
  })
  @ApiErrorResponse(400, 'Mã xác thực không hợp lệ hoặc mật khẩu không đúng chuẩn')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
