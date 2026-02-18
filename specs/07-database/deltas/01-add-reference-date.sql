ALTER TABLE `attachments`
ADD COLUMN `reference_date` DATE NULL COMMENT 'Date used for folder structure (e.g. Issue Date) to prevent broken paths';
ALTER TABLE `attachments`
ADD INDEX `idx_attachments_reference_date` (`reference_date`);