import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({
    description: 'Định danh đối tượng file trên hệ thống lưu trữ (dạng năm/tháng/UUID.ext)',
    example: '2026/10/d8a4358a-81a1-4389-9a28-1b6fb891c9f2.jpg',
  })
  objectKey!: string;

  @ApiProperty({
    description: 'Tên file đã được xử lý lưu trữ',
    example: 'd8a4358a-81a1-4389-9a28-1b6fb891c9f2-anh_minh_chung.jpg',
    required: false,
  })
  fileName?: string;

  @ApiProperty({
    description: 'Tên file gốc do người dùng tải lên',
    example: 'anh_minh_chung.jpg',
  })
  originalFileName!: string;

  @ApiProperty({
    description: 'MIME type thực sự đã được kiểm định qua Magic Bytes buffer',
    example: 'image/jpeg',
  })
  mimeType!: string;

  @ApiProperty({
    description: 'Dung lượng file tính bằng bytes',
    example: 1048576,
  })
  fileSize!: number;

  @ApiProperty({
    description: 'URL truy cập file tĩnh qua Web Server / Nginx',
    example: '/uploads/2026/10/d8a4358a-81a1-4389-9a28-1b6fb891c9f2.jpg',
  })
  url!: string;
}

export class EvidenceUploadResponseDto extends FileUploadResponseDto {
  @ApiProperty({
    description: 'ID bản ghi minh chứng trong cơ sở dữ liệu',
    example: '1',
  })
  id!: string;

  @ApiProperty({
    description: 'Đường dẫn xem trước có chữ ký bảo mật HMAC',
    example: 'http://localhost:8080/api/files/preview?objectKey=...&token=...&expires=...',
  })
  previewUrl!: string;

  @ApiProperty({
    description: 'Đường dẫn tải về có chữ ký bảo mật HMAC',
    example: 'http://localhost:8080/api/files/download?objectKey=...&token=...&expires=...',
  })
  downloadUrl!: string;

  @ApiProperty({
    description: 'Thời điểm tải lên',
  })
  uploadedAt!: Date;
}

export class AvatarUploadResponseDto {
  @ApiProperty({
    description: 'Trạng thái xử lý',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Đường dẫn ảnh đại diện tương đối (camelCase)',
    example: '/uploads/public/avatars/2026/11/d8a4358a-81a1-4389-9a28-1b6fb891c9f2-avatar.png',
  })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Đường dẫn ảnh đại diện tương đối (snake_case)',
    example: '/uploads/public/avatars/2026/11/d8a4358a-81a1-4389-9a28-1b6fb891c9f2-avatar.png',
  })
  avatar_url!: string;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Cập nhật ảnh đại diện thành công',
  })
  message!: string;
}

export class ImageUploadResponseDto {
  @ApiProperty({
    description: 'Trạng thái xử lý',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Đường dẫn hình ảnh tương đối (camelCase)',
    example: '/uploads/public/dishes/2026/11/d8a4358a-81a1-4389-9a28-1b6fb891c9f2-dish.png',
  })
  imageUrl!: string;

  @ApiProperty({
    description: 'Đường dẫn hình ảnh tương đối (snake_case)',
    example: '/uploads/public/dishes/2026/11/d8a4358a-81a1-4389-9a28-1b6fb891c9f2-dish.png',
  })
  image_url!: string;
}
