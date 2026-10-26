# NUTRI CLINICAL NUTRITION & DIET MANAGEMENT BACKEND

Hệ thống quản lý thực đơn dinh dưỡng, định lượng vi chất lâm sàng và theo dõi bệnh nhân. Xây dựng trên nền tảng **NestJS 10**, **TypeScript 5**, **Prisma ORM 7.10** và **MySQL 8.4**.

---

## 1. MÔI TRƯỜNG & KHỞI CHẠY HỆ THỐNG

### Yêu cầu tiên quyết
- **Node.js**: `v20.19.3 LTS` (Quản lý qua NVM: `source ~/.nvm/nvm.sh && nvm use`)
- **Cơ sở dữ liệu**: MySQL 8.0+ (Cổng `3306`, character set `utf8mb4_0900_ai_ci`)

### Khởi chạy môi trường phát triển
```bash
# 1. Tải môi trường Node.js chuẩn
source ~/.nvm/nvm.sh && nvm use

# 2. Cài đặt dependencies
npm install

# 3. Khởi chạy ứng dụng NestJS ở chế độ Watch Mode
npm run start:dev
```

- **Swagger OpenAPI Docs**: [http://localhost:8080/api/v1/docs](http://localhost:8080/api/v1/docs)
- **API Base URL**: `http://localhost:8080/api/v1` (Hỗ trợ URL Rewriting tự động cho các request FE legacy `/api/*`)

---

## 2. QUẢN LÝ CSDL, MIGRATIONS & ROLLBACK (PRISMA 7)

Dự án áp dụng kỷ luật **Migration-First (Rule 31)**. Tuyệt đối không can thiệp DDL trực tiếp vào CSDL.

```bash
# Sinh mã nguồn Prisma Client
npm run prisma:generate

# Tạo migration mới từ thay đổi trong schema.prisma
npm run prisma:migrate

# Triển khai migration lên môi trường CSDL (Deploy)
npm run prisma:deploy

# Rollback migration gần nhất (chạy rollback.sql và hoàn tác trạng thái migration)
npm run prisma:rollback
```

---

## 3. HỆ THỐNG SEED DỮ LIỆU ĐỘNG (`npm run seed`)

Dự án hỗ trợ cơ chế nạp động **Dynamic File Resolver**, cho phép chạy toàn bộ hoặc chạy riêng lẻ bất kỳ file seed nào:

```bash
# Cú pháp tổng quát:
npm run seed -- <tên_module_hoặc_file>
```

### Các kịch bản chạy seed:

#### A. Chạy toàn bộ dữ liệu mẫu (Mặc định)
Chạy tuần tự toàn bộ các module seed theo thứ tự phụ thuộc dữ liệu và in bảng thống kê chi tiết:
```bash
npm run seed
# hoặc
npm run seed -- all
```

#### B. Chạy lẻ từng file / module độc lập
Bạn có thể truyền tên rút gọn, tên file, hoặc đường dẫn đầy đủ:
```bash
# 1. Chỉ seed các Gói dịch vụ định kỳ (PackageStatus Enums)
npm run seed -- packages
# hoặc
npm run seed -- packages.seed.ts

# 2. Chỉ seed Danh sách người dùng mẫu (Role Enums: SUPERADMIN, BAC_SI, EXPERT, USERPRO, USER)
npm run seed -- users
# hoặc
npm run seed -- users.seed.ts

# 3. Chỉ nạp Dữ liệu lâm sàng thô từ Viện Dinh Dưỡng (Danh mục, nhóm bệnh, 954 nguyên liệu)
npm run seed -- sql
# hoặc
npm run seed -- raw-sql

# 4. Chỉ khởi tạo / đồng bộ Bộ đếm mã bệnh nhân tự tăng (_system_sequences)
npm run seed -- sequences
```

#### C. Chạy kết hợp nhiều module seed cùng lúc
```bash
npm run seed -- users packages
```

#### D. Chạy trực tiếp file TypeScript độc lập (Standalone Execution)
Mỗi file trong `prisma/seeds/` đều được tích hợp runner độc lập:
```bash
npx ts-node prisma/seeds/packages.seed.ts
npx ts-node prisma/seeds/users.seed.ts
npx ts-node prisma/seeds/raw-sql.seed.ts
npx ts-node prisma/seeds/sequences.seed.ts
```

> **Khả năng mở rộng tự động:** Khi bạn thêm bất kỳ file `*.seed.ts` mới nào vào thư mục `prisma/seeds/`, hệ thống sẽ tự động nhận diện và thực thi qua lệnh `npm run seed -- <tên_file>` mà không cần phải khai báo thêm script trong `package.json`!

---

## 4. BỘ DECORATOR TINH GỌN DỰ ÁN (`src/common/decorators`)

Toàn bộ các decorator dùng chung được tập trung tại `src/common/decorators/`, giúp code Controller ngắn hơn, dễ đọc và loại bỏ hoàn toàn boilerplate:

### Bảng tổng hợp Decorators:

| Decorator | Cú pháp mẫu | Mục đích & Tính năng |
| :--- | :--- | :--- |
| **`@Auth(...roles)`** | `@Auth()`<br>`@Auth(UserRole.ADMIN)` | Gom `UseGuards(JwtAuthGuard, RolesGuard)`, `ApiBearerAuth('JWT-auth')`, `Roles(...)` và tự động gắn Swagger 401 & 403 Response. |
| **`@ApiController(tag, path?, options?)`** | `@ApiController('Users', 'users', { auth: true })` | Gom `@ApiTags(...)` + `@Controller(...)` + `@Auth()` trong một dòng duy nhất. |
| **`@CurrentUserId()`** | `@CurrentUserId() userId: string` | Trích xuất trực tiếp ID người dùng (UUID) từ JWT token, không cần bóc tách thủ công từ `user.id`. |
| **`@CurrentUser()`** | `@CurrentUser() user: AuthenticatedUser` | Lấy toàn bộ thông tin tài khoản người dùng đăng nhập hiện tại. |
| **`@ClientIp()`** | `@ClientIp() ip: string` | Trích xuất IP thật của Client, tự động giải mã an toàn qua Nginx, Cloudflare proxy (`x-forwarded-for`, `cf-connecting-ip`). |
| **`@UserAgent()`** | `@UserAgent() ua: string` | Trích xuất chuỗi User-Agent của Client phục vụ kiểm tra bảo mật session và Refresh Token. |
| **`@ApiStandardResponse(options)`** | `@ApiStandardResponse({ type: ModelDto })` | Đóng gói schema phản hồi thành công Single Entity / Mutation chuẩn Rule 10 `{ status: 200, message, data: T, meta: { timestamp, traceId } }` hiển thị trực tiếp lên Swagger UI. |
| **`@ApiPaginatedResponse(options)`** | `@ApiPaginatedResponse({ type: ItemDto })` | Đóng gói schema phản hồi danh sách phân trang chuẩn Rule 10 `{ status: 200, message, data: T[], meta: { page, limit, totalItems, totalPages, ... } }` lên Swagger UI. |
| **`@ApiErrorResponse(status, desc)`** | `@ApiErrorResponse(400, 'Dữ liệu không hợp lệ')` | Hiển thị schema lỗi chuẩn `{ error: { code, message, details }, meta }` trên Swagger UI. |
| **`@ApiFile(fieldName, options)`** | `@ApiFile('avatar')` | Khai báo Swagger Multipart Form-data cho upload 1 file binary. |
| **`@ApiMultiFiles(fieldName, options)`** | `@ApiMultiFiles('files')` | Khai báo Swagger Multipart Form-data cho upload nhiều files. |
| **`@Public()`** | `@Public()` | Đánh dấu endpoint công khai, bỏ qua JWT authentication guard. |
| **`@SkipTransform()`** | `@SkipTransform()` | Bỏ qua việc bọc Response Envelope (dành cho file streaming PDF, Excel export). |

---

## 5. CHUẨN PHẢN HỒI API (RESPONSE ENVELOPES - RULE 10)

Mọi endpoint (ngoại trừ file stream) đều tự động được bao bọc bởi `TransformResponseInterceptor`:

### Phản hồi Danh sách phân trang (`GET /api/v1/...`):
```json
{
  "status": 200,
  "message": "success",
  "data": [
    { "id": "uuid-1", "name": "Nguyên liệu A" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "timestamp": "2026-10-26T06:20:00.000Z",
    "traceId": "trace-local"
  }
}
```

### Phản hồi Đơn thực thể / Mutation (`POST`, `PUT`, `GET /:id`):
```json
{
  "status": 200,
  "message": "success",
  "data": { "id": "uuid-1", "name": "Nguyên liệu A" },
  "meta": {
    "timestamp": "2026-10-26T06:20:00.000Z",
    "traceId": "trace-local"
  }
}
```

---

## 6. KIỂM THỬ & KIỂM ĐỊNH MÃ NGUỒN

Hệ thống kiểm thử kết nối CSDL MySQL thật với schema `nutri_test` thông qua `.env.test`, đảm bảo tính toàn vẹn 3 lớp (HTTP Route, Payload Schema, Database Ground Truth State):

```bash
# Chạy toàn bộ Unit Tests (16 Suites / 121 Tests)
npm test

# Chạy toàn bộ End-to-End Tests (5 Suites / 26 Tests)
npm run test:e2e

# Biên dịch dự án (TypeScript Build Check)
npm run build

# Kiểm tra quy chuẩn cú pháp ESLint (0 errors, 0 warnings)
npm run lint
```
