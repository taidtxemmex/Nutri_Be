import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDishDto {
  @ApiProperty({
    description: 'Lý do từ chối phê duyệt món ăn',
    example: 'Công thức chưa chuẩn định lượng y khoa',
  })
  @IsString({ message: 'validation.dishes.reject_reason_string' })
  @MaxLength(500, { message: 'validation.dishes.reject_reason_max' })
  @IsNotEmpty({ message: 'validation.dishes.reject_reason_required' })
  reason!: string;
}
