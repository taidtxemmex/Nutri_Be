import { ProfileFilterDto } from './profile-filter.dto';
import { UpdateProfileDto } from './update-profile.dto';

export class GetMyProfileParamsDto {
  userId: string;
}

export class UpdateMyProfileParamsDto {
  userId: string;
  dto: UpdateProfileDto;
}

export class GetAllProfilesParamsDto {
  filter: ProfileFilterDto;
}
