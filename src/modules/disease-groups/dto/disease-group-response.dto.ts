import { ApiProperty } from '@nestjs/swagger';

export class DiseaseGroupResponseDto {
  @ApiProperty({ example: 1, description: 'ID nhóm bệnh' })
  id: number;

  @ApiProperty({ example: 'A', description: 'Mã nhóm bệnh (Code)' })
  code: string;

  @ApiProperty({ example: 'Bệnh tim mạch', description: 'Tên nhóm bệnh (Name)' })
  name: string;

  @ApiProperty({ example: 'A', description: 'Mã nhóm bệnh (Tiếng Việt alias)' })
  maNhom: string;

  @ApiProperty({ example: 'Bệnh tim mạch', description: 'Tên nhóm bệnh (Tiếng Việt alias)' })
  tenNhom: string;
}
