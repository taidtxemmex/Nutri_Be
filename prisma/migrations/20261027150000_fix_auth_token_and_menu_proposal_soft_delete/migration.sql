-- Migration: 20261027150000_fix_auth_token_and_menu_proposal_soft_delete
-- 1. Tạm thời drop foreign key để sửa kiểu cột nguoi_dung_id
ALTER TABLE `ma_xac_thuc` DROP FOREIGN KEY `FKr9iu02dnwlrpl4xkl8ep7pxrw`;

-- 2. Sửa ma_xac_thuc.nguoi_dung_id từ VARCHAR(30) thành CHAR(36) tương thích 100% với UUID của nguoi_dung.id
ALTER TABLE `ma_xac_thuc` MODIFY COLUMN `nguoi_dung_id` CHAR(36) NOT NULL;

-- 3. Tạo lại foreign key liên kết với nguoi_dung.id
ALTER TABLE `ma_xac_thuc` ADD CONSTRAINT `FKr9iu02dnwlrpl4xkl8ep7pxrw` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 4. Bổ sung trường deleted_at cho bảng de_xuat_thuc_don (Hỗ trợ chuẩn Xóa Mềm Soft-Delete theo quyết định người dùng)
ALTER TABLE `de_xuat_thuc_don` ADD COLUMN `deleted_at` DATETIME(0) NULL DEFAULT NULL;

-- 5. Tạo index cho deleted_at phục vụ tối ưu hóa truy vấn lọc deleted_at: null
CREATE INDEX `idx_de_xuat_thuc_don_deleted_at` ON `de_xuat_thuc_don`(`deleted_at`);
