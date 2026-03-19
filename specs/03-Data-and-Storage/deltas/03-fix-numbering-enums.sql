-- Delta 03: Fix ENUM mismatches in document_number_audit and document_number_errors
-- Issue: 'GENERATE' operation used by backend but not in DB ENUM → INSERT fails → correspondence creation blocked
-- Date: 2026-03-19
-- Applies to: lcbp3-v1.8.0-schema-02-tables.sql

-- 1. Add 'VOID' and 'GENERATE' to document_number_audit.operation ENUM
ALTER TABLE document_number_audit
  MODIFY COLUMN operation ENUM(
    'RESERVE',
    'CONFIRM',
    'MANUAL_OVERRIDE',
    'VOID_REPLACE',
    'CANCEL',
    'VOID',
    'GENERATE'
  ) NOT NULL DEFAULT 'CONFIRM' COMMENT 'ประเภทการดำเนินการ';

-- 2. Add missing error_type values to document_number_errors
ALTER TABLE document_number_errors
  MODIFY COLUMN error_type ENUM(
    'LOCK_TIMEOUT',
    'VERSION_CONFLICT',
    'DB_ERROR',
    'REDIS_ERROR',
    'VALIDATION_ERROR',
    'SEQUENCE_EXHAUSTED',
    'RESERVATION_EXPIRED',
    'DUPLICATE_NUMBER',
    'GENERATE_ERROR'
  ) NOT NULL COMMENT 'ประเภท error (9 types)';
