-- Delta: Data fix — merge migrated correspondences that are revisions of the
-- same legacy document into proper correspondence_revisions chains
-- Date: 2026-09-23
-- Related: ADR-028/ADR-047 (legacy ingestion), ADR-052 (excel review)
-- Type: DATA FIX (not schema) — D8 bulk-operation protocol
-- Backups: z_bak_20260923_* tables
--
-- Dispositions:
--  A) Lettered -A/-B/-C groups (7 groups, RFA) → one correspondence per base
--     number, revisions labelled A/B/C, latest = is_current
--  B) SDW-0001-0 + -R1 → corr renamed to base, -R1 revision becomes rev 1
--     with its real file (I672-0187) attached
--  C) ผรม.2-0090 / สคฉ.3-0670 -R1 → rev 1 of base + real files
--     (O672-0222 / O672-0223) attached
--  D) Pure register duplicates (same file) → correspondence deleted:
--     MAT-0001-A-R1(135), MAT-0002-A-R1(132), ผรม.2-0066-R1(435)
--  E) สคฉ.3-03-23-0007-R1(573) → actually doc 0009 → rename
--  F) ผรม.2-สคฉ.3-03-0008-R1(233) → different letter, same เลขที่ → untouched

START TRANSACTION;

-- ============================================================
-- A1. LCBP3-C2-MAT-STR-MAT-0001  (A=90, B=149, C=142, dup=135)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-MAT-STR-MAT-0001' WHERE id = 90;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0001-A')
  WHERE id = 93;
UPDATE correspondence_revisions SET correspondence_id = 90, revision_number = 1,
  revision_label = 'B', is_current = 0,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0001-B')
  WHERE id = 152;
UPDATE correspondence_revisions SET correspondence_id = 90, revision_number = 2,
  revision_label = 'C', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0001-C')
  WHERE id = 145;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6b-3247-73be-8658-3641ed519a2e'
  WHERE id IN (162, 193, 122);
DELETE FROM correspondences WHERE id IN (149, 142, 135);

-- ============================================================
-- A2. LCBP3-C2-MAT-STR-MAT-0002  (A=91, B=119, C=150, dup=132)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-MAT-STR-MAT-0002' WHERE id = 91;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0002-A')
  WHERE id = 94;
UPDATE correspondence_revisions SET correspondence_id = 91, revision_number = 1,
  revision_label = 'B', is_current = 0,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0002-B')
  WHERE id = 122;
UPDATE correspondence_revisions SET correspondence_id = 91, revision_number = 2,
  revision_label = 'C', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0002-C')
  WHERE id = 153;
-- ย้าย tag ของ corr 150 (MAT-0002-C) ไปยัง survivor 91
UPDATE correspondence_tags SET correspondence_id = 91 WHERE correspondence_id = 150;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6b-3312-761c-9796-da31b6efa049'
  WHERE id IN (152, 183, 123);
DELETE FROM correspondences WHERE id IN (119, 150, 132);

-- ============================================================
-- A3. LCBP3-C2-MAT-STR-MAT-0003  (A=126, B=140)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-MAT-STR-MAT-0003' WHERE id = 126;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0003-A')
  WHERE id = 129;
UPDATE correspondence_revisions SET correspondence_id = 126, revision_number = 1,
  revision_label = 'B', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MAT-STR-MAT-0003-B')
  WHERE id = 143;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6d-d9ab-72cd-a7e9-46187ed0467d'
  WHERE id = 191;
DELETE FROM correspondences WHERE id = 140;

-- ============================================================
-- A4. LCBP3-C2-MET-GEN-DSN-0001  (A=148, B=113)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-MET-GEN-DSN-0001' WHERE id = 148;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MET-GEN-DSN-0001-A')
  WHERE id = 151;
UPDATE correspondence_revisions SET correspondence_id = 148, revision_number = 1,
  revision_label = 'B', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MET-GEN-DSN-0001-B')
  WHERE id = 116;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6d-e0cd-7036-81ba-229d99143fc2'
  WHERE id = 175;
DELETE FROM correspondences WHERE id = 113;

-- ============================================================
-- A5. LCBP3-C2-MET-TER-ITP-0001  (A=97, B=110)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-MET-TER-ITP-0001' WHERE id = 97;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MET-TER-ITP-0001-A')
  WHERE id = 100;
UPDATE correspondence_revisions SET correspondence_id = 97, revision_number = 1,
  revision_label = 'B', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-MET-TER-ITP-0001-B')
  WHERE id = 113;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6b-34e2-7197-b5b0-7e6e5495d04c'
  WHERE id = 167;
DELETE FROM correspondences WHERE id = 110;

