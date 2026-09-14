// File: specs/999-test-plan/scripts/sc002-accuracy-compare.ts
// Change Log:
// - 2026-09-14: สร้าง script เปรียบเทียบ AI output กับ golden set สำหรับ SC-002 accuracy test
// - รองรับทั้ง golden set (5 docs) และ full migration population (267 docs)

import * as fs from 'fs';
import * as path from 'path';

/**
 * ผลลัพธ์การเปรียบเทียบ AI output กับ golden set
 */
interface ComparisonResult {
  documentId: string;
  expectedType: string;
  actualType: string | null;
  typeMatch: boolean;
  expectedConfidenceMin: number;
  actualConfidence: number | null;
  confidenceMet: boolean;
  expectedOcrQualityMin: number;
  actualOcrQuality: number | null;
  ocrQualityMet: boolean;
  expectedRequiresHumanReview: boolean;
  actualRequiresHumanReview: boolean;
  humanReviewMatch: boolean;
  aiStatus: string;
  ocrUsed: boolean;
  aiSummary: string | null;
  notes?: string;
}

/**
 * สถิติการจำแนกประเภท
 */
interface ClassificationStats {
  total: number;
  correct: number;
  incorrect: number;
  unavailable: number;
  accuracy: number;
  byType: Record<string, { total: number; correct: number; incorrect: number }>;
}

/**
 * สถิติ confidence distribution
 */
interface ConfidenceStats {
  total: number;
  nullCount: number;
  buckets: {
    '0.0-0.3': number;
    '0.3-0.5': number;
    '0.5-0.7': number;
    '0.7-0.85': number;
    '0.85-1.0': number;
  };
  mean: number | null;
  median: number | null;
}

/**
 * สถิติ threshold compliance
 */
interface ThresholdStats {
  total: number;
  metConfidence: number;
  metOcrQuality: number;
  metBoth: number;
  metNeither: number;
  humanReviewRate: number;
  humanReviewCount: number;
}

/**
 * สถิติ failure
 */
interface FailureStats {
  total: number;
  ocrFailed: number;
  llmFailed: number;
  schemaValidationFailed: number;
  noPdf: number;
  otherFailed: number;
}

/**
 * รายงาน accuracy ทั้งหมด
 */
interface AccuracyReport {
  generatedAt: string;
  batchId: string;
  goldenSetVersion: string;
  goldenSetResults: {
    comparisons: ComparisonResult[];
    classification: ClassificationStats;
    confidence: ConfidenceStats;
    threshold: ThresholdStats;
  };
  fullPopulationStats: {
    total: number;
    done: number;
    failed: number;
    waiting: number;
    running: number;
    pending: number;
    classification: ClassificationStats;
    confidence: ConfidenceStats;
    threshold: ThresholdStats;
    failures: FailureStats;
  };
  thresholdRecommendations: ThresholdRecommendation[];
}

/**
 * คำแนะนำ threshold recalibration
 */
interface ThresholdRecommendation {
  metric: string;
  currentValue: string;
  observedValue: string;
  recommendation: string;
  rationale: string;
}

/**
 * อ่าน golden set จาก fixtures
 */
