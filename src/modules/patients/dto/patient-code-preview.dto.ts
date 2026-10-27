import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientCodePreviewDto {
  @ApiProperty({ example: '0901234567-02', description: 'Mã sẽ sinh cho SĐT này' })
  code: string;

  @ApiProperty({
    example: ['Nguyễn Văn An'],
    description: 'Họ tên các bệnh nhân khác đang dùng chung SĐT',
  })
  sharedWith: string[];

  @ApiPropertyOptional({ example: '0901234567-02', description: 'Alias tương thích ngược' })
  previewCode?: string;
}
