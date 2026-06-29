-- ==========================================================
-- DMS v1.9.0 Schema Part 1/3: DROP Statements
-- รันไฟล์นี้ก่อน เพื่อล้างตารางเดิมทั้งหมด
-- ==========================================================
-- ==========================================================
-- DMS v1.9.0 Document Management System Database
-- Deploy Script Schema
-- Server: Container Station on QNAP TS-473A
-- Database service: MariaDB 11.8
-- database web ui: phpmyadmin 5-apache
-- database development ui: DBeaver
-- backend service: NestJS
-- frontend service: next.js
-- reverse proxy: jc21/nginx-proxy-manager:latest
-- cron service: n8n
-- ==========================================================
-- [v1.9.0 UPDATE] Prepare migration
-- Update: Upgraded from v1.7.0
-- Last Updated: 2026-02-27
-- Major Changes:
--   1. ปรับปรุง:
--     1.1 TABLE correspondences
--       - INDEX idx_doc_number (correspondence_number),
--       - INDEX idx_deleted_at (deleted_at),
--       - INDEX idx_created_by (created_by),
-- ==========================================================
SET NAMES utf8mb4;

SET time_zone = '+07:00';

-- ปิดการตรวจสอบ Foreign Key ชั่วคราวเพื่อให้สามารถลบตารางได้ทั้งหมด
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_document_statistics;

DROP VIEW IF EXISTS v_documents_with_attachments;

DROP VIEW IF EXISTS v_user_all_permissions;

DROP VIEW IF EXISTS v_audit_log_details;

DROP VIEW IF EXISTS v_user_tasks;

DROP VIEW IF EXISTS v_contract_parties_all;

DROP VIEW IF EXISTS v_current_rfas;

DROP VIEW IF EXISTS v_current_correspondences;

-- DROP PROCEDURE IF EXISTS sp_get_next_document_number;
-- 🗑️ DROP TABLE SCRIPT: LCBP3-DMS v1.4.2
-- คำเตือน: ข้อมูลทั้งหมดจะหายไป กรุณา Backup ก่อนรันบน Production
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- ส่วนที่ 1: ตาราง System, Logs & Preferences (ตารางปลายทาง/ส่วนเสริม)
-- ============================================================
DROP TABLE IF EXISTS backup_logs;

DROP TABLE IF EXISTS search_indices;

DROP TABLE IF EXISTS notifications;

DROP TABLE IF EXISTS audit_logs;

-- [NEW v1.4.2] ตารางการตั้งค่าส่วนตัวของผู้ใช้ (FK -> users)
DROP TABLE IF EXISTS user_preferences;

-- [NEW v1.4.2] ตารางเก็บ Schema สำหรับ Validate JSON (Stand-alone)
DROP TABLE IF EXISTS json_schemas;

-- [v1.5.1 NEW] ตาราง Audit และ Error Log สำหรับ Document Numbering
DROP TABLE IF EXISTS document_number_errors;

DROP TABLE IF EXISTS document_number_audit;

DROP TABLE IF EXISTS document_number_reservations;

-- ============================================================
-- ส่วนที่ 2: ตาราง Junction (เชื่อมโยงข้อมูล M:N)
-- ============================================================
DROP TABLE IF EXISTS correspondence_tags;

DROP TABLE IF EXISTS asbuilt_revision_shop_revisions_refs;

DROP TABLE IF EXISTS shop_drawing_revision_contract_refs;

DROP TABLE IF EXISTS contract_drawing_subcat_cat_maps;

-- ============================================================
-- ส่วนที่ 3: ตารางไฟล์แนบและการเชื่อมโยง (Attachments)
-- ============================================================
DROP TABLE IF EXISTS contract_drawing_attachments;

DROP TABLE IF EXISTS circulation_attachments;

DROP TABLE IF EXISTS shop_drawing_revision_attachments;

