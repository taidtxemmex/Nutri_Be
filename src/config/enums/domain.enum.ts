export enum Gender {
  NAM = 'NAM',
  NU = 'NU',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  FACEBOOK = 'FACEBOOK',
  KEYCLOAK_GOOGLE = 'KEYCLOAK_GOOGLE',
}

export enum DeviceType {
  WEB = 'WEB',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  DESKTOP = 'DESKTOP',
  TABLET = 'TABLET',
  POSTMAN = 'POSTMAN',
  UNKNOWN = 'UNKNOWN',
}

export enum DishStatus {
  RIENG_TU = 'RIENG_TU',
  CHO_DUYET = 'CHO_DUYET',
  DA_DUYET = 'DA_DUYET',
  TU_CHOI = 'TU_CHOI',
  HE_THONG = 'HE_THONG',
}

export enum MealStatus {
  RIENG_TU = 'RIENG_TU',
  CHO_DUYET = 'CHO_DUYET',
  DA_DUYET = 'DA_DUYET',
  TU_CHOI = 'TU_CHOI',
}

export enum MenuType {
  NGAY = 'NGAY',
  TUAN = 'TUAN',
  THANG = 'THANG',
}

export enum TargetType {
  BENH_NHAN = 'BENH_NHAN',
  NHOM_BENH = 'NHOM_BENH',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum PackageStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PaymentRequestStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
}

export enum ProteinType {
  THUC_VAT = 'THUC_VAT',
  DONG_VAT = 'DONG_VAT',
}

export enum NutritionLimitWarning {
  OFF = 'OFF',
  GTE_5 = 'GTE_5',
  GTE_10 = 'GTE_10',
}

export enum IntakeInputType {
  INGREDIENT_ONLY = 'INGREDIENT_ONLY',
  BY_MEAL = 'BY_MEAL',
}
