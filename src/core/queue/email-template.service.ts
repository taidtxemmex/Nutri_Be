import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BaseEmailRenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailParams {
  fullName: string;
  verifyLink: string;
  expiresInMinutes?: number;
}

export interface ResetPasswordEmailParams {
  fullName: string;
  resetLink?: string;
  token?: string;
  expiresInMinutes?: number;
}

export interface PaymentRequestCreatedEmailParams {
  fullName: string;
  transactionId: string;
  packageName: string;
  amount: number | string;
}

export interface AdminNewPaymentRequestEmailParams {
  fullName: string;
  transactionId: string;
  packageName: string;
  amount: number | string;
  adminUrl?: string;
}

export interface PaymentRequestApprovedEmailParams {
  fullName: string;
  transactionId: string;
  packageName: string;
  usageDays?: number;
}

export interface PaymentRequestRejectedEmailParams {
  fullName: string;
  transactionId: string;
  packageName: string;
  reason: string;
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrencyVND(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN').format(num);
}

@Injectable()
export class EmailTemplateService {
  private readonly defaultFrontendUrl: string;

  constructor(private readonly configService?: ConfigService) {
    this.defaultFrontendUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      this.configService?.get<string>('app.frontend-url') ||
      'http://localhost:5173';
  }

  /**
   * Khung layout chuẩn HTML Responsive thương hiệu Hệ thống Dinh Dưỡng
   * Thiết kế y tế chuyên nghiệp: Tông màu chủ đạo xanh lá y tế #2e7d32, thẻ 600px, footer bản quyền
   */
  public buildBaseTemplate(title: string, bodyContent: string): string {
    const escapedTitle = escapeHtml(title);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:30px 10px;background:#f4f7f6;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;border-collapse:separate;">
        <!-- HEADER -->
        <tr>
          <td style="background:#2e7d32;color:#ffffff;padding:22px 25px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:bold;letter-spacing:0.5px;">HỆ THỐNG DINH DƯỠNG</h1>
            <p style="margin:6px 0 0 0;font-size:14px;opacity:0.92;font-weight:normal;">${escapedTitle}</p>
          </td>
        </tr>
        <!-- BODY CONTENT -->
        <tr>
          <td style="padding:30px 25px;color:#333333;font-size:14px;line-height:1.65;">
            ${bodyContent}
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#f1f8f4;border-top:1px solid #e0eee4;padding:16px 20px;text-align:center;font-size:13px;color:#666666;line-height:1.5;">
            © 2026 Hệ thống Dinh Dưỡng - Chăm sóc sức khỏe mỗi ngày 🌿
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  /**
   * 1. Xác thực đăng ký tài khoản (sendRegistrationVerification)
   */
  public renderRegistrationVerification(params: VerificationEmailParams): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Quý khách');
    const verifyLink = params.verifyLink;
    const expiresIn = params.expiresInMinutes || 15;
    const subject = 'Xác thực email đăng ký tài khoản';

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Xin chào <b>${fullName}</b>,</p>
      <p style="margin:0 0 18px 0;">Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấn vào nút bên dưới để xác thực địa chỉ email và hoàn tất quá trình kích hoạt tài khoản của bạn.</p>
      
      <div style="margin:24px 0;text-align:center;">
        <a href="${verifyLink}"
           style="background:#2e7d32;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;font-size:15px;box-shadow:0 2px 4px rgba(46,125,50,0.25);">
          Xác thực email ngay
        </a>
      </div>

      <p style="margin:0 0 10px 0;">Liên kết có hiệu lực trong vòng <b>${expiresIn} phút</b>. Nếu liên kết hết hạn, bạn sẽ cần đăng ký lại từ đầu.</p>
      <p style="margin:0 0 18px 0;color:#777777;font-size:13px;">Nếu bạn không thực hiện yêu cầu đăng ký này, xin vui lòng bỏ qua email này.</p>
      
      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Đội ngũ Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Xác thực email tài khoản', bodyContent),
      text: `Xin chào ${fullName}, vui lòng xác thực tài khoản qua liên kết: ${verifyLink} (Hiệu lực: ${expiresIn} phút).`,
    };
  }

  /**
   * 2. Quên mật khẩu / Đặt lại mật khẩu (sendResetPassword)
   */
  public renderResetPassword(params: ResetPasswordEmailParams): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Quý khách');
    const expiresIn = params.expiresInMinutes || 15;
    const subject = 'Yêu cầu đặt lại mật khẩu tài khoản';
    const resetLink =
      params.resetLink || `${this.defaultFrontendUrl}/reset-password?token=${params.token || ''}`;

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Xin chào <b>${fullName}</b>,</p>
      <p style="margin:0 0 18px 0;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên Hệ thống Dinh Dưỡng.</p>
      
