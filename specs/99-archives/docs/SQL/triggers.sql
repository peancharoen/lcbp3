-- trigger
DROP TRIGGER IF EXISTS trg_rfa_revisions_is_current;
DROP TRIGGER IF EXISTS trg_rfa_revisions_is_current_upd;
DROP TRIGGER IF EXISTS trg_rfa_revisions_auto_reset;
-- ============================================================
-- ⚙️ TRIGGERS
-- ============================================================
-- ป้องกันไม่ให้มี revision ที่ is_current=TRUE ซ้ำใน rfa_id เดียวกัน
DELIMITER $$
CREATE TRIGGER trg_rfa_revisions_is_current
BEFORE INSERT ON rfa_revisions
FOR EACH ROW
BEGIN
  IF NEW.is_current = TRUE THEN
    IF (SELECT COUNT(*) FROM rfa_revisions WHERE rfa_id = NEW.rfa_id AND is_current = TRUE) > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot insert more than one current revision per RFA.';
    END IF;
  END IF;
END$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER trg_rfa_revisions_is_current_upd
BEFORE UPDATE ON rfa_revisions
FOR EACH ROW
BEGIN
  IF NEW.is_current = TRUE AND (OLD.is_current IS NULL OR OLD.is_current = FALSE) THEN
    IF (SELECT COUNT(*) FROM rfa_revisions WHERE rfa_id = NEW.rfa_id AND is_current = TRUE AND correspondences_id <> OLD.correspondences_id) > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot set more than one current revision per RFA.';
    END IF;
  END IF;
END$$
DELIMITER ;
-- ทำให้เวลาสร้าง revision ใหม่ที่ is_current=TRUE ระบบจะ set revision เดิมเป็น FALSE อัตโนมัติ
DELIMITER $$
CREATE TRIGGER trg_rfa_revisions_auto_reset
BEFORE INSERT ON rfa_revisions
FOR EACH ROW
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE rfa_revisions
      SET is_current = FALSE
      WHERE rfa_id = NEW.rfa_id;
  END IF;
END$$
DELIMITER ;