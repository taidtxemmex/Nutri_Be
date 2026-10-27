import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

interface EndpointMeta {
  stt: number;
  controller: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth: 'Public' | 'User' | 'Doctor' | 'Admin' | 'Superadmin' | 'DenyAll';
  description: string;
  body?: any;
  queryParams?: Record<string, string>;
}

const APIS_132: EndpointMeta[] = [
  // I. AuthController (7 APIs)
  {
    stt: 1,
    controller: 'AuthController',
    name: '1. Đăng ký tài khoản (Register)',
    method: 'POST',
    path: '/api/auth/register',
    auth: 'Public',
    description: 'Đăng ký tài khoản người dùng mới vào hệ thống',
    body: {
      username: 'doctor_test@truenutri.vn',
      email: 'doctor_test@truenutri.vn',
      password: 'Password123@',
      fullName: 'Bác Sĩ Dinh Dưỡng Test',
      phoneNumber: '0987654321',
    },
  },
  {
    stt: 2,
    controller: 'AuthController',
    name: '2. Xác thực mã OTP email (Verify Email)',
    method: 'POST',
    path: '/api/auth/verify-email',
    auth: 'Public',
    description: 'Xác thực mã OTP qua email để kích hoạt tài khoản',
    body: {
      email: 'doctor_test@truenutri.vn',
      otp: '123456',
    },
  },
  {
    stt: 3,
    controller: 'AuthController',
    name: '3. Đăng nhập tài khoản (Login)',
    method: 'POST',
    path: '/api/auth/login',
    auth: 'Public',
    description: 'Đăng nhập tài khoản, cấp JWT Access Token & Refresh Token',
    body: {
      username: 'doctor_test@truenutri.vn',
      password: 'Password123@',
    },
  },
  {
    stt: 4,
    controller: 'AuthController',
    name: '4. Làm mới Access Token (Refresh Token)',
    method: 'POST',
    path: '/api/auth/refresh',
    auth: 'User',
    description: 'Làm mới Access Token bằng Refresh Token còn hạn',
    body: {
      refreshToken: '{{refreshToken}}',
    },
  },
  {
    stt: 5,
    controller: 'AuthController',
    name: '5. Đăng xuất tài khoản (Logout)',
    method: 'POST',
    path: '/api/auth/logout',
    auth: 'User',
    description: 'Đăng xuất người dùng, vô hiệu hóa Refresh Token',
    body: {
      refreshToken: '{{refreshToken}}',
    },
  },
  {
    stt: 6,
    controller: 'AuthController',
    name: '6. Trao đổi mã Google OAuth2 (OAuth2 Exchange)',
    method: 'POST',
    path: '/api/auth/oauth2/exchange',
    auth: 'Public',
    description: 'Trao đổi mã xác thực Google OAuth2 lấy Token đăng nhập',
    body: {
      code: '4/0AY0e-g7ExampleGoogleAuthCode',
    },
  },
  {
    stt: 7,
    controller: 'AuthController',
    name: '7. Quên mật khẩu (Forgot Password)',
    method: 'POST',
    path: '/api/auth/forgot-password',
    auth: 'Public',
    description: 'Gửi yêu cầu email khôi phục / đặt lại mật khẩu',
    body: {
      email: 'doctor_test@truenutri.vn',
    },
  },

  // II. CategoryController (5 APIs)
  {
    stt: 8,
    controller: 'CategoryController',
    name: '8. Tạo mới danh mục nhóm thực phẩm',
    method: 'POST',
    path: '/api/category',
    auth: 'Admin',
    description: 'Tạo mới danh mục nhóm thực phẩm',
    body: {
      ten_nhom: 'Ngũ cốc và sản phẩm chế biến',
      ma_nhom: 'NC01',
      mo_ta: 'Các loại ngũ cốc giàu tinh bột',
    },
  },
  {
    stt: 9,
    controller: 'CategoryController',
    name: '9. Cập nhật danh mục nhóm thực phẩm',
    method: 'PUT',
    path: '/api/category/1',
    auth: 'Admin',
    description: 'Cập nhật thông tin danh mục nhóm thực phẩm theo ID',
    body: {
      ten_nhom: 'Ngũ cốc nguyên hạt dinh dưỡng cao',
      mo_ta: 'Bổ sung thêm yến mạch, gạo lứt',
    },
  },
  {
    stt: 10,
    controller: 'CategoryController',
    name: '10. Danh sách toàn bộ nhóm thực phẩm',
    method: 'GET',
    path: '/api/category',
    auth: 'Public',
    description: 'Lấy danh sách toàn bộ nhóm thực phẩm (có cache 24h)',
    queryParams: { page: '1', limit: '20', search: '' },
  },
  {
    stt: 11,
    controller: 'CategoryController',
    name: '11. Chi tiết một nhóm thực phẩm theo ID',
    method: 'GET',
    path: '/api/category/1',
    auth: 'Public',
    description: 'Lấy chi tiết thông tin một nhóm thực phẩm theo ID',
  },
  {
    stt: 12,
    controller: 'CategoryController',
    name: '12. Xóa danh mục nhóm thực phẩm theo ID',
    method: 'DELETE',
    path: '/api/category/1',
    auth: 'Admin',
    description: 'Xóa danh mục nhóm thực phẩm theo ID',
  },

  // III. ChatbotController (1 API)
  {
    stt: 13,
    controller: 'ChatbotController',
    name: '13. Tư vấn Chatbot AI (Deprecated 410 Gone)',
    method: 'POST',
    path: '/api/chatbot',
    auth: 'User',
    description: 'Chatbot AI cũ đã dừng hỗ trợ -> Trả về HTTP 410 Gone',
    body: {
      message: 'Xin chào, tư vấn thực đơn cho người tiểu đường',
    },
  },

  // IV. CoefficientController (7 APIs)
  {
    stt: 14,
    controller: 'CoefficientController',
    name: '14. Thêm mới hệ số sống/chín',
    method: 'POST',
    path: '/api/coefficients',
    auth: 'Doctor',
    description: 'Thêm mới hệ số quy đổi sống/chín cho nguyên liệu',
    body: {
      name: 'Hệ số luộc chín rau củ',
      rate: 0.85,
      isPublic: true,
      description: 'Quy đổi khối lượng hao hụt khi luộc',
    },
  },
  {
    stt: 15,
    controller: 'CoefficientController',
    name: '15. Danh sách tất cả hệ số sống/chín',
    method: 'GET',
    path: '/api/coefficients',
    auth: 'Doctor',
    description: 'Lấy danh sách tất cả các hệ số sống/chín',
  },
  {
    stt: 16,
    controller: 'CoefficientController',
    name: '16. Chi tiết hệ số sống/chín theo ID',
    method: 'GET',
    path: '/api/coefficients/1',
    auth: 'Doctor',
    description: 'Lấy chi tiết hệ số sống/chín theo ID',
  },
  {
    stt: 17,
    controller: 'CoefficientController',
    name: '17. Cập nhật hệ số sống/chín theo ID',
    method: 'PUT',
    path: '/api/coefficients/1',
    auth: 'Doctor',
    description: 'Cập nhật hệ số sống/chín theo ID',
    body: {
      rate: 0.88,
      description: 'Hiệu chỉnh tỷ lệ hao hụt theo thực nghiệm mới',
    },
  },
  {
    stt: 18,
    controller: 'CoefficientController',
    name: '18. Xóa hệ số sống/chín theo ID',
    method: 'DELETE',
    path: '/api/coefficients/1',
    auth: 'Doctor',
    description: 'Xóa hệ số sống/chín theo ID',
  },
  {
    stt: 19,
    controller: 'CoefficientController',
    name: '19. Lấy danh sách hệ số sống/chín công khai',
    method: 'GET',
    path: '/api/coefficients/public',
    auth: 'Doctor',
    description: 'Lấy danh sách hệ số sống/chín dùng chung toàn hệ thống',
  },
  {
    stt: 20,
    controller: 'CoefficientController',
    name: '20. Lấy danh sách hệ số sống/chín cá nhân',
    method: 'GET',
    path: '/api/coefficients/my',
    auth: 'Doctor',
    description: 'Lấy danh sách hệ số sống/chín do chính người dùng định nghĩa',
  },

  // V. DailyIntakeController (8 APIs)
  {
    stt: 21,
    controller: 'DailyIntakeController',
    name: '21. Tạo nhật ký khẩu phần 24h lâm sàng',
    method: 'POST',
    path: '/api/daily-intakes',
    auth: 'Doctor',
    description: 'Tạo nhật ký khẩu phần 24h lâm sàng cho bệnh nhân',
    body: {
      patientId: '1',
      date: '2026-10-27',
      note: 'Khẩu phần ăn ngày thứ 3 sau nhập viện',
      inputMethod: 'BY_DISH',
      meals: [
        {
          mealCode: 'SANG',
          dishes: [{ dishId: '1', weightGram: 150 }],
        },
      ],
    },
  },
  {
    stt: 22,
    controller: 'DailyIntakeController',
    name: '22. Lấy khẩu phần 24h theo bệnh nhân và ngày',
    method: 'GET',
    path: '/api/daily-intakes',
    auth: 'Doctor',
    description: 'Lấy khẩu phần 24h theo patientId và ngày khảo sát date',
    queryParams: { patientId: '1', date: '2026-10-27' },
  },
  {
    stt: 23,
    controller: 'DailyIntakeController',
    name: '23. Lấy chi tiết bản ghi khẩu phần 24h',
    method: 'GET',
    path: '/api/daily-intakes/1',
    auth: 'Doctor',
    description: 'Lấy chi tiết bản ghi khẩu phần 24h theo ID',
  },
  {
    stt: 24,
    controller: 'DailyIntakeController',
    name: '24. Cập nhật nhật ký khẩu phần 24h',
    method: 'PUT',
    path: '/api/daily-intakes/1',
    auth: 'Doctor',
    description: 'Cập nhật nhật ký khẩu phần 24h theo ID',
    body: {
      note: 'Bệnh nhân ăn bổ sung thêm sữa hạt',
    },
  },
  {
    stt: 25,
    controller: 'DailyIntakeController',
    name: '25. Xóa bản ghi khẩu phần 24h',
    method: 'DELETE',
    path: '/api/daily-intakes/1',
    auth: 'Doctor',
    description: 'Xóa bản ghi khẩu phần 24h (Cascade Delete món & nguyên liệu)',
  },
  {
    stt: 26,
    controller: 'DailyIntakeController',
    name: '26. Lấy lịch sử khẩu phần của bệnh nhân',
    method: 'GET',
    path: '/api/daily-intakes/patient/1',
    auth: 'Doctor',
    description: 'Lấy lịch sử tất cả các ngày ghi khẩu phần của bệnh nhân',
  },
  {
    stt: 27,
    controller: 'DailyIntakeController',
    name: '27. Tải template Excel import khẩu phần',
    method: 'GET',
    path: '/api/daily-intakes/import-template',
    auth: 'Doctor',
    description: 'Tải template Excel import khẩu phần (theo bữa hoặc nguyên liệu)',
  },
  {
    stt: 28,
    controller: 'DailyIntakeController',
    name: '28. Import khẩu phần 24h từ file Excel',
    method: 'POST',
    path: '/api/daily-intakes/import',
    auth: 'Doctor',
    description: 'Import khẩu phần ăn 24h từ file Excel kèm báo lỗi',
    queryParams: { patientId: '1', date: '2026-10-27', overwrite: 'false' },
  },

  // VI. DailyIntakeExportController (1 API)
  {
    stt: 29,
    controller: 'DailyIntakeExportController',
    name: '29. Xuất báo cáo khẩu phần 24h Excel',
    method: 'POST',
    path: '/api/daily-intakes/export',
    auth: 'Doctor',
    description: 'Xuất báo cáo RDA vi chất 24h và khối lượng nhóm thực phẩm (ExcelJS)',
    body: {
      templateType: 'TOTAL_FOOD_GROUP_MULTI_PATIENTS',
      patientIds: [1, 2],
      fromDate: '2026-10-01',
      toDate: '2026-10-27',
    },
  },

  // VII. DiseaseGroupController (5 APIs)
  {
    stt: 30,
    controller: 'DiseaseGroupController',
    name: '30. Tạo mới nhóm bệnh gốc (ICD)',
    method: 'POST',
    path: '/api/disease-groups',
    auth: 'Admin',
    description: 'Tạo nhóm bệnh lý gốc chuẩn y khoa',
    body: {
      ten_nhom: 'Bệnh lý Chuyển hóa & Nội tiết',
      ma_nhom: 'ICD-E10-E14',
      mo_ta: 'Nhóm bệnh tiểu đường, rối loạn lipid máu',
    },
  },
  {
    stt: 31,
    controller: 'DiseaseGroupController',
    name: '31. Danh sách tất cả nhóm bệnh gốc',
    method: 'GET',
    path: '/api/disease-groups',
    auth: 'Public',
    description: 'Lấy danh sách tất cả các nhóm bệnh gốc',
  },
  {
    stt: 32,
    controller: 'DiseaseGroupController',
    name: '32. Chi tiết nhóm bệnh lý theo ID',
    method: 'GET',
    path: '/api/disease-groups/1',
    auth: 'Public',
    description: 'Lấy chi tiết thông tin một nhóm bệnh lý theo ID',
  },
  {
    stt: 33,
    controller: 'DiseaseGroupController',
    name: '33. Cập nhật nhóm bệnh lý gốc',
    method: 'PUT',
    path: '/api/disease-groups/1',
    auth: 'Admin',
    description: 'Cập nhật thông tin nhóm bệnh lý gốc theo ID',
    body: {
      ten_nhom: 'Bệnh lý Chuyển hóa, Nội tiết & Tim mạch',
    },
  },
  {
    stt: 34,
    controller: 'DiseaseGroupController',
    name: '34. Xóa nhóm bệnh lý gốc theo ID',
    method: 'DELETE',
    path: '/api/disease-groups/1',
    auth: 'Admin',
    description: 'Xóa nhóm bệnh lý gốc theo ID',
  },

  // VIII. DishController (15 APIs)
  {
    stt: 35,
    controller: 'DishController',
    name: '35. Danh sách món ăn cá nhân (kèm lọc trạng thái)',
    method: 'GET',
    path: '/api/dish',
    auth: 'Doctor',
    description: 'Lấy danh sách món ăn cá nhân lọc theo trạng thái (statuses)',
    queryParams: { page: '1', limit: '20', statuses: 'APPROVED,PENDING' },
  },
  {
    stt: 36,
    controller: 'DishController',
    name: '36. Tải file Excel mẫu import món ăn',
    method: 'GET',
    path: '/api/dish/import-template',
    auth: 'Doctor',
    description: 'Tải file Excel mẫu import công thức món ăn',
  },
  {
    stt: 37,
    controller: 'DishController',
    name: '37. Import danh sách món ăn từ Excel',
    method: 'POST',
    path: '/api/dish/import',
    auth: 'Doctor',
    description: 'Import danh sách món ăn từ file Excel',
  },
  {
    stt: 38,
    controller: 'DishController',
    name: '38. Gợi ý tự động tìm kiếm nhanh món ăn',
    method: 'GET',
    path: '/api/dish/autocomplete',
    auth: 'Doctor',
    description: 'Tự động gợi ý tìm kiếm nhanh món ăn theo từ khóa',
    queryParams: { keyword: 'canh chua' },
  },
  {
    stt: 39,
    controller: 'DishController',
    name: '39. Chi tiết nguyên liệu & 86 vi chất món ăn',
    method: 'GET',
    path: '/api/dish/1',
    auth: 'Doctor',
    description: 'Lấy chi tiết nguyên liệu, khối lượng và 86 vi chất của món ăn',
  },
  {
    stt: 40,
    controller: 'DishController',
    name: '40. Tạo mới món ăn (RecipeHash SHA-256)',
    method: 'POST',
    path: '/api/dish',
    auth: 'Doctor',
    description: 'Tạo mới món ăn (tự động tính canonical RecipeHash SHA-256)',
    body: {
      ten_mon: 'Cháo yến mạch ức gà xé',
      mo_ta: 'Cháo dinh dưỡng cho bệnh nhân tiểu đường',
      ingredients: [
        { ingredientId: 1, weight: 50 },
        { ingredientId: 2, weight: 100 },
      ],
    },
  },
  {
    stt: 41,
    controller: 'DishController',
    name: '41. Cập nhật thông tin và công thức món ăn',
    method: 'PUT',
    path: '/api/dish/1',
    auth: 'Doctor',
    description: 'Cập nhật thông tin và công thức thành phần món ăn theo ID',
    body: {
      ten_mon: 'Cháo yến mạch ức gà xé hạt sen',
      ingredients: [
        { ingredientId: 1, weight: 60 },
        { ingredientId: 2, weight: 100 },
      ],
    },
  },
  {
    stt: 42,
    controller: 'DishController',
    name: '42. Nhân bản sao chép món ăn (Clone)',
    method: 'POST',
    path: '/api/dish/1/clone',
    auth: 'Doctor',
    description: 'Sao chép nhân bản một món ăn thành bản ghi mới của người dùng',
  },
  {
    stt: 43,
    controller: 'DishController',
    name: '43. Xóa món ăn của cá nhân',
    method: 'DELETE',
    path: '/api/dish/1',
    auth: 'Doctor',
    description: 'Xóa món ăn của cá nhân theo ID',
  },
  {
    stt: 44,
    controller: 'DishController',
    name: '44. Xuất danh sách món ăn ra Excel',
    method: 'POST',
    path: '/api/dish/export',
    auth: 'Doctor',
    description: 'Xuất danh sách món ăn đã chọn ra file Excel',
    body: {
      dishIds: [1, 2, 3],
    },
  },
  {
    stt: 45,
    controller: 'DishController',
    name: '45. Gửi đề xuất món ăn lên làm món công khai',
    method: 'PUT',
    path: '/api/dish/1/propose',
    auth: 'Doctor',
    description: 'Gửi đề xuất món ăn lên làm món công khai hệ thống',
  },
  {
    stt: 46,
    controller: 'DishController',
    name: '46. Quản trị viên duyệt đề xuất món ăn',
    method: 'PUT',
    path: '/api/dish/1/approve',
    auth: 'Admin',
    description: 'Quản trị viên duyệt đề xuất món ăn thành món công khai',
  },
  {
    stt: 47,
    controller: 'DishController',
    name: '47. Quản trị viên từ chối đề xuất món ăn',
    method: 'PUT',
    path: '/api/dish/1/reject',
    auth: 'Admin',
    description: 'Quản trị viên từ chối đề xuất món ăn kèm lý do',
    body: {
      reason: 'Công thức chưa có định lượng chính xác',
    },
  },
  {
    stt: 48,
    controller: 'DishController',
    name: '48. Lấy danh sách món ăn công khai hệ thống',
    method: 'GET',
    path: '/api/dish/public',
    auth: 'Public',
    description: 'Lấy danh sách các món ăn đã được kiểm duyệt công khai',
    queryParams: { page: '1', limit: '20' },
  },
  {
    stt: 49,
    controller: 'DishController',
    name: '49. Quản trị viên lấy danh sách toàn bộ món ăn',
    method: 'GET',
    path: '/api/dish/admin',
    auth: 'Admin',
    description: 'Quản trị viên lấy danh sách toàn bộ món ăn để xét duyệt',
    queryParams: { page: '1', limit: '20', status: 'PENDING' },
  },

  // IX. EvidenceController (2 APIs)
  {
    stt: 50,
    controller: 'EvidenceController',
    name: '50. Xem trước minh chứng y tế (Preview)',
    method: 'GET',
    path: '/api/evidences/1/preview',
    auth: 'User',
    description: 'Lấy URL xem trước file chứng từ/ảnh minh chứng y tế',
  },
  {
    stt: 51,
    controller: 'EvidenceController',
    name: '51. Tải xuống minh chứng y tế (Download)',
    method: 'GET',
    path: '/api/evidences/1/download',
    auth: 'User',
    description: 'Lấy URL tải xuống file chứng từ/minh chứng thanh toán',
  },

  // X. ExportController (1 API)
  {
    stt: 52,
    controller: 'ExportController',
    name: '52. Xuất 86 vi chất nguyên liệu ra Excel',
    method: 'POST',
    path: '/api/export/ingredients',
    auth: 'Doctor',
    description: 'Xuất danh sách 86 chỉ tiêu vi chất nguyên liệu ra file Excel',
    body: {
      ingredientIds: [1, 2, 3, 4, 5],
    },
  },

  // XI. ExtendedDiseaseGroupController (7 APIs)
  {
    stt: 53,
    controller: 'ExtendedDiseaseGroupController',
    name: '53. Tạo mới nhóm bệnh mở rộng',
    method: 'POST',
    path: '/api/extended-disease-groups',
    auth: 'Doctor',
    description: 'Tạo mới nhóm bệnh lý mở rộng / chuyên sâu của bác sĩ',
    body: {
      ten_nhom: 'Đái tháo đường thai kỳ',
      disease_group_id: 1,
      mo_ta: 'Theo dõi đường huyết chặt chẽ trong thai kỳ',
    },
  },
  {
    stt: 54,
    controller: 'ExtendedDiseaseGroupController',
    name: '54. Danh sách toàn bộ nhóm bệnh mở rộng',
    method: 'GET',
    path: '/api/extended-disease-groups',
    auth: 'Doctor',
    description: 'Lấy danh sách toàn bộ nhóm bệnh lý mở rộng',
  },
  {
    stt: 55,
    controller: 'ExtendedDiseaseGroupController',
    name: '55. Chi tiết nhóm bệnh mở rộng theo ID',
    method: 'GET',
    path: '/api/extended-disease-groups/1',
    auth: 'Doctor',
    description: 'Lấy chi tiết nhóm bệnh lý mở rộng theo ID',
  },
  {
    stt: 56,
    controller: 'ExtendedDiseaseGroupController',
    name: '56. Cập nhật nhóm bệnh mở rộng theo ID',
    method: 'PUT',
    path: '/api/extended-disease-groups/1',
    auth: 'Doctor',
    description: 'Cập nhật thông tin nhóm bệnh lý mở rộng theo ID',
    body: {
      ten_nhom: 'Đái tháo đường thai kỳ type A1/A2',
    },
  },
  {
    stt: 57,
    controller: 'ExtendedDiseaseGroupController',
    name: '57. Xóa nhóm bệnh mở rộng theo ID',
    method: 'DELETE',
    path: '/api/extended-disease-groups/1',
    auth: 'Doctor',
    description: 'Xóa nhóm bệnh lý mở rộng theo ID',
  },
  {
    stt: 58,
    controller: 'ExtendedDiseaseGroupController',
    name: '58. Tải template Excel import nhóm bệnh mở rộng',
    method: 'GET',
    path: '/api/extended-disease-groups/import-template',
    auth: 'Doctor',
    description: 'Tải template Excel import nhóm bệnh mở rộng',
  },
  {
    stt: 59,
    controller: 'ExtendedDiseaseGroupController',
    name: '59. Import danh sách nhóm bệnh mở rộng từ Excel',
    method: 'POST',
    path: '/api/extended-disease-groups/import',
    auth: 'Doctor',
    description: 'Import danh sách nhóm bệnh mở rộng từ file Excel',
  },

  // XII. FileController (1 API)
  {
    stt: 60,
    controller: 'FileController',
    name: '60. Tải tệp lên máy chủ (Upload File)',
    method: 'POST',
    path: '/api/files',
    auth: 'User',
    description: 'Upload file đa phương tiện (Multer + Magic Bytes validation)',
  },

  // XIII. IngredientController (9 APIs)
  {
    stt: 61,
    controller: 'IngredientController',
    name: '61. Thêm mới nguyên liệu kèm 86 vi chất',
    method: 'POST',
    path: '/api/ingredient',
    auth: 'Doctor',
    description: 'Thêm mới nguyên liệu thực phẩm kèm chỉ số 86 vi chất',
    body: {
      ten_nguyen_lieu: 'Gạo lứt đỏ Điện Biên',
      ma_nguyen_lieu: 'GLD-01',
      category_id: 1,
      nang_luong_kcal: 345.5,
      chat_dam_g: 7.5,
      chat_beo_g: 2.7,
      chat_bot_duong_g: 72.8,
    },
  },
  {
    stt: 62,
    controller: 'IngredientController',
    name: '62. Danh sách rút gọn nguyên liệu (Summary)',
    method: 'GET',
    path: '/api/ingredient/summary',
    auth: 'Public',
    description: 'Lấy danh sách rút gọn (chỉ ID và Tên) chống overfetching',
  },
  {
    stt: 63,
    controller: 'IngredientController',
    name: '63. Danh sách nguyên liệu phân trang',
    method: 'GET',
    path: '/api/ingredient',
    auth: 'Public',
    description: 'Lấy danh sách nguyên liệu có phân trang (page, size)',
    queryParams: { page: '1', limit: '20', search: '' },
  },
  {
    stt: 64,
    controller: 'IngredientController',
    name: '64. Lấy toàn bộ nguyên liệu (Client Filter)',
    method: 'GET',
    path: '/api/ingredient/all',
    auth: 'Public',
    description: 'Lấy toàn bộ nguyên liệu (phục vụ bộ lọc Client FE)',
  },
  {
    stt: 65,
    controller: 'IngredientController',
    name: '65. Chi tiết 86 chỉ tiêu vi chất nguyên liệu',
    method: 'GET',
    path: '/api/ingredient/1',
    auth: 'Public',
    description: 'Lấy chi tiết đầy đủ 86 chỉ tiêu dinh dưỡng theo ID',
  },
  {
    stt: 66,
    controller: 'IngredientController',
    name: '66. Cập nhật thông tin và vi chất nguyên liệu',
    method: 'PUT',
    path: '/api/ingredient/1',
    auth: 'Doctor',
    description: 'Cập nhật thông tin và bảng vi chất của nguyên liệu theo ID',
    body: {
      ten_nguyen_lieu: 'Gạo lứt huyết rồng hữu cơ',
      nang_luong_kcal: 350.0,
    },
  },
  {
    stt: 67,
    controller: 'IngredientController',
    name: '67. Xóa nguyên liệu thực phẩm theo ID',
    method: 'DELETE',
    path: '/api/ingredient/1',
    auth: 'Admin',
    description: 'Xóa nguyên liệu thực phẩm theo ID',
  },
  {
    stt: 68,
    controller: 'IngredientController',
    name: '68. Tải file Excel mẫu import nguyên liệu',
    method: 'GET',
    path: '/api/ingredient/template',
    auth: 'Doctor',
    description: 'Tải file Excel mẫu import nguyên liệu (chọn cột chỉ tiêu)',
  },
  {
    stt: 69,
    controller: 'IngredientController',
    name: '69. Import nguyên liệu từ file Excel',
    method: 'POST',
    path: '/api/ingredient/import',
    auth: 'Doctor',
    description: 'Import danh sách nguyên liệu từ file Excel kèm kiểm tra lỗi',
  },

  // XIV. IngredientProposalController (5 APIs)
  {
    stt: 70,
    controller: 'IngredientProposalController',
    name: '70. Tạo đề xuất nguyên liệu mới',
    method: 'POST',
    path: '/api/ingredient-proposals',
    auth: 'Doctor',
    description: 'Tạo đề xuất bổ sung nguyên liệu mới kèm minh chứng y tế',
    body: {
      ten_nguyen_lieu: 'Tảo xoắn Spirulina hữu cơ',
      mo_ta: 'Bổ sung nguồn đạm thực vật và khoáng chất cao',
      evidence_id: 1,
    },
  },
  {
    stt: 71,
    controller: 'IngredientProposalController',
    name: '71. Quản trị viên lấy danh sách đề xuất nguyên liệu',
    method: 'GET',
    path: '/api/ingredient-proposals',
    auth: 'Admin',
    description: 'Quản trị viên lấy danh sách đề xuất nguyên liệu theo trạng thái',
    queryParams: { status: 'PENDING', page: '1', limit: '20' },
  },
  {
    stt: 72,
    controller: 'IngredientProposalController',
    name: '72. Chi tiết một đề xuất nguyên liệu theo ID',
    method: 'GET',
    path: '/api/ingredient-proposals/1',
    auth: 'Doctor',
    description: 'Lấy thông tin chi tiết một đề xuất nguyên liệu theo ID',
  },
  {
    stt: 73,
    controller: 'IngredientProposalController',
    name: '73. Quản trị viên duyệt đề xuất nguyên liệu',
    method: 'PUT',
    path: '/api/ingredient-proposals/1/approve',
    auth: 'Admin',
    description: 'Quản trị viên duyệt đề xuất -> sinh nguyên liệu chính thức',
  },
  {
    stt: 74,
    controller: 'IngredientProposalController',
    name: '74. Quản trị viên từ chối đề xuất nguyên liệu',
    method: 'PUT',
    path: '/api/ingredient-proposals/1/reject',
    auth: 'Admin',
    description: 'Quản trị viên từ chối đề xuất nguyên liệu kèm lý do',
    body: {
      reason: 'Thiếu chứng nhận kiểm nghiệm vi sinh',
    },
  },

  // XV. MealController (5 APIs - DEAD CODE)
  {
    stt: 75,
    controller: 'MealController',
    name: '75. Tạo bữa ăn độc lập (Bị vô hiệu hóa - DenyAll)',
    method: 'POST',
    path: '/api/meal',
    auth: 'DenyAll',
    description: 'Tạo bữa ăn độc lập (Bị khóa cứng, FE không dùng)',
  },
  {
    stt: 76,
    controller: 'MealController',
    name: '76. Lấy danh sách bữa ăn (Bị vô hiệu hóa - DenyAll)',
    method: 'GET',
    path: '/api/meal',
    auth: 'DenyAll',
    description: 'Lấy danh sách bữa ăn độc lập',
  },
  {
    stt: 77,
    controller: 'MealController',
    name: '77. Chi tiết bữa ăn theo ID (Bị vô hiệu hóa - DenyAll)',
    method: 'GET',
    path: '/api/meal/1',
    auth: 'DenyAll',
    description: 'Lấy chi tiết bữa ăn độc lập theo ID',
  },
  {
    stt: 78,
    controller: 'MealController',
    name: '78. Cập nhật bữa ăn theo ID (Bị vô hiệu hóa - DenyAll)',
    method: 'PUT',
    path: '/api/meal/1',
    auth: 'DenyAll',
    description: 'Cập nhật bữa ăn độc lập theo ID',
  },
  {
    stt: 79,
    controller: 'MealController',
    name: '79. Xóa bữa ăn theo ID (Bị vô hiệu hóa - DenyAll)',
    method: 'DELETE',
    path: '/api/meal/1',
    auth: 'DenyAll',
    description: 'Xóa bữa ăn độc lập theo ID',
  },

  // XVI. MenuController (7 APIs)
  {
    stt: 80,
    controller: 'MenuController',
    name: '80. Tạo thực đơn đa cấp (Copy-on-Write)',
    method: 'POST',
    path: '/api/menu',
    auth: 'Doctor',
    description: 'Tạo thực đơn đa cấp (ngày/tuần/tháng) áp dụng Copy-on-Write',
    body: {
      ten_thuc_don: 'Thực đơn mẫu 7 ngày cho đái tháo đường',
      loai_thuc_don: 'TUAN',
      mo_ta: 'Năng lượng 1600 kcal/ngày',
      days: [
        {
          dayIndex: 1,
          meals: [
            {
              mealCode: 'SANG',
              dishes: [{ dishId: 1, weight: 200 }],
            },
          ],
        },
      ],
    },
  },
  {
    stt: 81,
    controller: 'MenuController',
    name: '81. Danh sách thực đơn cá nhân',
    method: 'GET',
    path: '/api/menu',
    auth: 'Doctor',
    description: 'Lấy danh sách thực đơn cá nhân kèm tìm kiếm từ khóa',
    queryParams: { page: '1', limit: '20', search: '' },
  },
  {
    stt: 82,
    controller: 'MenuController',
    name: '82. Chi tiết thực đơn (lọc theo tuần và ngày)',
    method: 'GET',
    path: '/api/menu/1',
    auth: 'Doctor',
    description: 'Lấy chi tiết thực đơn (lọc theo tuần week và ngày day)',
    queryParams: { week: '1', day: '1' },
  },
  {
    stt: 83,
    controller: 'MenuController',
    name: '83. Cây cấu trúc thực đơn đầy đủ (Full Tree)',
    method: 'GET',
    path: '/api/menu/1/full',
    auth: 'Doctor',
    description: 'Lấy toàn bộ cây cấu trúc thực đơn (đủ ngày, bữa và món)',
  },
  {
    stt: 84,
    controller: 'MenuController',
    name: '84. Cập nhật thực đơn đa cấp',
    method: 'PUT',
    path: '/api/menu/1',
    auth: 'Doctor',
    description: 'Cập nhật thực đơn đa cấp theo ID (bảo vệ bữa ăn độc lập)',
    body: {
      ten_thuc_don: 'Thực đơn chuẩn hóa 7 ngày đái tháo đường type 2',
    },
  },
  {
    stt: 85,
    controller: 'MenuController',
    name: '85. Xóa thực đơn theo ID',
    method: 'DELETE',
    path: '/api/menu/1',
    auth: 'Doctor',
    description: 'Xóa thực đơn theo ID',
  },
  {
    stt: 86,
    controller: 'MenuController',
    name: '86. Xuất thực đơn kèm 86 vi chất ra Excel',
    method: 'POST',
    path: '/api/menu/1/export',
    auth: 'Doctor',
    description: 'Xuất thực đơn kèm 86 vi chất phân tích ra file Excel (ExcelJS)',
  },

  // XVII. MenuProposalController (9 APIs)
  {
    stt: 87,
    controller: 'MenuProposalController',
    name: '87. Gửi đề xuất thực đơn mẫu (Snapshot JSONB)',
    method: 'POST',
    path: '/api/menu-proposals/1',
    auth: 'Doctor',
    description: 'Gửi đề xuất thực đơn (chụp Deep Frozen Snapshot JSONB)',
    body: {
      ly_do_de_xuat: 'Thực đơn đã kiểm nghiệm lâm sàng đạt hiệu quả kiểm soát HbA1c',
    },
  },
  {
    stt: 88,
    controller: 'MenuProposalController',
    name: '88. Danh sách đề xuất thực đơn của tôi',
    method: 'GET',
    path: '/api/menu-proposals/my',
    auth: 'Doctor',
    description: 'Lấy danh sách đề xuất thực đơn do chính mình gửi',
  },
  {
    stt: 89,
    controller: 'MenuProposalController',
    name: '89. Quản trị viên lấy danh sách toàn bộ đề xuất thực đơn',
    method: 'GET',
    path: '/api/menu-proposals',
    auth: 'Admin',
    description: 'Quản trị viên lấy danh sách toàn bộ đề xuất theo trạng thái',
    queryParams: { status: 'PENDING', page: '1', limit: '20' },
  },
  {
    stt: 90,
    controller: 'MenuProposalController',
    name: '90. Xem chi tiết snapshot đầy đủ đề xuất thực đơn',
    method: 'GET',
    path: '/api/menu-proposals/1/full',
    auth: 'Doctor',
    description: 'Xem chi tiết snapshot đầy đủ của đề xuất thực đơn mẫu',
  },
  {
    stt: 91,
    controller: 'MenuProposalController',
    name: '91. Xem chi tiết ngày/tuần của đề xuất thực đơn',
    method: 'GET',
    path: '/api/menu-proposals/1',
    auth: 'Doctor',
    description: 'Xem chi tiết ngày/tuần của đề xuất thực đơn',
  },
  {
    stt: 92,
    controller: 'MenuProposalController',
    name: '92. Quản trị viên duyệt đề xuất thực đơn',
    method: 'PUT',
    path: '/api/menu-proposals/1/approve',
    auth: 'Admin',
    description: 'Quản trị viên duyệt đề xuất thành thực đơn công khai',
  },
  {
    stt: 93,
    controller: 'MenuProposalController',
    name: '93. Quản trị viên từ chối đề xuất thực đơn',
    method: 'PUT',
    path: '/api/menu-proposals/1/reject',
    auth: 'Admin',
    description: 'Quản trị viên từ chối đề xuất thực đơn kèm lý do',
    body: {
      reason: 'Cơ cấu năng lượng bữa tối vượt ngưỡng khuyến nghị',
    },
  },
  {
    stt: 94,
    controller: 'MenuProposalController',
    name: '94. Danh sách thực đơn mẫu công khai',
    method: 'GET',
    path: '/api/menu-proposals/public',
    auth: 'Public',
    description: 'Lấy danh sách thực đơn mẫu đã được phê duyệt công khai',
    queryParams: { page: '1', limit: '20' },
  },
  {
    stt: 95,
    controller: 'MenuProposalController',
    name: '95. Xuất nội dung đề xuất thực đơn mẫu ra Excel',
    method: 'POST',
    path: '/api/menu-proposals/1/export',
    auth: 'Doctor',
    description: 'Xuất nội dung đề xuất thực đơn mẫu ra file Excel',
  },

  // XVIII. NutritionGuideController (5 APIs)
  {
    stt: 96,
    controller: 'NutritionGuideController',
    name: '96. Danh sách hướng dẫn dinh dưỡng bệnh lý',
    method: 'GET',
    path: '/api/nutrition-guide',
    auth: 'Public',
    description: 'Lấy danh sách các tài liệu hướng dẫn dinh dưỡng bệnh lý',
  },
  {
    stt: 97,
    controller: 'NutritionGuideController',
    name: '97. Chi tiết tài liệu hướng dẫn dinh dưỡng theo ID',
    method: 'GET',
    path: '/api/nutrition-guide/1',
    auth: 'Public',
    description: 'Lấy chi tiết tài liệu hướng dẫn dinh dưỡng theo ID',
  },
  {
    stt: 98,
    controller: 'NutritionGuideController',
    name: '98. Tạo bài viết hướng dẫn dinh dưỡng mới',
    method: 'POST',
    path: '/api/nutrition-guide',
    auth: 'Admin',
    description: 'Tạo bài viết hướng dẫn dinh dưỡng lâm sàng mới',
    body: {
      diseaseName: 'Bệnh phổi tắc nghẽn mạn tính (COPD)',
      code: 'HD-COPD-01',
      nutritionPrinciple: 'Tăng cường chất béo tốt, giảm tỷ lệ carbohydrate nhằm giảm sinh CO2',
      dietaryRequirements: {
        fatPercent: '40-45%',
        carbPercent: '40-45%',
        proteinPerKg: '1.2 - 1.5g',
      },
      note: 'Chia nhỏ bữa ăn làm 5-6 bữa/ngày, tránh đầy bụng gây khó thở',
    },
  },
  {
    stt: 99,
    controller: 'NutritionGuideController',
    name: '99. Cập nhật bài viết hướng dẫn dinh dưỡng',
    method: 'PUT',
    path: '/api/nutrition-guide/1',
    auth: 'Admin',
    description: 'Cập nhật bài viết hướng dưỡng dinh dưỡng theo ID',
    body: {
      nutritionPrinciple: 'Tăng cường chất béo omega-3 kháng viêm, giảm áp lực hô hấp',
    },
  },
  {
    stt: 100,
    controller: 'NutritionGuideController',
    name: '100. Xóa bài viết hướng dẫn dinh dưỡng theo ID',
    method: 'DELETE',
    path: '/api/nutrition-guide/1',
    auth: 'Admin',
    description: 'Xóa bài viết hướng dẫn dinh dưỡng theo ID',
  },

  // XIX. NutritionLimitSetController (4 APIs)
  {
    stt: 101,
    controller: 'NutritionLimitSetController',
    name: '101. Tạo bộ ngưỡng an toàn vi chất lâm sàng',
    method: 'POST',
    path: '/api/nutrition-limit-sets',
    auth: 'Admin',
    description: 'Tạo bộ ngưỡng giới hạn vi chất tối thiểu/tối đa theo bệnh lý',
    body: {
      name: 'Ngưỡng kiểm soát Natri & Kali cho bệnh nhân suy thận mạn',
      disease_group_id: 1,
      isTemplate: true,
      items: [
        { nutrientCode: 'NA', minValue: 1000, maxValue: 2000, unit: 'mg' },
        { nutrientCode: 'K', minValue: 1500, maxValue: 2500, unit: 'mg' },
      ],
    },
  },
  {
    stt: 102,
    controller: 'NutritionLimitSetController',
    name: '102. Cập nhật bộ ngưỡng giới hạn vi chất',
    method: 'PUT',
    path: '/api/nutrition-limit-sets/1',
    auth: 'Admin',
    description: 'Cập nhật bộ ngưỡng giới hạn vi chất theo ID',
    body: {
      name: 'Ngưỡng Natri & Kali cập nhật 2026',
    },
  },
  {
    stt: 103,
    controller: 'NutritionLimitSetController',
    name: '103. Chi tiết bộ ngưỡng giới hạn vi chất theo ID',
    method: 'GET',
    path: '/api/nutrition-limit-sets/1',
    auth: 'Public',
    description: 'Lấy chi tiết bộ ngưỡng giới hạn vi chất theo ID',
  },
  {
    stt: 104,
    controller: 'NutritionLimitSetController',
    name: '104. Danh sách toàn bộ các bộ ngưỡng giới hạn vi chất',
    method: 'GET',
    path: '/api/nutrition-limit-sets',
    auth: 'Public',
    description: 'Lấy danh sách toàn bộ các bộ ngưỡng giới hạn vi chất',
  },

  // XX. PackageController (5 APIs)
  {
    stt: 105,
    controller: 'PackageController',
    name: '105. Tạo gói cước dịch vụ PRO/VIP',
    method: 'POST',
    path: '/api/package',
    auth: 'Superadmin',
    description: 'Tạo gói cước dịch vụ mới (thời hạn ngày, giá tiền, mô tả)',
    body: {
      ten_goi: 'Gói Chuyên Gia 12 Tháng',
      ma_goi: 'PRO-12M',
      thoi_han_ngay: 365,
      gia_tien: 1200000,
      mo_ta: 'Đầy đủ tính năng phân tích 86 vi chất và xuất báo cáo lâm sàng',
      active: true,
    },
  },
  {
    stt: 106,
    controller: 'PackageController',
    name: '106. Quản trị viên lấy danh sách toàn bộ gói cước',
    method: 'GET',
    path: '/api/package',
    auth: 'Superadmin',
    description: 'Quản trị viên lấy danh sách toàn bộ các gói cước',
  },
  {
    stt: 107,
    controller: 'PackageController',
    name: '107. Chi tiết gói cước dịch vụ theo ID',
    method: 'GET',
    path: '/api/package/1',
    auth: 'User',
    description: 'Lấy chi tiết một gói cước dịch vụ theo ID',
  },
  {
    stt: 108,
    controller: 'PackageController',
    name: '108. Cập nhật thông tin gói cước dịch vụ',
    method: 'PUT',
    path: '/api/package/update-package',
    auth: 'Superadmin',
    description: 'Cập nhật thông tin gói cước dịch vụ',
    body: {
      id: 1,
      ten_goi: 'Gói Chuyên Gia 12 Tháng Khuyến Mãi',
      gia_tien: 990000,
    },
  },
  {
    stt: 109,
    controller: 'PackageController',
    name: '109. Danh sách gói cước đang mở bán (Active)',
    method: 'GET',
    path: '/api/package/active',
    auth: 'Public',
    description: 'Lấy danh sách các gói cước đang mở bán để người dùng nâng cấp',
  },

  // XXI. PatientController (8 APIs)
  {
    stt: 110,
    controller: 'PatientController',
    name: '110. Tạo hồ sơ bệnh nhân (Cấp mã tự động)',
    method: 'POST',
    path: '/api/patients',
    auth: 'Doctor',
    description: 'Tạo hồ sơ bệnh nhân mới (cấp mã tự động chống race condition)',
    body: {
      ho_ten: 'Nguyễn Văn An',
      so_dien_thoai: '0912345678',
      ngay_sinh: '1985-05-15',
      gioi_tinh: 'NAM',
      can_nang: 68.5,
      chieu_cao: 172.0,
      he_so_hoat_dong: 1.375,
      nhom_benh_chinh_id: 1,
    },
  },
  {
    stt: 111,
    controller: 'PatientController',
    name: '111. Cập nhật hồ sơ bệnh nhân & Nhân trắc học',
    method: 'PUT',
    path: '/api/patients/1',
    auth: 'Doctor',
    description: 'Cập nhật thông tin bệnh nhân, nhân trắc học & TDEE',
    body: {
      ho_ten: 'Nguyễn Văn An (Tái khám)',
      can_nang: 67.0,
    },
  },
  {
    stt: 112,
    controller: 'PatientController',
    name: '112. Xóa hồ sơ bệnh nhân theo ID',
    method: 'DELETE',
    path: '/api/patients/1',
    auth: 'Doctor',
    description: 'Xóa hồ sơ bệnh nhân theo ID',
  },
  {
    stt: 113,
    controller: 'PatientController',
    name: '113. Chi tiết hồ sơ bệnh nhân theo ID',
    method: 'GET',
    path: '/api/patients/1',
    auth: 'Doctor',
    description: 'Lấy thông tin chi tiết hồ sơ bệnh nhân theo ID',
  },
  {
    stt: 114,
    controller: 'PatientController',
    name: '114. Xem trước mã bệnh nhân sinh tự động',
    method: 'GET',
    path: '/api/patients/code-preview',
    auth: 'Doctor',
    description: 'Xem trước mã bệnh nhân sinh ra dựa trên số điện thoại',
    queryParams: { phone: '0912345678' },
  },
  {
    stt: 115,
    controller: 'PatientController',
    name: '115. Danh sách bệnh nhân thuộc quyền quản lý',
    method: 'GET',
    path: '/api/patients',
    auth: 'Doctor',
    description: 'Lấy danh sách bệnh nhân thuộc quyền quản lý của bác sĩ',
    queryParams: { page: '1', limit: '20', search: '' },
  },
  {
    stt: 116,
    controller: 'PatientController',
    name: '116. Tải template Excel import hồ sơ bệnh nhân',
    method: 'GET',
    path: '/api/patients/import-template',
    auth: 'Doctor',
    description: 'Tải template Excel import hồ sơ bệnh nhân',
  },
  {
    stt: 117,
    controller: 'PatientController',
    name: '117. Import danh sách bệnh nhân từ Excel',
    method: 'POST',
    path: '/api/patients/import',
    auth: 'Doctor',
    description: 'Import danh sách bệnh nhân từ file Excel kèm kiểm tra lỗi',
  },

  // XXII. ProfileController (1 API)
  {
    stt: 118,
    controller: 'ProfileController',
    name: '118. Quản trị viên phân trang danh sách người dùng (getAll)',
    method: 'POST',
    path: '/api/profile/getAll',
    auth: 'Admin',
    description: 'Quản trị viên phân trang và tìm kiếm danh sách người dùng',
    body: {
      page: 1,
      limit: 20,
      search: '',
    },
  },

  // XXIII. ProposerController (4 APIs)
  {
    stt: 119,
    controller: 'ProposerController',
    name: '119. Thêm mới chuyên gia đề xuất nguyên liệu',
    method: 'POST',
    path: '/api/proposer',
    auth: 'Doctor',
    description: 'Thêm mới người/chuyên gia đề xuất nguyên liệu thực phẩm',
    body: {
      ho_ten: 'PGS. TS. Trần Dinh Dưỡng',
      chuyen_khoa: 'Dinh dưỡng lâm sàng tiết chế',
      email: 'expert.tran@viennhidong.vn',
      so_dien_thoai: '0901234567',
    },
  },
  {
    stt: 120,
    controller: 'ProposerController',
    name: '120. Cập nhật thông tin chuyên gia đề xuất',
    method: 'PUT',
    path: '/api/proposer/1',
    auth: 'Doctor',
    description: 'Cập nhật thông tin chuyên gia đề xuất theo ID',
    body: {
      chuyen_khoa: 'Chủ tịch Hội Dinh dưỡng Lâm sàng',
    },
  },
  {
    stt: 121,
    controller: 'ProposerController',
    name: '121. Danh sách tất cả chuyên gia đề xuất',
    method: 'GET',
    path: '/api/proposer',
    auth: 'Public',
    description: 'Lấy danh sách tất cả chuyên gia đề xuất nguyên liệu',
  },
  {
    stt: 122,
    controller: 'ProposerController',
    name: '122. Chi tiết thông tin chuyên gia đề xuất theo ID',
    method: 'GET',
    path: '/api/proposer/1',
    auth: 'Public',
    description: 'Lấy chi tiết thông tin chuyên gia đề xuất theo ID',
  },

  // XXIV. SubscriptionController (5 APIs)
  {
    stt: 123,
    controller: 'SubscriptionController',
    name: '123. Gửi yêu cầu nâng cấp gói PRO (Payment Request)',
    method: 'POST',
    path: '/api/subscription/payment-request',
    auth: 'User',
    description: 'Người dùng gửi yêu cầu nạp tiền / nâng cấp tài khoản PRO',
    body: {
      packageId: 1,
      paymentMethod: 'BANK_TRANSFER',
      evidenceId: 1,
      note: 'Đã chuyển khoản thành công từ Techcombank',
    },
  },
  {
    stt: 124,
    controller: 'SubscriptionController',
    name: '124. Xem lịch sử yêu cầu nâng cấp của tôi',
    method: 'GET',
    path: '/api/subscription/my-requests',
    auth: 'User',
    description: 'Người dùng xem lịch sử yêu cầu nâng cấp của chính mình',
  },
  {
    stt: 125,
    controller: 'SubscriptionController',
    name: '125. Quản trị viên xem danh sách yêu cầu nâng cấp cần duyệt',
    method: 'GET',
    path: '/api/subscription/list',
    auth: 'Superadmin',
    description: 'Quản trị viên xem danh sách tất cả yêu cầu thanh toán cần duyệt',
    queryParams: { status: 'PENDING', page: '1', limit: '20' },
  },
  {
    stt: 126,
    controller: 'SubscriptionController',
    name: '126. Quản trị viên duyệt yêu cầu nạp tiền (Cộng ngày PRO)',
    method: 'POST',
    path: '/api/subscription/1/approve',
    auth: 'Superadmin',
    description: 'Duyệt yêu cầu nạp tiền (khóa bi quan, cộng dồn ngày PRO)',
    body: {
      note: 'Đã nhận đủ tiền từ sao kê ngân hàng',
    },
  },
  {
    stt: 127,
    controller: 'SubscriptionController',
    name: '127. Quản trị viên từ chối yêu cầu nạp tiền',
    method: 'POST',
    path: '/api/subscription/1/reject',
    auth: 'Superadmin',
    description: 'Từ chối yêu cầu nạp tiền kèm lý do giải trình',
    body: {
      reason: 'Biên lai chuyển khoản không hợp lệ hoặc số tiền không khớp',
    },
  },

  // XXV. UserController (5 APIs)
  {
    stt: 128,
    controller: 'UserController',
    name: '128. Khóa hoặc mở khóa trạng thái tài khoản (Status)',
    method: 'PUT',
    path: '/api/users/update-user-active-satus',
    auth: 'Admin',
    description: 'Khóa hoặc mở khóa trạng thái tài khoản người dùng',
    body: {
      userId: 'user-uuid-sample',
      active: true,
    },
  },
  {
    stt: 129,
    controller: 'UserController',
    name: '129. Cập nhật vai trò phân quyền người dùng (Role)',
    method: 'PUT',
    path: '/api/users/update-role',
    auth: 'Admin',
    description: 'Cập nhật vai trò phân quyền người dùng (RBAC)',
    body: {
      userId: 'user-uuid-sample',
      role: 'BAC_SI',
    },
  },
  {
    stt: 130,
    controller: 'UserController',
    name: '130. Người dùng cập nhật thông tin cá nhân (Update Info)',
    method: 'PUT',
    path: '/api/users/update-info',
    auth: 'User',
    description: 'Người dùng cập nhật thông tin cá nhân của chính mình',
    body: {
      ho_ten: 'Bác Sĩ Dinh Dưỡng Lê Hoàng',
      so_dien_thoai: '0988776655',
    },
  },
  {
    stt: 131,
    controller: 'UserController',
    name: '131. Lấy thông tin tài khoản đăng nhập (getInfo - IDOR Protected)',
    method: 'POST',
    path: '/api/users/getInfo',
    auth: 'User',
    description: 'Lấy thông tin tài khoản đăng nhập (vá lỗ hổng IDOR PII)',
  },
  {
    stt: 132,
    controller: 'UserController',
    name: '132. Kiểm tra trạng thái hoàn thiện hồ sơ người dùng',
    method: 'GET',
    path: '/api/users/check-profile',
    auth: 'User',
    description: 'Kiểm tra trạng thái hoàn thiện hồ sơ người dùng',
  },
];

