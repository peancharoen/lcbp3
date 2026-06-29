-- Patch: Drop FK constraint for recipient_organization_id
-- Required because -1 is used as sentinel value for "all organizations"
-- Run this on lcbp3_dev database
-- Find and drop the FK constraint(s)
-- The constraint names may vary, check with:
-- SHOW CREATE TABLE document_number_counters;
-- Drop both FK constraints
ALTER TABLE document_number_counters DROP FOREIGN KEY document_number_counters_ibfk_3;

ALTER TABLE document_number_counters DROP FOREIGN KEY fk_recipient_when_not_all;
