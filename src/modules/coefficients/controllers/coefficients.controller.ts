import { Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { CoefficientsService } from '../services/coefficients.service';
import { CreateCoefficientDto, UpdateCoefficientDto, CoefficientResponseDto } from '../dto';
import { ApiController, ApiStandardResponse, Auth, CurrentUser } from '../../../common/decorators';

@ApiController('Coefficients', 'coefficients', { auth: true })
export class CoefficientsController {
  constructor(private readonly coefficientsService: CoefficientsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tạo mới hệ số sống chín (User tạo riêng tư, Admin có thể tạo công khai)',
  })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    description: 'Tạo mới hệ số thành công',
  })
  async create(
    @Body() dto: CreateCoefficientDto,
    @CurrentUser() user: any,
  ): Promise<CoefficientResponseDto> {
    return this.coefficientsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả hệ số sống chín xem được' })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    isArray: true,
    description: 'Lấy danh sách hệ số thành công',
  })
  async getAll(@CurrentUser() user: any): Promise<CoefficientResponseDto[]> {
    return this.coefficientsService.findAll(user);
  }

  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách hệ số sống chín dùng chung toàn hệ thống' })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    isArray: true,
    description: 'Lấy danh sách hệ số công khai thành công',
  })
  async getPublic(): Promise<CoefficientResponseDto[]> {
    return this.coefficientsService.findPublic();
  }

  @Get('my')
  @ApiOperation({ summary: 'Lấy danh sách hệ số sống chín cá nhân của tôi' })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    isArray: true,
    description: 'Lấy danh sách hệ số cá nhân thành công',
  })
  async getMy(@CurrentUser() user: any): Promise<CoefficientResponseDto[]> {
    return this.coefficientsService.findMy(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một hệ số sống chín theo ID' })
  @ApiParam({ name: 'id', description: 'ID hệ số sống chín' })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    description: 'Lấy chi tiết hệ số thành công',
  })
  async getById(@Param('id') id: string): Promise<CoefficientResponseDto> {
    return this.coefficientsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hệ số sống chín' })
  @ApiParam({ name: 'id', description: 'ID hệ số sống chín' })
  @ApiStandardResponse({
    type: CoefficientResponseDto,
    description: 'Cập nhật hệ số thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCoefficientDto,
    @CurrentUser() user: any,
  ): Promise<CoefficientResponseDto> {
    return this.coefficientsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa hệ số sống chín' })
  @ApiParam({ name: 'id', description: 'ID hệ số sống chín' })
  @ApiStandardResponse({
    description: 'Xóa hệ số thành công',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: any): Promise<{ message: string }> {
    return this.coefficientsService.delete(id, user);
  }
}