-- ============================================================
-- A6. LCBP3-C2-RFA-SFT-PRD-0001  (A=138, B=118)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-RFA-SFT-PRD-0001' WHERE id = 138;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-RFA-SFT-PRD-0001-A')
  WHERE id = 141;
UPDATE correspondence_revisions SET correspondence_id = 138, revision_number = 1,
  revision_label = 'B', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-RFA-SFT-PRD-0001-B')
  WHERE id = 121;
-- re-point references ของ corr 118 → 138 (dedupe: (501,138) มีอยู่แล้ว)
UPDATE correspondence_references SET src_correspondence_id = 138
  WHERE src_correspondence_id = 118;
DELETE FROM correspondence_references
  WHERE tgt_correspondence_id = 118 AND src_correspondence_id = 501;
UPDATE correspondence_references SET tgt_correspondence_id = 138
  WHERE tgt_correspondence_id = 118;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6d-dc30-724c-a9f1-420444bc9521'
  WHERE id = 150;
DELETE FROM correspondences WHERE id = 118;

-- ============================================================
-- A7. LCBP3-C2-RFA-TRF-PRD-0001  (A=115, B=141)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-RFA-TRF-PRD-0001' WHERE id = 115;
UPDATE correspondence_revisions SET is_current = 0, revision_label = 'A',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-RFA-TRF-PRD-0001-A')
  WHERE id = 118;
UPDATE correspondence_revisions SET correspondence_id = 115, revision_number = 1,
  revision_label = 'B', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-RFA-TRF-PRD-0001-B')
  WHERE id = 144;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6d-239b-7529-9b25-0bee5f6365a9'
  WHERE id = 192;
DELETE FROM correspondences WHERE id = 141;

-- ============================================================
-- B. LCBP3-C2-SDW-GEN-SDW-0001  (base=147 "-0", R1=112)
--    -R1 = rev 1 จริง (ไฟล์ I672-0187 ที่ register ตั้งใจ)
-- ============================================================
UPDATE correspondences SET correspondence_number = 'LCBP3-C2-SDW-GEN-SDW-0001' WHERE id = 147;
UPDATE correspondence_revisions SET is_current = 0, revision_label = '0',
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-SDW-GEN-SDW-0001-0')
  WHERE id = 150;
UPDATE correspondence_revisions SET correspondence_id = 147, revision_number = 1,
  revision_label = '1', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'LCBP3-C2-SDW-GEN-SDW-0001-0-R1')
  WHERE id = 115;
-- attachment จริงสำหรับ rev 1 (I672-0187)
INSERT INTO attachments
  (original_filename, stored_filename, file_path, mime_type, file_size,
   is_temporary, uploaded_by_user_id, ai_processing_status, rag_status,
   classification, effective_classification)
VALUES
  ('I672-0187-LCBP3-C2-SDW-GEN-SDW-0001-0.pdf',
   'I672-0187-LCBP3-C2-SDW-GEN-SDW-0001-0.pdf',
   '/mnt/legacy-staging/Incoming/08C.2/2567/I672-0187-LCBP3-C2-SDW-GEN-SDW-0001-0.pdf',
   'application/pdf', 7860372, 0, 2, 'PENDING', 'PENDING', 'INTERNAL', 'INTERNAL');
SET @att_sdw := LAST_INSERT_ID();
DELETE FROM correspondence_revision_attachments
  WHERE correspondence_revision_id = 115 AND attachment_id = 494;
INSERT INTO correspondence_revision_attachments
  (correspondence_revision_id, attachment_id, is_main_document)
VALUES (115, @att_sdw, 1);
UPDATE correspondence_revisions SET details = JSON_SET(details,
    '$.attachment_id', @att_sdw, '$.attachment_ids', JSON_ARRAY(@att_sdw))
  WHERE id = 115;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0ae6d-e0bd-746f-b952-be5aac42a2fa'
  WHERE id = 174;
DELETE FROM correspondences WHERE id = 112;

-- ============================================================
-- C1. คคง.-ผรม.2-0090-2567  (base=361, R1=356 → rev1 + O672-0222)
-- ============================================================
UPDATE correspondence_revisions SET is_current = 0 WHERE id = 363;
UPDATE correspondence_revisions SET correspondence_id = 361, revision_number = 1,
  revision_label = '1', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'คคง.-ผรม.2-0090-2567-R1')
  WHERE id = 358;
INSERT INTO attachments
  (original_filename, stored_filename, file_path, mime_type, file_size,
   is_temporary, uploaded_by_user_id, ai_processing_status, rag_status,
   classification, effective_classification)
