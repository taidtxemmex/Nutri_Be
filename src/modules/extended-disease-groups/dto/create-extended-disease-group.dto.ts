import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateExtendedDiseaseGroupDto {
  @ApiProperty({ example: '01', description: 'Mã nhóm mở rộng (suffix hoặc đầy đủ như A-01)' })
  @IsNotEmpty({ message: 'Mã nhóm mở rộng không được để trống' })
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(20, { message: 'Mã nhóm mở rộng tối đa 20 ký tự' })
  extendedCode: string;

  @ApiProperty({ example: 'Tăng huyết áp nguyên phát', description: 'Tên hiển thị' })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  displayName: string;

  @ApiProperty({ example: 1, description: 'ID nhóm bệnh cha' })
  @IsNotEmpty({ message: 'ID nhóm bệnh cha không được để trống' })
  @Type(() => Number)
  @IsNumber({}, { message: 'ID nhóm bệnh cha phải là số' })
  parentId: number;

  @ApiPropertyOptional({
    example: 'uuid-1',
    description: 'User ID (tùy chọn, hệ thống ưu tiên lấy từ JWT)',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
