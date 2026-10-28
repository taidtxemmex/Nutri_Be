import {
  CreatePlanDto,
  UpdatePlanDto,
  SubscriptionRequestDto,
  SubscriptionApproveDto,
} from './index';

export class CreatePlanParamDto {
  dto: CreatePlanDto;
  adminUser?: any;
}

export class FindAllPlansParamDto {
  activeOnly?: boolean;
}

export class FindPlanByIdParamDto {
  id: string | number | bigint;
}

export class UpdatePlanParamDto {
  id: string | number | bigint;
  dto: UpdatePlanDto;
  adminUser?: any;
}

export class DeletePlanParamDto {
  id: string | number | bigint;
  adminUser?: any;
}

export class RequestSubscriptionParamDto {
  userId: string;
  dto: SubscriptionRequestDto;
}

export class ApproveSubscriptionParamDto {
  subscriptionId: string | number | bigint;
  adminId: string;
}

export class RejectSubscriptionParamDto {
  subscriptionId: string | number | bigint;
  adminId: string;
  dto: SubscriptionApproveDto;
}

export class ListUserRequestsParamDto {
  userId: string;
}

export class ListAllRequestsParamDto {
  statuses?: string | string[];
}
