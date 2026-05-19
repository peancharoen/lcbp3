// File: src/modules/ai/intent-classifier/index.ts
// Change Log
// - 2026-05-19: สร้าง barrel export สำหรับ Intent Classification Module (ADR-024).

export { IntentClassifierModule } from './intent-classifier.module';
export { IntentClassifierService } from './services/intent-classifier.service';
export { IntentDefinitionService } from './services/intent-definition.service';
export { IntentPatternService } from './services/intent-pattern.service';
export { IntentDefinition } from './entities/intent-definition.entity';
export { IntentPattern } from './entities/intent-pattern.entity';
export type {
  ClassificationResult,
  ClassificationInput,
  CachedPattern,
} from './interfaces/classification-result.interface';
export {
  IntentCategory,
  PatternType,
  PatternLanguage,
} from './interfaces/intent-category.enum';
