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
import { CategoriesService } from '../services/categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryDto,
  CategoryResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  Public,
  Auth,
} from '../../../common/decorators';

@ApiController('Categories', ['category', 'categories'])
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get('public-lookup')
  @ApiOperation({
    summary: 'Lấy danh sách danh mục phục vụ Combobox/Dropdown (In-memory Cache TTL 30m)',
  })
  @ApiStandardResponse({
    type: CategoryResponseDto,
    isArray: true,
    description: 'Danh sách danh mục cho dropdown',
  })
  async getPublicLookup() {
    return this.categoriesService.getPublicLookup();
  }

  @Public()
  @Get('')
  @ApiOperation({ summary: 'Lấy danh sách danh mục phân trang kèm tìm kiếm' })
  @ApiPaginatedResponse({
    type: CategoryResponseDto,
    description: 'Danh sách danh mục có phân trang chuẩn',
  })
  async findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết danh mục theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID danh mục' })
  @ApiStandardResponse({
    type: CategoryResponseDto,
    description: 'Chi tiết danh mục',
  })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findById(id);
  }

  @Auth()
  @Post('')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo mới danh mục thực phẩm' })
  @ApiStandardResponse({
    type: CategoryResponseDto,
    description: 'Tạo danh mục thành công',
  })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Auth()
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật danh mục thực phẩm' })
  @ApiParam({ name: 'id', type: Number, description: 'ID danh mục' })
  @ApiStandardResponse({
    type: CategoryResponseDto,
    description: 'Cập nhật danh mục thành công',
  })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Auth()
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa danh mục thực phẩm (Kiểm tra ràng buộc liên kết)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID danh mục' })
  @ApiStandardResponse({
    description: 'Xóa danh mục thành công',
  })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.delete(id);
  }
}
