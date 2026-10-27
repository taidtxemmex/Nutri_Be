import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateDiseaseGroupDto {
  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh cập nhật (code)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'Mã nhóm bệnh tối đa 10 ký tự' })
  code?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa cập nhật',
    description: 'Tên nhóm bệnh (name)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh (maNhom)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'Mã nhóm bệnh tối đa 10 ký tự' })
  maNhom?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa cập nhật',
    description: 'Tên nhóm bệnh (tenNhom)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  tenNhom?: string;

  getCode(): string {
    const raw = this.code || this.maNhom || '';
    return raw.trim();
  }

  getName(): string {
    const raw = this.name || this.tenNhom || '';
    return raw.trim();
  }
}
