import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MenuListDto {
  @ApiProperty({ description: 'ID thực đơn' })
  id: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn: NGAY | TUAN | THANG' })
  menuType: string;

  @ApiProperty({ description: 'Loại đối tượng: BENH_NHAN | NHOM_BENH' })
  targetType: string;

  @ApiPropertyOptional({ description: 'Ngày tạo' })
  createdDate?: Date | string | null;

  @ApiPropertyOptional({
    description: 'Tổng năng lượng chuỗi hiển thị',
    example: '1800 - 2200 kcal',
  })
  totalEnergy?: string | null;

  @ApiPropertyOptional({ description: 'Họ tên người tạo' })
  createdBy?: string | null;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  patientId?: string | null;

  @ApiPropertyOptional({ description: 'Tên bệnh nhân' })
  patientName?: string | null;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh' })
  diseaseGroupId?: number | null;

  @ApiPropertyOptional({ description: 'Tên nhóm bệnh' })
  diseaseGroupName?: string | null;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn dinh dưỡng' })
  nutritionLimitSetId?: string | null;
}

export class MenuMealDishDetailResponseDto {
  @ApiProperty({ description: 'ID món ăn' })
  id: string;

  @ApiProperty({ description: 'Tên món ăn' })
  name: string;

  @ApiProperty({ description: 'Khối lượng chín của món ăn (g)' })
  dishWeight: number;

  @ApiProperty({ description: 'Hệ số sống chín' })
  coefficient: number;

  @ApiProperty({ description: 'Bản đồ 86 chỉ tiêu dinh dưỡng' })
  nutrients: Record<string, number>;
}

export class MenuMealDetailResponseDto {
  @ApiProperty({ description: 'ID bữa ăn' })
  id: string;

  @ApiPropertyOptional({ description: 'Tên bữa ăn' })
  mealName?: string | null;

  @ApiProperty({ description: 'Giờ ăn' })
  time: string;

  @ApiProperty({ description: 'Danh sách món ăn trong bữa', type: [MenuMealDishDetailResponseDto] })
  dishes: MenuMealDishDetailResponseDto[];

  @ApiProperty({ description: 'Tổng dinh dưỡng của bữa ăn' })
  totalMealNutrients: Record<string, number>;
}

export class MenuDetailResponseDto {
  @ApiProperty({ description: 'ID thực đơn' })
  id: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn' })
  menuType: string;

  @ApiProperty({ description: 'Loại đối tượng' })
  targetType: string;

  @ApiPropertyOptional({ description: 'Ngày tạo' })
  createdDate?: Date | string | null;

  @ApiPropertyOptional({ description: 'Người tạo' })
  createdBy?: string | null;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  patientId?: string | null;

  @ApiPropertyOptional({ description: 'Tên bệnh nhân' })
  patientName?: string | null;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh' })
  diseaseGroupId?: number | null;

  @ApiPropertyOptional({ description: 'Tên nhóm bệnh' })
  diseaseGroupName?: string | null;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn dinh dưỡng' })
  nutritionLimitSetId?: string | null;

  @ApiPropertyOptional({ description: 'Tuần số (đang lọc)' })
  weekNo?: number | null;

  @ApiPropertyOptional({ description: 'Thứ trong tuần (đang lọc)' })
  dayOfWeek?: number | null;

  @ApiProperty({ description: 'Danh sách bữa ăn', type: [MenuMealDetailResponseDto] })
  meals: MenuMealDetailResponseDto[];

  @ApiProperty({ description: 'Tổng vi chất của ngày' })
  totalDayNutrients: Record<string, number>;
}

export class MenuFullResponseDto {
  @ApiProperty({ description: 'ID thực đơn' })
  id: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn' })
  menuType: string;

  @ApiProperty({ description: 'Loại đối tượng' })
  targetType: string;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  patientId?: string | null;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh' })
  diseaseGroupId?: number | null;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn dinh dưỡng' })
  nutritionLimitSetId?: string | null;

  @ApiProperty({ description: 'Cấu trúc cây tuần -> ngày -> bữa -> món -> nguyên liệu' })
  weeks: any[];
}

export class MenuMutationResponseDto {
  @ApiProperty({ description: 'ID thực đơn' })
  id: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn' })
  menuType: string;

  @ApiProperty({ description: 'Thông báo kết quả' })
  message: string;

  @ApiPropertyOptional({ description: 'Tổng năng lượng chuỗi hiển thị' })
  totalEnergy?: string | null;
}
