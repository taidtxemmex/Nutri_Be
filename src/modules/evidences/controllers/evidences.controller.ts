import { Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { EvidencesService } from '../services/evidences.service';
import { ApiController, ApiStandardResponse, Auth, CurrentUser } from '../../../common/decorators';

@ApiController('Evidences', 'evidences', { auth: true })
export class EvidencesController {
  constructor(private readonly evidencesService: EvidencesService) {}

  @Get(':id/preview')
  @ApiOperation({ summary: 'Lấy đường dẫn URL xem trước (preview) minh chứng y khoa' })
  @ApiParam({ name: 'id', description: 'ID minh chứng' })
  @ApiStandardResponse({
    description: 'Sinh URL xem trước thành công',
  })
  async preview(@Param('id') id: string, @CurrentUser() user: any): Promise<string> {
    return this.evidencesService.generatePreviewUrl(id, user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Lấy đường dẫn URL tải về (download) minh chứng y khoa' })
  @ApiParam({ name: 'id', description: 'ID minh chứng' })
  @ApiStandardResponse({
    description: 'Sinh URL tải về thành công',
  })
  async download(@Param('id') id: string, @CurrentUser() user: any): Promise<string> {
    return this.evidencesService.generateDownloadUrl(id, user);
  }
}
