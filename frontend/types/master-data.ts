/**
 * Master Data Entity Types
 */

export interface CorrespondenceType {
  id: number;
  typeCode: string;
  typeName: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface Discipline {
  id: number;
  disciplineCode: string;
  codeNameEn: string;
  codeNameTh?: string;
  isActive: boolean;
  contract?: {
    id?: number;
    publicId?: string;
    contractCode: string;
    contractName: string;
  };
  contractId?: number | string;
}

export interface RfaType {
  id: number;
  typeCode: string;
  typeNameTh: string;
  typeNameEn?: string;
  remark?: string;
  isActive: boolean;
  contract?: {
    id?: number;
    publicId?: string;
    contractCode: string;
    contractName: string;
  };
  contractId?: number | string;
}

export interface Tag {
  id: number;
  tagName: string;
  colorCode?: string;
  description?: string;
}

export interface DrawingCategory {
  id: number;
  subTypeCode: string;
  subTypeName: string;
  subTypeNumber?: string;
}

export interface ShopMainCategory {
  id: number;
  mainCategoryCode: string;
  mainCategoryName: string;
  name?: string; // Fallback for legacy data
  isActive: boolean;
}

export interface ShopSubCategory {
  id: number;
  subCategoryCode: string;
  subCategoryName: string;
  name?: string; // Fallback for legacy data
  isActive: boolean;
}

export interface ContractDrawingCategory {
  id: number;
  catCode: string;
  catName: string;
  name?: string; // Fallback for legacy data
}
