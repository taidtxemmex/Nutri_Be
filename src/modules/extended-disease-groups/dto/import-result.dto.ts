import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportResultDto {
  @ApiProperty({ example: true, description: 'Trạng thái thành công của tác vụ import' })
  success: boolean;

  @ApiProperty({
    example: 'Import thành công 15 nhóm bệnh mở rộng',
    description: 'Thông báo kết quả',
  })
  message: string;

  @ApiPropertyOptional({ example: 15, description: 'Số lượng bản ghi import thành công' })
  totalImported?: number;

  @ApiPropertyOptional({ example: 0, description: 'Số lượng dòng bị lỗi' })
  totalErrors?: number;

  @ApiPropertyOptional({
    example: 'extended_disease_group_import_result.xlsx',
    description: 'Tên file kết quả lỗi',
  })
  errorFileName?: string;

  errorFileBytes?: Buffer;
}
