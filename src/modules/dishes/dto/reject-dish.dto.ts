import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDishDto {
  @ApiProperty({
    description: 'Lý do từ chối phê duyệt món ăn',
    example: 'Công thức chưa chuẩn định lượng y khoa',
  })
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  reason!: string;
}
