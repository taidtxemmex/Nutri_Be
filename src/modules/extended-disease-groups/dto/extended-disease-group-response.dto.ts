import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExtendedDiseaseGroupResponseDto {
  @ApiProperty({ example: 1, description: 'ID nhóm bệnh mở rộng' })
  id: number;

  @ApiProperty({ example: 'A-01', description: 'Mã nhóm mở rộng' })
  extendedCode: string;

  @ApiProperty({ example: 'Tăng huyết áp nguyên phát', description: 'Tên hiển thị' })
  displayName: string;

  @ApiPropertyOptional({ example: 'uuid-user-1', description: 'ID người sở hữu' })
  userId?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID nhóm bệnh cha' })
  parentId?: number;

  @ApiPropertyOptional({ example: 'Bệnh tim mạch', description: 'Tên nhóm bệnh cha' })
  parentName?: string;

  @ApiPropertyOptional({ example: 'A - A-01', description: 'Mã đầy đủ' })
  fullCode?: string;
}
