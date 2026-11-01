-- Migration: 20261101221500_add_avatar_and_image_url_columns
-- Bổ sung cột lưu đường dẫn ảnh (relative path, không chứa domain) cho các thực thể:
-- 1. ho_so_ca_nhan: avatar_url (ảnh đại diện người dùng, lưu trong public/uploads/avatars/)
-- 2. mon_an: image_url (ảnh món ăn, lưu trong public/uploads/dishes/)
-- 3. nguyen_lieu: image_url (ảnh nguyên liệu, lưu trong public/uploads/ingredients/)
-- 4. de_xuat_nguyen_lieu: image_url (ảnh đề xuất nguyên liệu mới, lưu trong public/uploads/ingredients/)
-- 5. thuc_don: image_url (ảnh bìa thực đơn, lưu trong public/uploads/menus/)

ALTER TABLE `ho_so_ca_nhan` ADD COLUMN `avatar_url` VARCHAR(500) NULL AFTER `phone`;
ALTER TABLE `mon_an` ADD COLUMN `image_url` VARCHAR(500) NULL AFTER `ten_mon`;
ALTER TABLE `nguyen_lieu` ADD COLUMN `image_url` VARCHAR(500) NULL AFTER `ten_nguyen_lieu`;
ALTER TABLE `de_xuat_nguyen_lieu` ADD COLUMN `image_url` VARCHAR(500) NULL AFTER `ten_nguyen_lieu`;
ALTER TABLE `thuc_don` ADD COLUMN `image_url` VARCHAR(500) NULL AFTER `ten_thuc_don`;
