import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { DiseaseGroupsService } from '../services/disease-groups.service';
import {
  CreateDiseaseGroupDto,
  UpdateDiseaseGroupDto,
  DiseaseGroupQueryDto,
  DiseaseGroupResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  Public,
  Auth,
} from '../../../common/decorators';

@ApiController('DiseaseGroups', ['disease-groups'])
export class DiseaseGroupsController {
  constructor(private readonly diseaseGroupsService: DiseaseGroupsService) {}

  @Public()
  @Get('')
  @ApiOperation({ summary: 'Lấy danh sách nhóm bệnh phân trang' })
  @ApiPaginatedResponse({
    type: DiseaseGroupResponseDto,
    description: 'Danh sách nhóm bệnh',
  })
  async findAll(@Query() query: DiseaseGroupQueryDto) {
    return this.diseaseGroupsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết nhóm bệnh theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh' })
  @ApiStandardResponse({
    type: DiseaseGroupResponseDto,
    description: 'Chi tiết nhóm bệnh',
  })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.diseaseGroupsService.findById(id);
  }

  @Auth()
  @Post('')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo mới nhóm bệnh' })
  @ApiStandardResponse({
    type: DiseaseGroupResponseDto,
    description: 'Tạo nhóm bệnh thành công',
  })
  async create(@Body() dto: CreateDiseaseGroupDto) {
    return this.diseaseGroupsService.create(dto);
  }

  @Auth()
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật nhóm bệnh' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh' })
  @ApiStandardResponse({
    type: DiseaseGroupResponseDto,
    description: 'Cập nhật nhóm bệnh thành công',
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDiseaseGroupDto) {
    return this.diseaseGroupsService.update(id, dto);
  }

  @Auth()
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa nhóm bệnh' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh' })
  @ApiStandardResponse({
    description: 'Xóa nhóm bệnh thành công',
  })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.diseaseGroupsService.delete(id);
  }
}
