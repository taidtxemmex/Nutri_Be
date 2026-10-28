import { IsNotEmpty, IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateExtendedDiseaseGroupDto {
  @ApiProperty({ example: '01', description: 'Mã nhóm mở rộng (suffix hoặc đầy đủ như A-01)' })
  @IsNotEmpty({ message: 'Mã nhóm mở rộng không được để trống' })
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  extendedCode: string;

  @ApiPropertyOptional({ example: '01', description: 'Mã nhóm mở rộng (alias maNhomBenh)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  maNhomBenh?: string;

  @ApiPropertyOptional({ example: '01', description: 'Mã nhóm mở rộng (alias maNhomMoRong)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  maNhomMoRong?: string;

  @ApiProperty({ example: 'Tăng huyết áp nguyên phát', description: 'Tên hiển thị' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  displayName: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát',
    description: 'Tên nhóm bệnh (alias tenNhomBenh)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  tenNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát',
    description: 'Tên hiển thị (alias tenHienThi)',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  tenHienThi?: string;

  @ApiProperty({ example: 1, description: 'ID nhóm bệnh cha' })
  @IsNotEmpty({ message: 'ID nhóm bệnh cha không được để trống' })
  @Type(() => Number)
  @IsInt({ message: 'ID nhóm bệnh cha phải là số nguyên' })
  @Min(1, { message: 'ID nhóm bệnh cha phải lớn hơn 0' })
  parentId: number;

  @ApiPropertyOptional({
    example: 'uuid-1',
    description: 'User ID (tùy chọn, hệ thống ưu tiên lấy từ JWT)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36, { message: 'userId không được vượt quá 36 ký tự' })
  userId?: string;

  getExtendedCode(): string {
    const raw = this.extendedCode || this.maNhomBenh || this.maNhomMoRong || '';
    return raw.trim();
  }

  getDisplayName(): string {
    const raw = this.displayName || this.tenNhomBenh || this.tenHienThi || '';
    return raw.trim();
  }
}
