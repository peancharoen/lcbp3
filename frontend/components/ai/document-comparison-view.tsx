// File: components/ai/document-comparison-view.tsx
// Side-by-side PDF viewer + Form ที่มี AI Suggestions (ADR-018, ADR-020)

import { useState } from 'react';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AiSuggestionField } from './ai-suggestion-field';
import type { ExtractionResult } from '@/types/ai';

// Labels ภาษาไทยสำหรับ field ต่างๆ
const FIELD_LABELS: Record<string, string> = {
  subject: 'ชื่อเรื่อง',
  documentDate: 'วันที่เอกสาร',
  category: 'ประเภทเอกสาร',
  senderId: 'รหัสองค์กรผู้ส่ง',
  disciplineId: 'สาขา (Discipline)',
  issuedDate: 'วันที่ออกเอกสาร',
  receivedDate: 'วันที่รับเอกสาร',
  projectCode: 'รหัสโครงการ',
  documentNumber: 'เลขที่เอกสาร',
};

// Fields ที่แสดงใน comparison view
const DISPLAY_FIELDS = ['subject', 'documentDate', 'category', 'disciplineId', 'senderId'];

export interface DocumentComparisonViewProps {
  fileUrl: string | null;
  extractedData: ExtractionResult | null;
  formData: Record<string, string>;
  onFieldUpdate: (field: string, value: string) => void;
  extractedText?: string;
  reviewReason?: string;
}

export function DocumentComparisonView({
  fileUrl,
  extractedData,
  formData,
  onFieldUpdate,
  extractedText,
  reviewReason,
}: DocumentComparisonViewProps) {
  const [showRawText, setShowRawText] = useState(false);

  // แกะ metadata และ confidence จาก ExtractionResult
  const metadata = (extractedData?.extractedMetadata ?? {}) as Record<string, unknown>;
  const fieldConfidences = metadata.fieldConfidences as Record<string, number> | undefined;

  const getSuggestion = (field: string): string | undefined => {
    const val = metadata[field];
    return val !== undefined ? String(val) : undefined;
  };

  const getConfidence = (field: string): number | undefined =>
    fieldConfidences?.[field] ?? extractedData?.confidenceScore;

  return (
    <div className="flex flex-1 gap-6 overflow-hidden">
      {/* Left: PDF Viewer */}
      <Card className="flex-1 hidden md:flex flex-col overflow-hidden border-2 border-primary/10 shadow-md">
        <CardContent className="p-0 flex-1 relative bg-slate-100">
          {fileUrl ? (
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0`}
              className="absolute inset-0 w-full h-full"
              title="Document Viewer"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p>ไม่พบไฟล์เอกสาร</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Form + AI Suggestions */}
      <Card className="w-full md:w-[450px] lg:w-[500px] flex-shrink-0 flex flex-col overflow-hidden border-2 border-primary/10 shadow-md">
        <div className="p-4 border-b bg-muted/30 shrink-0">
          <h2 className="font-semibold text-lg">ข้อมูลที่สกัดได้</h2>
          {extractedData?.confidenceScore !== undefined && (
            <p className="text-sm text-muted-foreground mt-1">
              ความมั่นใจรวม:{' '}
              <span
                className={
                  extractedData.confidenceScore >= 0.95
                    ? 'text-green-600 font-semibold'
                    : extractedData.confidenceScore >= 0.85
                      ? 'text-yellow-600 font-semibold'
                      : 'text-red-600 font-semibold'
                }
              >
                {(extractedData.confidenceScore * 100).toFixed(1)}%
              </span>
            </p>
          )}
          {reviewReason && (
            <p className="text-sm text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-100">
              เหตุผลตรวจสอบ: {reviewReason}
            </p>
          )}
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Suggestion Fields */}
          {DISPLAY_FIELDS.map((field) => {
            const suggestion = getSuggestion(field);
            const confidence = getConfidence(field);
            const currentValue = formData[field] ?? '';

            return (
              <AiSuggestionField
                key={field}
                label={FIELD_LABELS[field] ?? field}
                value={currentValue}
                suggestion={suggestion}
                confidence={confidence}
                onAccept={() => suggestion !== undefined && onFieldUpdate(field, suggestion)}
                onReject={() => onFieldUpdate(field, '')}
                onEdit={(val) => onFieldUpdate(field, val)}
              />
            );
          })}

          {/* OCR Raw Text Viewer (toggle) */}
          {extractedText && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-blue-600 p-0 h-auto hover:bg-transparent gap-1"
                onClick={() => setShowRawText((prev) => !prev)}
              >
                <Eye className="h-4 w-4" />
                ดูข้อความดิบจาก AI
                {showRawText ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              {showRawText && (
                <Card className="mt-2">
                  <CardContent className="p-4">
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                      {extractedText}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
