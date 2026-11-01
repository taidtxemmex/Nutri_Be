-- Rollback: 20261027150000_fix_auth_token_and_menu_proposal_soft_delete
-- 1. Hủy index deleted_at của de_xuat_thuc_don
DROP INDEX `idx_de_xuat_thuc_don_deleted_at` ON `de_xuat_thuc_don`;

-- 2. Xóa cột deleted_at khỏi bảng de_xuat_thuc_don
ALTER TABLE `de_xuat_thuc_don` DROP COLUMN `deleted_at`;

-- 3. Khôi phục ma_xac_thuc.nguoi_dung_id về kiểu VARCHAR(30)
ALTER TABLE `ma_xac_thuc` DROP FOREIGN KEY `FKr9iu02dnwlrpl4xkl8ep7pxrw`;
ALTER TABLE `ma_xac_thuc` MODIFY COLUMN `nguoi_dung_id` VARCHAR(30) NOT NULL;
ALTER TABLE `ma_xac_thuc` ADD CONSTRAINT `FKr9iu02dnwlrpl4xkl8ep7pxrw` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
