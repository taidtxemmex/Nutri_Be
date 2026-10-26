import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDishDto {
  @ApiProperty({
    description: 'Lý do từ chối phê duyệt món ăn',
    example: 'Công thức chưa chuẩn định lượng y khoa',
  })
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  reason!: string;
}