async function main() {
  console.log('🚀 Starting OpenAPI Spec & Postman Collection generation...');

  const docsDir = path.resolve(__dirname, '../../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // 1. Khởi tạo Nest App In-Memory để trích xuất OpenAPI Schema
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nutri Clinical Nutrition API')
    .setDescription(
      'Hệ thống API RESTful Quản lý Dinh dưỡng Lâm sàng & Tiết chế Bệnh nhân Nutri. Tuân thủ 100% chuẩn hợp đồng API 132 Endpoints và phân quyền RBAC.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập JWT Access Token vào đây để kiểm thử API',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Phân hệ Xác thực & Cấp quyền JWT')
    .addTag('Categories', 'Phân hệ Danh mục Nhóm thực phẩm')
    .addTag('Chatbot', 'Phân hệ Tư vấn Chatbot AI (Deprecated 410 Gone)')
    .addTag('Coefficients', 'Hệ số sống/chín thực phẩm')
    .addTag('DailyIntakes', 'Khẩu phần ăn 24h lâm sàng')
    .addTag('DiseaseGroups', 'Danh mục nhóm bệnh gốc (ICD)')
    .addTag('Dishes', 'Món ăn, công thức & 86 vi chất dinh dưỡng')
    .addTag('Evidences', 'Minh chứng y tế & Chứng từ hóa đơn')
    .addTag('Export', 'Xuất báo cáo dữ liệu vi chất ra Excel')
    .addTag('ExtendedDiseaseGroups', 'Nhóm bệnh lý mở rộng của bác sĩ')
    .addTag('Files', 'Quản lý tải tệp đĩa cứng VPS')
    .addTag('Ingredients', 'Kho 86 vi chất nguyên liệu thực phẩm')
    .addTag('IngredientProposals', 'Quy trình đề xuất nguyên liệu mới')
    .addTag('Meals', 'Bữa ăn độc lập (Vô hiệu hóa an toàn - DenyAll)')
    .addTag('Menus', 'Thực đơn đa cấp lâm sàng (Ngày/Tuần/Tháng)')
    .addTag('MenuProposals', 'Thẩm định đề xuất thực đơn mẫu')
    .addTag('NutritionGuides', 'Cẩm nang hướng dẫn dinh dưỡng bệnh lý')
    .addTag('NutritionLimitSets', 'Bộ ngưỡng an toàn vi chất y khoa')
    .addTag('Plans', 'Gói cước dịch vụ PRO/VIP')
    .addTag('Patients', 'Hồ sơ bệnh nhân & Mã bệnh nhân tự động')
    .addTag('Profiles', 'Quản trị hồ sơ người dùng')
    .addTag('Proposers', 'Chuyên gia đề xuất nguyên liệu')
    .addTag('Subscriptions', 'Thanh toán & Nâng cấp tài khoản PRO')
    .addTag('Users', 'Tài khoản, phân quyền RBAC & Bảo vệ PII')
    .build();

  const openApiDoc = SwaggerModule.createDocument(app, swaggerConfig);

  // Bổ sung các endpoint vào document nếu cần
  const openApiSpecPath = path.join(docsDir, 'openapi-spec.json');
  fs.writeFileSync(openApiSpecPath, JSON.stringify(openApiDoc, null, 2), 'utf-8');
  console.log(`✅ Exported OpenAPI Spec to: ${openApiSpecPath} (${(fs.statSync(openApiSpecPath).size / 1024).toFixed(1)} KB)`);

  await app.close();

  // 2. Tạo Postman Environment
  const postmanEnvPath = path.join(docsDir, 'Nutri_Dev.postman_environment.json');
  const postmanEnv = {
    id: 'a57fa8d2-4321-4f11-8899-nutridev2026',
    name: 'Nutri Dev Environment (Local)',
    values: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'default',
        enabled: true,
      },
      {
        key: 'token',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'adminToken',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'doctorToken',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'refreshToken',
        value: '',
        type: 'secret',
        enabled: true,
      },
      {
        key: 'patientId',
        value: '1',
        type: 'default',
        enabled: true,
      },
      {
        key: 'dishId',
        value: '1',
        type: 'default',
        enabled: true,
      },
      {
        key: 'ingredientId',
        value: '1',
        type: 'default',
        enabled: true,
      },
      {
        key: 'menuId',
        value: '1',
        type: 'default',
        enabled: true,
      },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'Postman/10.0.0',
  };

  fs.writeFileSync(postmanEnvPath, JSON.stringify(postmanEnv, null, 2), 'utf-8');
  console.log(`✅ Exported Postman Environment to: ${postmanEnvPath}`);

  // 3. Tạo Postman Collection phân chia theo 25 Controllers
  const postmanCollectionPath = path.join(docsDir, 'Nutri_Backend_API.postman_collection.json');

  // Nhóm 132 APIs theo Controller
  const controllerMap = new Map<string, EndpointMeta[]>();
  for (const api of APIS_132) {
    if (!controllerMap.has(api.controller)) {
      controllerMap.set(api.controller, []);
    }
    controllerMap.get(api.controller)!.push(api);
  }

  const collectionItems: any[] = [];

  for (const [controllerName, apis] of controllerMap.entries()) {
    const folderItems = apis.map((api) => {
      // Xây dựng Postman Request Item
      const pathSegments = api.path.replace(/^\//, '').split('/');
      const isParamRegex = /^[0-9]+$/;

      const urlObj: any = {
        raw: `{{baseUrl}}${api.path}`,
        host: ['{{baseUrl}}'],
        path: pathSegments.map((seg) => (isParamRegex.test(seg) ? `:id` : seg)),
      };

      if (api.queryParams && Object.keys(api.queryParams).length > 0) {
        urlObj.query = Object.entries(api.queryParams).map(([k, v]) => ({
          key: k,
          value: v,
          description: `Tham số ${k}`,
        }));
        urlObj.raw +=
          '?' +
          Object.entries(api.queryParams)
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
      }

      const headers: any[] = [];
      if (api.body && api.method !== 'GET') {
        headers.push({
          key: 'Content-Type',
          value: 'application/json',
          type: 'text',
        });
      }

      // Xác thực dựa trên quyền
      let requestAuth: any = undefined;
      if (api.auth === 'Public') {
        requestAuth = { type: 'noauth' };
      } else if (api.auth === 'Admin' || api.auth === 'Superadmin') {
        requestAuth = {
          type: 'bearer',
          bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }],
        };
      } else if (api.auth === 'Doctor') {
        requestAuth = {
          type: 'bearer',
          bearer: [{ key: 'token', value: '{{doctorToken}}', type: 'string' }],
        };
      } else if (api.auth === 'User') {
        requestAuth = {
          type: 'bearer',
          bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
        };
      }

      const requestItem: any = {
        name: `[STT ${api.stt}] ${api.name}`,
        request: {
          method: api.method,
          header: headers,
          url: urlObj,
          description: `**STT ${api.stt}** - ${api.description}\n- Phân quyền: **${api.auth}**\n- Phương thức: **${api.method} ${api.path}**`,
        },
        response: [],
      };

      if (requestAuth) {
        requestItem.request.auth = requestAuth;
      }

      if (api.body && api.method !== 'GET') {
        requestItem.request.body = {
          mode: 'raw',
          raw: JSON.stringify(api.body, null, 2),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      }

      // Script tự động lưu Token nếu là Login
      if (api.path === '/api/auth/login') {
        requestItem.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                '// Tự động lưu Token vào Environment khi đăng nhập thành công',
                'if (pm.response.code === 200 || pm.response.code === 201) {',
                '    const res = pm.response.json();',
                '    const token = res.data ? res.data.accessToken : res.accessToken;',
                '    const refreshToken = res.data ? res.data.refreshToken : res.refreshToken;',
                '    if (token) {',
                '        pm.environment.set("token", token);',
                '        console.log("Access Token updated:", token);',
                '    }',
                '    if (refreshToken) {',
                '        pm.environment.set("refreshToken", refreshToken);',
                '    }',
                '}',
              ],
            },
          },
        ];
      }

      return requestItem;
    });

    collectionItems.push({
      name: `${controllerName} (${apis.length} APIs)`,
      description: `Nhóm API thuộc ${controllerName} (Gồm ${apis.length} endpoints chuẩn hóa)`,
      item: folderItems,
    });
  }

  const postmanCollection = {
    info: {
      _postman_id: 'b62ca531-9876-4d22-9911-nutribackendapi',
      name: 'Nutri Clinical Nutrition Backend API (Full 132 APIs - 25 Controllers)',
      description:
        'Bộ sưu tập Postman Collection chuẩn mực bao gồm toàn bộ 132 RESTful endpoints phân chia thành đúng 25 Controllers theo tài liệu Kiểm toán Parity. Tích hợp sẵn Pre-request Scripts tự động gắn Bearer Token và mẫu JSON Request Body.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '1.0.0',
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{token}}',
          type: 'string',
        },
      ],
    },
    event: [
      {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: [
            '// Global Pre-request Script: Tự động gắn Bearer Token nếu chưa có',
            'const token = pm.variables.get("token");',
            'if (token && !pm.request.headers.has("Authorization")) {',
            '    pm.request.headers.add({',
            '        key: "Authorization",',
            '        value: "Bearer " + token',
            '    });',
            '}',
          ],
        },
      },
    ],
    item: collectionItems,
  };

  fs.writeFileSync(postmanCollectionPath, JSON.stringify(postmanCollection, null, 2), 'utf-8');
  console.log(`✅ Exported Postman Collection to: ${postmanCollectionPath} (25 Controllers, 132 APIs)`);

  console.log('🎉 Task 8.2 Swagger & Postman generation completed successfully!');
}

main().catch((err) => {
  console.error('❌ Error during docs generation:', err);
  process.exit(1);
});
