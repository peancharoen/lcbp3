-- Rollback: 2026-09-23-imported-revision-merge-datafix.sql
-- Date: 2026-09-23
--
-- Rollback strategy: restore from z_bak_20260923_* backup tables.
-- WARNING: rows created AFTER the datafix in these tables would be lost if a
-- full-table restore is used. Prefer surgical restore of affected ids only.
--
-- Affected correspondences:
--   survivors (renumbered): 90,91,97,115,126,138,147,148,360,361,573
--   deleted shells:         110,112,113,118,119,132,135,140,141,142,149,150,355,356,435
--   untouched:              233 (ผรม.2-สคฉ.3-03-0008-2567-R1, kept as separate doc)
--   new attachments:        ids > max(id) of z_bak_20260923_attachments (1246,1247,1248)

START TRANSACTION;

-- 1. Restore deleted correspondence shells (+ cascaded rows)
INSERT INTO correspondences
  SELECT * FROM z_bak_20260923_correspondences
  WHERE id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO correspondence_revisions
  SELECT * FROM z_bak_20260923_correspondence_revisions
  WHERE correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO correspondence_revision_attachments
  SELECT j.* FROM z_bak_20260923_cra j
  JOIN correspondence_revisions r ON r.id = j.correspondence_revision_id
  WHERE r.correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO correspondence_recipients
  SELECT * FROM z_bak_20260923_recipients
  WHERE correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO correspondence_tags
  SELECT * FROM z_bak_20260923_tags
  WHERE correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO correspondence_references
  SELECT * FROM z_bak_20260923_refs
  WHERE src_correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435)
     OR tgt_correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO rfas
  SELECT * FROM z_bak_20260923_rfas
  WHERE id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435);
INSERT INTO rfa_revisions
  SELECT * FROM z_bak_20260923_rfa_revisions
  WHERE id IN (SELECT id FROM correspondence_revisions
               WHERE correspondence_id IN (110,112,113,118,119,132,135,140,141,142,149,150,355,356,435));
INSERT INTO attachments
  SELECT * FROM z_bak_20260923_attachments WHERE id = 912;

-- 2. Revert survivors to pre-fix state
UPDATE correspondences c
JOIN z_bak_20260923_correspondences b ON b.id = c.id
SET c.correspondence_number = b.correspondence_number
WHERE c.id IN (90,91,97,115,126,138,147,148,360,361,573);

UPDATE correspondence_revisions r
JOIN z_bak_20260923_correspondence_revisions b ON b.id = r.id
SET r.correspondence_id = b.correspondence_id,
    r.revision_number   = b.revision_number,
    r.revision_label    = b.revision_label,
    r.is_current        = b.is_current,
    r.details           = b.details
WHERE r.id IN (SELECT id FROM z_bak_20260923_correspondence_revisions
               WHERE correspondence_id IN (90,91,97,115,126,138,147,148,360,361,573));

-- 3. Remove junction rows + attachments created by the fix
DELETE j FROM correspondence_revision_attachments j
JOIN attachments a ON a.id = j.attachment_id
WHERE a.id IN (1246, 1247, 1248);
DELETE FROM attachments WHERE id IN (1246, 1247, 1248);

-- 4. Restore queue links
UPDATE migration_review_queue q
JOIN z_bak_20260923_queue b ON b.id = q.id
SET q.imported_correspondence_public_id = b.imported_correspondence_public_id
WHERE q.id IN (122,123,150,152,162,167,174,175,183,191,192,193,651,726,727);

COMMIT;

-- NOTE: Elasticsearch index entries for renamed correspondences may need
-- reindexing on rollback as well.
