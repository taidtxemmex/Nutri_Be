import {
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IngredientProposalsService } from '../services/ingredient-proposals.service';
import { CreateIngredientProposalDto } from '../dto/create-ingredient-proposal.dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
} from '../../../common/decorators';
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('IngredientProposals', ['ingredient-proposals'], { auth: true })
export class IngredientProposalsController {
  constructor(private readonly service: IngredientProposalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nộp đề xuất nguyên liệu mới' })
  @ApiStandardResponse({
    status: 201,
    description: 'Nộp đề xuất nguyên liệu thành công',
  })
  async create(
    @Body() dto: CreateIngredientProposalDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đề xuất nguyên liệu' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (CHO_DUYET, DA_DUYET, TU_CHOI)' })
  async findAll(@CurrentUser() user: any, @Query('status') status?: string): Promise<any[]> {
    return this.service.findAll(user, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đề xuất nguyên liệu' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async findById(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.service.findById(id, user);
  }

  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Put(':id/approve')
  @ApiOperation({ summary: 'Admin phê duyệt đề xuất nguyên liệu' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async approve(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.service.approve(id, user);
  }

  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @Put(':id/reject')
  @ApiOperation({ summary: 'Admin từ chối đề xuất nguyên liệu' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async reject(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.service.reject(id, reason, user);
  }
}
