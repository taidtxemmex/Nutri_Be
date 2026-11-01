import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposerResponseDto {
  @ApiProperty({ example: 1, description: 'ID hồ sơ người đề xuất' })
  id: number;

  @ApiProperty({ example: 'uuid-1', description: 'ID tài khoản người dùng' })
  userId: string;

  @ApiPropertyOptional({ example: 'Thạc sĩ Dinh dưỡng', description: 'Trình độ học vấn' })
  education: string;

  @ApiPropertyOptional({ example: 'Bác sĩ Dinh dưỡng', description: 'Nghề nghiệp / Chuyên ngành' })
  major: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Bạch Mai', description: 'Đơn vị công tác' })
  unit: string;

  @ApiPropertyOptional({ example: 'Trưởng khoa Dinh dưỡng', description: 'Vị trí công tác' })
  position: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng lâm sàng', description: 'Lĩnh vực công tác' })
  field: string;
}
