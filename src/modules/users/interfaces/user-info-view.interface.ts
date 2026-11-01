export interface ViewUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  dob: string;
  avatarUrl: string;
  createdAt: string;
  role: string;
  status: string;
}

export interface ViewJob {
  education: string;
  major: string;
  unit: string;
  field: string;
  position: string;
}

export interface UserInfoViewResponse {
  viewUser: ViewUser;
  viewJob: ViewJob;
}
