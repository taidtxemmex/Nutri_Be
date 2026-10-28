import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class ExportDishDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên món' })
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Danh sách các cột dinh dưỡng cần xuất ra Excel' })
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách cột xuất tối đa 100 cột' })
  @IsString({ each: true, message: 'Tên cột phải là chuỗi' })
  @MaxLength(100, { each: true, message: 'Tên cột tối đa 100 ký tự' })
  @IsOptional()
  columns?: string[];
}
