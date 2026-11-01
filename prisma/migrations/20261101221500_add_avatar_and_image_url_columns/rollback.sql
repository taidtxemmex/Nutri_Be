-- Rollback: 20261101221500_add_avatar_and_image_url_columns
ALTER TABLE `thuc_don` DROP COLUMN `image_url`;
ALTER TABLE `de_xuat_nguyen_lieu` DROP COLUMN `image_url`;
ALTER TABLE `nguyen_lieu` DROP COLUMN `image_url`;
ALTER TABLE `mon_an` DROP COLUMN `image_url`;
ALTER TABLE `ho_so_ca_nhan` DROP COLUMN `avatar_url`;