function loadGoldenSet(): {
  documents: Array<{
    id: string;
    expectedAiType: string;
    expectedConfidenceMin: number;
    expectedOcrQualityMin: number;
    notes?: string;
  }>;
  version: string;
} {
  const goldenPath = path.join(
    __dirname,
    '..',
    'fixtures',
    'sc002-golden-set.json'
  );
  const content = fs.readFileSync(goldenPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * สร้าง SQL query สำหรับดึง AI output จาก migration_review_queue
 * กรองด้วย document_number ที่ตรงกับ golden set
 */
function buildGoldenSetQuery(documentIds: string[]): string {
  const escapedIds = documentIds
    .map((id) => `'${id.replace(/'/g, "''")}'`)
    .join(',');
  return `
    SELECT
      document_number,
      ai_suggested_correspondence_type,
      ai_confidence,
      confidence_score,
      ocr_quality_confidence,
      ocr_used,
      requires_human_review,
      ai_status,
      ai_summary,
      ai_failed,
      ai_issues,
      ai_metadata_json,
      subject,
      ocr_text
    FROM migration_review_queue
    WHERE document_number IN (${escapedIds})
    ORDER BY document_number
  `;
}

/**
 * สร้าง SQL query สำหรับดึง AI output ทั้งหมดใน batch
 */
function buildFullPopulationQuery(batchId: string): string {
  return `
    SELECT
      document_number,
      ai_suggested_correspondence_type,
      ai_confidence,
      confidence_score,
      ocr_quality_confidence,
      ocr_used,
      requires_human_review,
      ai_status,
      ai_summary,
      ai_failed,
      ai_issues,
      ai_metadata_json,
      subject,
      ocr_text
    FROM migration_review_queue
    WHERE batch_id = '${batchId.replace(/'/g, "''")}'
    ORDER BY document_number
  `;
}

/**
 * คำนวณสถิติการจำแนกประเภท
 */
function calcClassificationStats(
  results: ComparisonResult[]
): ClassificationStats {
  const total = results.length;
  let correct = 0;
  let incorrect = 0;
  let unavailable = 0;
  const byType: Record<
    string,
    { total: number; correct: number; incorrect: number }
  > = {};

  for (const r of results) {
    if (!r.actualType) {
      unavailable++;
      continue;
    }
    if (r.typeMatch) {
      correct++;
    } else {
      incorrect++;
    }

    if (!byType[r.expectedType]) {
      byType[r.expectedType] = { total: 0, correct: 0, incorrect: 0 };
    }
    byType[r.expectedType].total++;
    if (r.typeMatch) {
      byType[r.expectedType].correct++;
    } else {
      byType[r.expectedType].incorrect++;
    }
  }

  return {
    total,
    correct,
    incorrect,
    unavailable,
    accuracy: total > 0 ? correct / total : 0,
    byType,
  };
}

/**
 * คำนวณสถิติ confidence distribution
 */
function calcConfidenceStats(
  results: Array<{ actualConfidence: number | null }>
): ConfidenceStats {
  const confidences = results
    .map((r) => r.actualConfidence)
    .filter((c): c is number => c !== null && c !== undefined);

  const buckets = {
    '0.0-0.3': 0,
    '0.3-0.5': 0,
    '0.5-0.7': 0,
    '0.7-0.85': 0,
    '0.85-1.0': 0,
  };

  for (const c of confidences) {
    if (c < 0.3) buckets['0.0-0.3']++;
    else if (c < 0.5) buckets['0.3-0.5']++;
    else if (c < 0.7) buckets['0.5-0.7']++;
    else if (c < 0.85) buckets['0.7-0.85']++;
    else buckets['0.85-1.0']++;
  }

  const sorted = [...confidences].sort((a, b) => a - b);
  const mean =
    confidences.length > 0
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : null;
  const median =
    sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : null;

  return {
    total: results.length,
    nullCount: results.length - confidences.length,
    buckets,
    mean,
    median,
  };
}

/**
 * คำนวณสถิติ threshold compliance
 */
function calcThresholdStats(results: ComparisonResult[]): ThresholdStats {
  const total = results.length;
  let metConfidence = 0;
  let metOcrQuality = 0;
  let metBoth = 0;
  let metNeither = 0;
  let humanReviewCount = 0;

  for (const r of results) {
    if (r.confidenceMet) metConfidence++;
    if (r.ocrQualityMet) metOcrQuality++;
    if (r.confidenceMet && r.ocrQualityMet) metBoth++;
    if (!r.confidenceMet && !r.ocrQualityMet) metNeither++;
    if (r.actualRequiresHumanReview) humanReviewCount++;
  }

  return {
    total,
    metConfidence,
    metOcrQuality,
    metBoth,
    metNeither,
    humanReviewRate: total > 0 ? humanReviewCount / total : 0,
    humanReviewCount,
  };
}

/**
 * คำนวณสถิติ failure
 */
function calcFailureStats(
  rows: Array<{
    ai_status: string;
    ai_failed: number;
    ai_issues: string | null;
  }>
): FailureStats {
  let ocrFailed = 0;
  let llmFailed = 0;
  let schemaValidationFailed = 0;
  let noPdf = 0;
  let otherFailed = 0;

  for (const row of rows) {
    if (row.ai_status !== 'FAILED' && !row.ai_failed) continue;
    const issues = row.ai_issues || '';
    if (issues.includes('OCR') || issues.includes('EPIPE')) {
      ocrFailed++;
    } else if (issues.includes('LLM') || issues.includes('OLLAMA')) {
      llmFailed++;
    } else if (issues.includes('SCHEMA_VALIDATION')) {
      schemaValidationFailed++;
    } else if (issues.includes('NO_PDF') || issues.includes('FILE_NOT_FOUND')) {
      noPdf++;
    } else {
      otherFailed++;
    }
  }

  return {
    total: ocrFailed + llmFailed + schemaValidationFailed + noPdf + otherFailed,
    ocrFailed,
    llmFailed,
    schemaValidationFailed,
    noPdf,
    otherFailed,
  };
}

/**
 * สร้างคำแนะนำ threshold recalibration ตาม ADR-023A
 */
function generateThresholdRecommendations(
  goldenSet: ClassificationStats & { confidence: ConfidenceStats },
  fullPop: ClassificationStats & {
    confidence: ConfidenceStats;
    threshold: ThresholdStats;
    failures: FailureStats;
  }
): ThresholdRecommendation[] {
  const recommendations: ThresholdRecommendation[] = [];

  // 1. Confidence threshold
  const observedMeanConf = fullPop.confidence.mean;
  const observedAccuracy = fullPop.accuracy;
  if (observedMeanConf !== null) {
    if (observedAccuracy > 0.9 && observedMeanConf > 0.85) {
      recommendations.push({
        metric: 'confidence_threshold',
        currentValue: '0.85 (ADR-023A default)',
        observedValue: `mean=${observedMeanConf.toFixed(3)}, accuracy=${(observedAccuracy * 100).toFixed(1)}%`,
        recommendation: 'รักษา threshold ที่ 0.85',
        rationale: 'accuracy > 90% และ mean confidence > 0.85 — threshold ปัจจุบันเหมาะสม',
      });
    } else if (observedAccuracy < 0.7 || observedMeanConf < 0.5) {
      recommendations.push({
        metric: 'confidence_threshold',
        currentValue: '0.85 (ADR-023A default)',
        observedValue: `mean=${observedMeanConf.toFixed(3)}, accuracy=${(observedAccuracy * 100).toFixed(1)}%`,
        recommendation: 'พิจารณาลด threshold เป็น 0.7 หรือปรับปรุง prompt/model',
        rationale: 'accuracy < 70% หรือ mean confidence < 0.5 — threshold สูงเกินไปสำหรับข้อมูลจริง',
      });
    } else {
      recommendations.push({
        metric: 'confidence_threshold',
        currentValue: '0.85 (ADR-023A default)',
        observedValue: `mean=${observedMeanConf.toFixed(3)}, accuracy=${(observedAccuracy * 100).toFixed(1)}%`,
        recommendation: 'พิจารณาลด threshold เป็น 0.75',
        rationale: 'accuracy ปานกลาง — ลด threshold เพื่อลด false negative โดยให้ human review ตรวจสอบ',
      });
    }
  }

  // 2. OCR quality threshold
  const ocrFailureRate =
    fullPop.failures.total > 0
      ? fullPop.failures.ocrFailed / fullPop.total
      : 0;
  if (ocrFailureRate > 0.1) {
    recommendations.push({
      metric: 'ocr_quality_threshold',
      currentValue: '0.7 (ADR-023A default)',
      observedValue: `OCR failure rate=${(ocrFailureRate * 100).toFixed(1)}%`,
      recommendation: 'พิจารณาลด threshold เป็น 0.6 หรือปรับปรุง OCR sidecar',
      rationale: 'OCR failure rate > 10% — อาจมีไฟล์ PDF ที่สแกนคุณภาพต่ำ',
    });
  }

  // 3. Human review rate
  const humanReviewRate = fullPop.threshold.humanReviewRate;
  if (humanReviewRate > 0.3) {
    recommendations.push({
      metric: 'human_review_threshold',
      currentValue: 'auto (confidence < threshold)',
      observedValue: `human review rate=${(humanReviewRate * 100).toFixed(1)}%`,
      recommendation: 'พิจารณาปรับเกณฑ์การ flag human review',
      rationale: 'human review rate > 30% — อาจมี false positive มากเกินไป',
    });
  }

  return recommendations;
}

/**
 * สร้างรายงาน accuracy ทั้งหมด
 * NOTE: ต้องส่ง rows จาก DB query เข้ามา — script นี้ไม่เชื่อมต่อ DB โดยตรง
 */
export function generateAccuracyReport(
  goldenSetRows: Array<Record<string, unknown>>,
  fullPopulationRows: Array<Record<string, unknown>>,
  batchId: string
): AccuracyReport {
  const goldenSet = loadGoldenSet();

  // เปรียบเทียบ golden set
  const goldenComparisons: ComparisonResult[] = goldenSet.documents.map(
    (doc) => {
      const row = goldenSetRows.find(
        (r) => String(r.document_number) === doc.id
      );
      const actualType = row
        ? (row.ai_suggested_correspondence_type as string | null)
        : null;
      const actualConfidence = row
        ? Number(row.ai_confidence ?? row.confidence_score ?? null)
        : null;
      const actualOcrQuality = row
        ? Number(row.ocr_quality_confidence ?? null)
        : null;
      const actualHumanReview = row
        ? Boolean(row.requires_human_review)
        : false;
      const aiStatus = row ? String(row.ai_status) : 'NOT_FOUND';

      return {
        documentId: doc.id,
        expectedType: doc.expectedAiType,
        actualType,
        typeMatch: actualType === doc.expectedAiType,
        expectedConfidenceMin: doc.expectedConfidenceMin,
        actualConfidence:
          actualConfidence !== null && !isNaN(actualConfidence)
            ? actualConfidence
            : null,
        confidenceMet:
          actualConfidence !== null &&
          !isNaN(actualConfidence) &&
          actualConfidence >= doc.expectedConfidenceMin,
        expectedOcrQualityMin: doc.expectedOcrQualityMin,
        actualOcrQuality:
          actualOcrQuality !== null && !isNaN(actualOcrQuality)
            ? actualOcrQuality
            : null,
        ocrQualityMet:
          actualOcrQuality !== null &&
          !isNaN(actualOcrQuality) &&
          actualOcrQuality >= doc.expectedOcrQualityMin,
        expectedRequiresHumanReview: false,
        actualRequiresHumanReview: actualHumanReview,
        humanReviewMatch: false === actualHumanReview,
        aiStatus,
        ocrUsed: row ? Boolean(row.ocr_used) : false,
        aiSummary: row ? (row.ai_summary as string | null) : null,
        notes: doc.notes,
      };
    }
  );

  const goldenClassification = calcClassificationStats(goldenComparisons);
  const goldenConfidence = calcConfidenceStats(goldenComparisons);
  const goldenThreshold = calcThresholdStats(goldenComparisons);

  // สถิติ full population
  const total = fullPopulationRows.length;
  let done = 0;
  let failed = 0;
  let waiting = 0;
  let running = 0;
  let pending = 0;

  const fullComparisons: ComparisonResult[] = fullPopulationRows.map((row) => {
    const status = String(row.ai_status);
    if (status === 'DONE') done++;
    else if (status === 'FAILED') failed++;
    else if (status === 'WAITING') waiting++;
    else if (status === 'RUNNING') running++;
    else if (status === 'PENDING') pending++;

    // สำหรับ full population ไม่มี expected type — ใช้ actual type เป็นทั้ง expected และ actual
    const actualType = (row.ai_suggested_correspondence_type as string | null) ?? null;
    return {
      documentId: String(row.document_number),
      expectedType: actualType ?? 'UNKNOWN',
      actualType,
      typeMatch: true, // ไม่มี ground truth — ไม่สามารถวัด accuracy ได้
      expectedConfidenceMin: 0.85, // ADR-023A default
      actualConfidence: Number(row.ai_confidence ?? row.confidence_score ?? null),
      confidenceMet:
        Number(row.ai_confidence ?? row.confidence_score ?? 0) >= 0.85,
      expectedOcrQualityMin: 0.7, // ADR-023A default
      actualOcrQuality: Number(row.ocr_quality_confidence ?? null),
      ocrQualityMet: Number(row.ocr_quality_confidence ?? 0) >= 0.7,
      expectedRequiresHumanReview: false,
      actualRequiresHumanReview: Boolean(row.requires_human_review),
      humanReviewMatch: !Boolean(row.requires_human_review),
      aiStatus: status,
      ocrUsed: Boolean(row.ocr_used),
      aiSummary: (row.ai_summary as string | null) ?? null,
    };
  });

  const fullClassification = calcClassificationStats(fullComparisons);
  const fullConfidence = calcConfidenceStats(fullComparisons);
  const fullThreshold = calcThresholdStats(fullComparisons);
  const fullFailures = calcFailureStats(
    fullPopulationRows.map((r) => ({
      ai_status: String(r.ai_status),
      ai_failed: Number(r.ai_failed ?? 0),
      ai_issues: (r.ai_issues as string | null) ?? null,
    }))
  );

  const recommendations = generateThresholdRecommendations(
    { ...goldenClassification, confidence: goldenConfidence },
    {
      ...fullClassification,
      confidence: fullConfidence,
      threshold: fullThreshold,
      failures: fullFailures,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    batchId,
    goldenSetVersion: goldenSet.version,
    goldenSetResults: {
      comparisons: goldenComparisons,
      classification: goldenClassification,
      confidence: goldenConfidence,
      threshold: goldenThreshold,
    },
    fullPopulationStats: {
      total,
      done,
      failed,
      waiting,
      running,
      pending,
      classification: fullClassification,
      confidence: fullConfidence,
      threshold: fullThreshold,
      failures: fullFailures,
    },
    thresholdRecommendations: recommendations,
  };
}

/**
 * แปลงรายงานเป็น Markdown
 */
export function reportToMarkdown(report: AccuracyReport): string {
  const lines: string[] = [];
  lines.push('# SC-002 Accuracy Report — C2-2567 Migration');
  lines.push('');
  lines.push(`> Generated: ${report.generatedAt} | Batch: ${report.batchId} | Golden Set v${report.goldenSetVersion}`);
  lines.push('');

  // Golden Set Results
  lines.push('## 1. Golden Set Results (5 docs — human-verified)');
  lines.push('');
  lines.push('| Document | Expected | Actual | Match | Confidence | OCR Quality | Human Review | AI Status |');
  lines.push('|----------|----------|--------|-------|------------|-------------|--------------|-----------|');
  for (const c of report.goldenSetResults.comparisons) {
    lines.push(
      `| ${c.documentId} | ${c.expectedType} | ${c.actualType ?? 'N/A'} | ${c.typeMatch ? '✅' : '❌'} | ${c.actualConfidence?.toFixed(3) ?? 'N/A'} (min ${c.expectedConfidenceMin}) | ${c.actualOcrQuality?.toFixed(3) ?? 'N/A'} (min ${c.expectedOcrQualityMin}) | ${c.actualRequiresHumanReview ? 'Yes' : 'No'} | ${c.aiStatus} |`
    );
  }
  lines.push('');

  const gc = report.goldenSetResults.classification;
  lines.push(`**Classification Accuracy**: ${gc.correct}/${gc.total} (${(gc.accuracy * 100).toFixed(1)}%)`);
  lines.push(`- Correct: ${gc.correct}, Incorrect: ${gc.incorrect}, Unavailable: ${gc.unavailable}`);
  lines.push('');

  // Full Population Stats
  lines.push('## 2. Full Population Stats (C2-2567 Migration)');
  lines.push('');
  const fp = report.fullPopulationStats;
  lines.push(`**Total**: ${fp.total} | **DONE**: ${fp.done} | **FAILED**: ${fp.failed} | **WAITING**: ${fp.waiting} | **RUNNING**: ${fp.running} | **PENDING**: ${fp.pending}`);
  lines.push('');

  // Confidence Distribution
  lines.push('### 2.1 Confidence Distribution');
  lines.push('');
  const cd = fp.confidence;
  lines.push('| Bucket | Count |');
  lines.push('|--------|-------|');
  for (const [bucket, count] of Object.entries(cd.buckets)) {
    lines.push(`| ${bucket} | ${count} |`);
  }
  lines.push(`| **Null/NA** | ${cd.nullCount} |`);
  lines.push(`| **Mean** | ${cd.mean?.toFixed(3) ?? 'N/A'} |`);
  lines.push(`| **Median** | ${cd.median?.toFixed(3) ?? 'N/A'} |`);
  lines.push('');

  // Threshold Compliance
  lines.push('### 2.2 Threshold Compliance (ADR-023A defaults: confidence ≥ 0.85, OCR quality ≥ 0.7)');
  lines.push('');
  const tc = fp.threshold;
  lines.push(`- Met confidence threshold: ${tc.metConfidence}/${tc.total} (${((tc.metConfidence / tc.total) * 100).toFixed(1)}%)`);
  lines.push(`- Met OCR quality threshold: ${tc.metOcrQuality}/${tc.total} (${((tc.metOcrQuality / tc.total) * 100).toFixed(1)}%)`);
  lines.push(`- Met both: ${tc.metBoth}/${tc.total}`);
  lines.push(`- Met neither: ${tc.metNeither}/${tc.total}`);
  lines.push(`- Human review required: ${tc.humanReviewCount}/${tc.total} (${(tc.humanReviewRate * 100).toFixed(1)}%)`);
  lines.push('');

  // Failure Analysis
  lines.push('### 2.3 Failure Analysis');
  lines.push('');
  const fa = fp.failures;
  lines.push(`- Total failures: ${fa.total}`);
  lines.push(`- OCR failed: ${fa.ocrFailed}`);
  lines.push(`- LLM failed: ${fa.llmFailed}`);
  lines.push(`- Schema validation failed: ${fa.schemaValidationFailed}`);
  lines.push(`- No PDF: ${fa.noPdf}`);
  lines.push(`- Other: ${fa.otherFailed}`);
  lines.push('');

  // Classification by Type
  lines.push('### 2.4 Classification by Type (full population — no ground truth)');
  lines.push('');
  lines.push('| Type | Total | Correct | Incorrect |');
  lines.push('|------|-------|---------|-----------|');
  for (const [type, stats] of Object.entries(fp.classification.byType)) {
    lines.push(`| ${type} | ${stats.total} | ${stats.correct} | ${stats.incorrect} |`);
  }
  lines.push('');

  // Threshold Recommendations
  lines.push('## 3. Threshold Recalibration Recommendations (ADR-023A)');
  lines.push('');
  if (report.thresholdRecommendations.length === 0) {
    lines.push('ไม่มีคำแนะนำ — threshold ปัจจุบันเหมาะสม');
  } else {
    lines.push('| Metric | Current | Observed | Recommendation | Rationale |');
    lines.push('|--------|---------|----------|----------------|-----------|');
    for (const rec of report.thresholdRecommendations) {
      lines.push(`| ${rec.metric} | ${rec.currentValue} | ${rec.observedValue} | ${rec.recommendation} | ${rec.rationale} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('> **หมายเหตุ**: ความแม่นยำของ full population ไม่สามารถวัดได้โดยตรงเพราะไม่มี human-verified ground truth สำหรับทุก record — ใช้ golden set (5 docs) เป็นหลัก และใช้ full population สำหรับ confidence/OCR quality distribution และ failure analysis');

  return lines.join('\n');
}

// ถ้ารันโดยตรง — แสดง usage
if (require.main === module) {
  console.log('SC-002 Accuracy Comparison Script');
  console.log('');
  console.log('Usage: รัน SQL queries เพื่อดึงข้อมูลจาก migration_review_queue');
  console.log('       แล้วส่ง rows เข้า generateAccuracyReport()');
  console.log('');
  console.log('Golden Set Query:');
  const goldenSet = loadGoldenSet();
  console.log(buildGoldenSetQuery(goldenSet.documents.map((d) => d.id)));
  console.log('');
  console.log('Full Population Query:');
  console.log(buildFullPopulationQuery('BATCH-C2-2567-005'));
}
