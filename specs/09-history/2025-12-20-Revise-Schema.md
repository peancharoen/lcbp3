## TABLE contract_drawings:
  - change sub_cat_id -> map_cat_id
  - add volume_page INT COMMENT 'หน้าที่',
## TABLE contract_drawing_subcat_cat_maps
  - alter id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
## TABLE shop_drawing_sub_categories
  - delete main_category_id
  - add project_id INT NOT NULL COMMENT 'โครงการ',
## TABLE shop_drawing_main_categories
  - add project_id INT NOT NULL COMMENT 'โครงการ',
## TABLE shop_drawings
  - delete title
## TABLE shop_drawing_revisions
  - add title
  - add legacy_drawing_number VARCHAR(100) NULL  COMMENT 'เลขที่เดิมของ Shop Drawing',
## TABLE asbuilt_drawings
## TABLE asbuilt_drawing_revisions
## TABLE asbuilt_revision_shop_revisions_refs