      <div style="margin:24px 0;text-align:center;">
        <a href="${resetLink}"
           style="background:#2e7d32;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;font-size:15px;box-shadow:0 2px 4px rgba(46,125,50,0.25);">
          Đặt lại mật khẩu
        </a>
      </div>

      ${
        params.token
          ? `<p style="margin:0 0 10px 0;background:#f9fbfa;border:1px dashed #c8e6c9;padding:10px 14px;border-radius:6px;font-size:13px;"><b>Mã xác thực (Token):</b> <code style="font-size:14px;color:#2e7d32;">${escapeHtml(params.token)}</code></p>`
          : ''
      }

      <p style="margin:0 0 10px 0;">Yêu cầu có hiệu lực trong vòng <b>${expiresIn} phút</b>. Vì lý do bảo mật, tuyệt đối không chia sẻ liên kết hoặc mã này cho bất kỳ ai khác.</p>
      <p style="margin:0 0 18px 0;color:#777777;font-size:13px;">Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email hoặc đổi mật khẩu ngay để bảo vệ tài khoản.</p>
      
      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Đội ngũ Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Đặt lại mật khẩu', bodyContent),
      text: `Xin chào ${fullName}, vui lòng đặt lại mật khẩu qua liên kết: ${resetLink}`,
    };
  }

  /**
   * 3. Xác nhận tạo yêu cầu thanh toán (sendPaymentRequestCreated)
   */
  public renderPaymentRequestCreated(
    params: PaymentRequestCreatedEmailParams,
  ): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Quý khách');
    const transactionId = escapeHtml(params.transactionId);
    const packageName = escapeHtml(params.packageName);
    const amountStr = formatCurrencyVND(params.amount);
    const subject = `Xác nhận yêu cầu đăng ký gói ${params.packageName}`;

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Xin chào <b>${fullName}</b>,</p>
      <p style="margin:0 0 16px 0;">Yêu cầu đăng ký gói dịch vụ của bạn đã được hệ thống ghi nhận thành công và đang chờ ban quản trị phê duyệt.</p>
      
      <div style="background:#f9fbfa;border:1px solid #e0eee4;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;"><b>Mã giao dịch:</b> <span style="font-family:monospace;color:#2e7d32;font-size:15px;font-weight:bold;">${transactionId}</span></p>
        <p style="margin:0 0 8px 0;"><b>Gói dịch vụ:</b> ${packageName}</p>
        <p style="margin:0 0 8px 0;"><b>Số tiền:</b> <b style="color:#d32f2f;">${amountStr} VNĐ</b></p>
        <p style="margin:0;"><b>Trạng thái:</b> <span style="color:#ff9800;font-weight:bold;background:#fff8e1;padding:2px 8px;border-radius:4px;display:inline-block;">Chờ phê duyệt</span></p>
      </div>

      <p style="margin:16px 0 0 0;">Ban quản trị sẽ kiểm tra đối soát giao dịch và thông báo kết quả kích hoạt tài khoản trong thời gian sớm nhất.</p>
      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Đội ngũ Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Xác nhận yêu cầu đăng ký gói', bodyContent),
      text: `Xin chào ${fullName}, yêu cầu đăng ký gói ${packageName} (Mã GD: ${transactionId}) số tiền ${amountStr} VNĐ đang chờ phê duyệt.`,
    };
  }

  /**
   * 4. Thông báo SuperAdmin có yêu cầu thanh toán mới (notifySuperAdminNewPaymentRequest)
   */
  public renderNotifySuperAdminNewPaymentRequest(
    params: AdminNewPaymentRequestEmailParams,
  ): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Người dùng');
    const transactionId = escapeHtml(params.transactionId);
    const packageName = escapeHtml(params.packageName);
    const amountStr = formatCurrencyVND(params.amount);
    const adminUrl = params.adminUrl || `${this.defaultFrontendUrl}/paymentapproval`;
    const subject = `Yêu cầu đăng ký gói mới từ ${params.fullName}`;

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Kính gửi Quản trị viên,</p>
      <p style="margin:0 0 16px 0;">Hệ thống vừa nhận được một <b>yêu cầu đăng ký gói mới</b> cần phê duyệt từ người dùng.</p>
      
      <div style="background:#f9fbfa;border:1px solid #e0eee4;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;"><b>Mã giao dịch:</b> <span style="font-family:monospace;color:#2e7d32;font-size:15px;font-weight:bold;">${transactionId}</span></p>
        <p style="margin:0 0 8px 0;"><b>Người dùng:</b> ${fullName}</p>
        <p style="margin:0 0 8px 0;"><b>Gói dịch vụ:</b> ${packageName}</p>
        <p style="margin:0;"><b>Số tiền:</b> <b style="color:#d32f2f;">${amountStr} VNĐ</b></p>
      </div>

      <p style="margin:16px 0 20px 0;">Vui lòng đăng nhập vào trang quản trị để kiểm tra chứng từ chuyển khoản và phê duyệt kích hoạt tài khoản.</p>
      
      <div style="margin:20px 0;text-align:center;">
        <a href="${adminUrl}"
           style="background:#2e7d32;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;font-size:15px;box-shadow:0 2px 4px rgba(46,125,50,0.25);">
          Xem và phê duyệt yêu cầu
        </a>
      </div>

      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Hệ thống Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Có yêu cầu đăng ký gói mới', bodyContent),
      text: `Quản trị viên: Có yêu cầu đăng ký gói mới từ ${fullName}, Gói: ${packageName}, Mã GD: ${transactionId}. Xem tại: ${adminUrl}`,
    };
  }

  /**
   * 5. Duyệt thanh toán thành công (sendPaymentRequestApproved)
   */
  public renderPaymentRequestApproved(
    params: PaymentRequestApprovedEmailParams,
  ): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Quý khách');
    const transactionId = escapeHtml(params.transactionId);
    const packageName = escapeHtml(params.packageName);
    const usageDays = params.usageDays || 30;
    const subject = 'Yêu cầu đăng ký gói đã được phê duyệt';

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Xin chào <b>${fullName}</b>,</p>
      <p style="margin:0 0 16px 0;">Chúc mừng bạn! Yêu cầu đăng ký gói dịch vụ của bạn đã được <span style="color:#2e7d32;font-weight:bold;background:#e8f5e9;padding:2px 8px;border-radius:4px;">PHÊ DUYỆT THÀNH CÔNG</span>.</p>
      
      <div style="background:#f9fbfa;border:1px solid #e0eee4;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;"><b>Mã giao dịch:</b> <span style="font-family:monospace;color:#2e7d32;font-size:15px;font-weight:bold;">${transactionId}</span></p>
        <p style="margin:0 0 8px 0;"><b>Gói dịch vụ kích hoạt:</b> <b style="color:#2e7d32;">${packageName}</b></p>
        <p style="margin:0;"><b>Thời hạn sử dụng:</b> <b>${usageDays} ngày</b> (kể từ hôm nay)</p>
      </div>

      <p style="margin:16px 0 0 0;">Các tính năng nâng cao chuyên sâu (VIP/PRO) đã sẵn sàng trong tài khoản của bạn. Cảm ơn bạn đã tin tưởng và đồng hành cùng chúng tôi!</p>
      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Đội ngũ Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Yêu cầu đăng ký gói đã được phê duyệt', bodyContent),
      text: `Xin chào ${fullName}, yêu cầu đăng ký gói ${packageName} (Mã GD: ${transactionId}) đã được phê duyệt. Thời hạn: ${usageDays} ngày.`,
    };
  }

  /**
   * 6. Từ chối yêu cầu thanh toán (sendPaymentRequestRejected)
   */
  public renderPaymentRequestRejected(
    params: PaymentRequestRejectedEmailParams,
  ): BaseEmailRenderResult {
    const fullName = escapeHtml(params.fullName || 'Quý khách');
    const transactionId = escapeHtml(params.transactionId);
    const packageName = escapeHtml(params.packageName);
    const reason = escapeHtml(
      params.reason || 'Thông tin thanh toán không chính xác hoặc không đủ điều kiện.',
    );
    const subject = 'Yêu cầu đăng ký gói bị từ chối';

    const bodyContent = `
      <p style="margin:0 0 14px 0;">Xin chào <b>${fullName}</b>,</p>
      <p style="margin:0 0 16px 0;">Rất tiếc, yêu cầu đăng ký gói dịch vụ của bạn đã bị <span style="color:#e53935;font-weight:bold;background:#ffebee;padding:2px 8px;border-radius:4px;">TỪ CHỐI</span>.</p>
      
      <div style="background:#fff5f5;border:1px solid #ffd6d6;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;"><b>Mã giao dịch:</b> <span style="font-family:monospace;font-size:15px;font-weight:bold;">${transactionId}</span></p>
        <p style="margin:0 0 8px 0;"><b>Gói dịch vụ:</b> ${packageName}</p>
        <p style="margin:0;"><b>Lý do từ chối:</b> <span style="color:#c62828;">${reason}</span></p>
      </div>

      <p style="margin:16px 0 0 0;">Nếu bạn có bất kỳ thắc mắc nào hoặc muốn khiếu nại đối soát lại giao dịch, xin vui lòng phản hồi email này hoặc liên hệ bộ phận hỗ trợ khách hàng của chúng tôi.</p>
      <p style="margin:24px 0 0 0;">Trân trọng,<br><b style="color:#2e7d32;">Đội ngũ Dinh Dưỡng</b></p>
    `;

    return {
      subject,
      html: this.buildBaseTemplate('Yêu cầu đăng ký gói bị từ chối', bodyContent),
      text: `Xin chào ${fullName}, yêu cầu đăng ký gói ${packageName} (Mã GD: ${transactionId}) đã bị từ chối. Lý do: ${reason}`,
    };
  }
}
