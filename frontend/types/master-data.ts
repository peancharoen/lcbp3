/**
 * Master Data Entity Types
 */

export interface CorrespondenceType {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  typeCode: string;
  typeName: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface Discipline {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  disciplineCode: string;
  codeNameEn: string;
  codeNameTh?: string;
  isActive: boolean;
  contract?: {
    publicId?: string;
    contractCode: string;
    contractName: string;
  };
  contractId?: number | string; // ADR-019: Accept UUID
}

export interface RfaType {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  typeCode: string;
  typeNameTh: string;
  typeNameEn?: string;
  remark?: string;
  isActive: boolean;
  contract?: {
    publicId?: string;
    contractCode: string;
    contractName: string;
  };
  contractId?: number | string; // ADR-019: Accept UUID
}

export interface Tag {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  tagName: string;
  colorCode?: string;
  description?: string;
}

export interface DrawingCategory {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  subTypeCode: string;
  subTypeName: string;
  subTypeNumber?: string;
}

export interface ShopMainCategory {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  mainCategoryCode: string;
  mainCategoryName: string;
  name?: string; // Fallback for legacy data
  isActive: boolean;
}

export interface ShopSubCategory {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  subCategoryCode: string;
  subCategoryName: string;
  name?: string; // Fallback for legacy data
  isActive: boolean;
}

export interface ContractDrawingCategory {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  catCode: string;
  catName: string;
  name?: string; // Fallback for legacy data
}