DROP TABLE IF EXISTS asbuilt_drawing_revision_attachments;

DROP TABLE IF EXISTS correspondence_revision_attachments;

DROP TABLE IF EXISTS attachments;

-- ตารางหลักเก็บ path ไฟล์
-- ============================================================
-- ส่วนที่ 4: ตาราง Workflow & Routing (Process Logic)
-- ============================================================
-- Correspondence Workflow
-- ============================================================
-- ส่วนที่ 5: ตาราง Mapping สิทธิ์และโครงสร้าง (Access Control)
-- ============================================================
DROP TABLE IF EXISTS role_permissions;

DROP TABLE IF EXISTS user_assignments;

DROP TABLE IF EXISTS contract_organizations;

DROP TABLE IF EXISTS project_organizations;

-- ============================================================
-- ส่วนที่ 6: ตารางรายละเอียดของเอกสาร (Revisions & Items)
-- ============================================================
DROP TABLE IF EXISTS transmittal_items;

DROP TABLE IF EXISTS shop_drawing_revisions;

DROP TABLE IF EXISTS asbuilt_drawing_revisions;

DROP TABLE IF EXISTS rfa_items;

DROP TABLE IF EXISTS rfa_revisions;

DROP TABLE IF EXISTS correspondence_references;

DROP TABLE IF EXISTS correspondence_recipients;

DROP TABLE IF EXISTS correspondence_revisions;

-- [Modified v1.4.2] มี Virtual Columns
-- ============================================================
-- ส่วนที่ 7: ตารางเอกสารหลัก (Core Documents)
-- ============================================================
DROP TABLE IF EXISTS circulations;

DROP TABLE IF EXISTS transmittals;

DROP TABLE IF EXISTS contract_drawings;

DROP TABLE IF EXISTS shop_drawings;

DROP TABLE IF EXISTS asbuilt_drawings;

DROP TABLE IF EXISTS rfas;

DROP TABLE IF EXISTS correspondences;

-- ============================================================
-- ส่วนที่ 8: ตารางหมวดหมู่และข้อมูลหลัก (Master Data)
-- ============================================================
-- [NEW 6B] ลบตารางใหม่ที่เพิ่มเข้ามาเพื่อป้องกัน Error เวลา Re-deploy
DROP TABLE IF EXISTS correspondence_sub_types;

DROP TABLE IF EXISTS disciplines;

DROP TABLE IF EXISTS shop_drawing_sub_categories;

DROP TABLE IF EXISTS shop_drawing_main_categories;

DROP TABLE IF EXISTS contract_drawing_sub_cats;

DROP TABLE IF EXISTS contract_drawing_cats;

DROP TABLE IF EXISTS contract_drawing_volumes;

DROP TABLE IF EXISTS circulation_status_codes;

DROP TABLE IF EXISTS rfa_approve_codes;

DROP TABLE IF EXISTS rfa_status_codes;

DROP TABLE IF EXISTS rfa_types;

DROP TABLE IF EXISTS correspondence_status;

DROP TABLE IF EXISTS correspondence_types;

DROP TABLE IF EXISTS document_number_counters;

-- [Modified v1.4.2] มี version column
DROP TABLE IF EXISTS document_number_formats;

DROP TABLE IF EXISTS tags;

-- ============================================================
-- ส่วนที่ 9: ตารางผู้ใช้ บทบาท และโครงสร้างรากฐาน (Root Tables)
-- ============================================================
DROP TABLE IF EXISTS organization_roles;

DROP TABLE IF EXISTS roles;

DROP TABLE IF EXISTS permissions;

DROP TABLE IF EXISTS contracts;

DROP TABLE IF EXISTS projects;

DROP TABLE IF EXISTS refresh_tokens;

DROP TABLE IF EXISTS users;

-- Referenced by user_preferences, audit_logs, etc.
DROP TABLE IF EXISTS organizations;

-- Referenced by users, projects, etc.
