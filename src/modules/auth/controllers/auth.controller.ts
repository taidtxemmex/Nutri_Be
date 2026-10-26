import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
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
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, chờ xác thực email' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Tên đăng nhập hoặc email đã tồn tại' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực tài khoản qua email token' })
  @ApiResponse({ status: 200, description: 'Xác thực tài khoản thành công' })
  @ApiResponse({ status: 400, description: 'Mã xác thực không hợp lệ hoặc đã hết hạn' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống bằng tên đăng nhập và mật khẩu' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT Access Token & Refresh Token',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Sai tên đăng nhập hoặc mật khẩu' })
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post(['refresh', 'refresh-token'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token thông qua Refresh Token Rotation' })
  @ApiResponse({ status: 200, description: 'Cấp token mới thành công', type: AuthResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc bị tái sử dụng (Replay Attack)',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.refreshToken(dto, ip, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống và hủy phiên làm việc' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
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
  @ApiResponse({ status: 200, description: 'Đăng nhập Google thành công', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Token Google không hợp lệ' })
  async googleLogin(
    @Body() dto: GoogleAuthDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.googleLogin(dto, ip, userAgent);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua email' })
  @ApiResponse({ status: 200, description: 'Yêu cầu được tiếp nhận' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng mã OTP/Token' })
  @ApiResponse({ status: 200, description: 'Đặt lại mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description: 'Mã xác thực không hợp lệ hoặc mật khẩu không đúng chuẩn',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