VALUES
  ('O672-0222-คคง.-ผรม.2-0090-2567.pdf',
   'O672-0222-คคง.-ผรม.2-0090-2567.pdf',
   '/mnt/legacy-staging/Outgoing/2567/O672-0222-คคง.-ผรม.2-0090-2567.pdf',
   'application/pdf', 6946520, 0, 2, 'PENDING', 'PENDING', 'INTERNAL', 'INTERNAL');
SET @att_0090 := LAST_INSERT_ID();
DELETE FROM correspondence_revision_attachments
  WHERE correspondence_revision_id = 358 AND attachment_id = 973;
INSERT INTO correspondence_revision_attachments
  (correspondence_revision_id, attachment_id, is_main_document)
VALUES (358, @att_0090, 1);
UPDATE correspondence_revisions SET details = JSON_SET(details,
    '$.attachment_id', @att_0090, '$.attachment_ids', JSON_ARRAY(@att_0090))
  WHERE id = 358;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0b918-f7ae-7418-a721-7cda8486c2cd'
  WHERE id = 726;
DELETE FROM correspondences WHERE id = 356;

-- ============================================================
-- C2. คคง.-สคฉ.3-0670-2567  (base=360, R1=355 → rev1 + O672-0223)
-- ============================================================
UPDATE correspondence_revisions SET is_current = 0 WHERE id = 362;
UPDATE correspondence_revisions SET correspondence_id = 360, revision_number = 1,
  revision_label = '1', is_current = 1,
  details = JSON_SET(details, '$.legacy_document_number', 'คคง.-สคฉ.3-0670-2567-R1')
  WHERE id = 357;
INSERT INTO attachments
  (original_filename, stored_filename, file_path, mime_type, file_size,
   is_temporary, uploaded_by_user_id, ai_processing_status, rag_status,
   classification, effective_classification)
VALUES
  ('O672-0223-คคง.-สคฉ.3-0670-2567.pdf',
   'O672-0223-คคง.-สคฉ.3-0670-2567.pdf',
   '/mnt/legacy-staging/Outgoing/2567/O672-0223-คคง.-สคฉ.3-0670-2567.pdf',
   'application/pdf', 7522935, 0, 2, 'PENDING', 'PENDING', 'INTERNAL', 'INTERNAL');
SET @att_0670 := LAST_INSERT_ID();
DELETE FROM correspondence_revision_attachments
  WHERE correspondence_revision_id = 357 AND attachment_id = 974;
INSERT INTO correspondence_revision_attachments
  (correspondence_revision_id, attachment_id, is_main_document)
VALUES (357, @att_0670, 1);
UPDATE correspondence_revisions SET details = JSON_SET(details,
    '$.attachment_id', @att_0670, '$.attachment_ids', JSON_ARRAY(@att_0670))
  WHERE id = 357;
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0b918-f7a6-748f-a6cb-0ef9b6e35d3f'
  WHERE id = 727;
DELETE FROM correspondences WHERE id = 355;

-- ============================================================
-- D. Pure duplicates → delete correspondence shells
--    (135 MAT-0001-A-R1 shares att 458 with A — attachment survives;
--     132 shares att 459; 435 มี att 912 เฉพาะตัว — ลบ attachment ด้วย)
-- ============================================================
-- queue repoints ทำไว้ในกลุ่ม A1/A2 แล้ว; เหลือ queue 651 → 549
UPDATE migration_review_queue SET imported_correspondence_public_id = '01a0c36d-b28b-75c9-87ac-ec2b7d1b5080'
  WHERE id = 651;
DELETE FROM correspondences WHERE id = 435;
DELETE FROM attachments WHERE id = 912;

-- ============================================================
-- E. คคง.-สคฉ.3-03-23-0007-2567-R1 (573) → เลขจริงคือ ...-0009-2567
-- ============================================================
UPDATE correspondences SET correspondence_number = 'คคง.-สคฉ.3-03-23-0009-2567' WHERE id = 573;
UPDATE correspondence_revisions SET details = JSON_SET(details,
    '$.legacy_document_number', 'คคง.-สคฉ.3-03-23-0007-2567-R1')
  WHERE id = 575;

COMMIT;

-- Verification
SELECT c.id, c.correspondence_number, r.revision_number, r.revision_label,
       r.is_current, JSON_UNQUOTE(JSON_EXTRACT(r.details,'$.legacy_document_number')) AS legacy_no
FROM correspondences c JOIN correspondence_revisions r ON r.correspondence_id = c.id
WHERE c.id IN (90,91,97,115,126,138,147,148,360,361,573,233,237)
ORDER BY c.correspondence_number, r.revision_number;
