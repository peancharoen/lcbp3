// File: components/ai/ai-suggestion-field.tsx
// Component แสดง AI Suggestion พร้อม Accept / Reject / Edit actions (ADR-018, ADR-020)

import { useState } from 'react';
import { Check, X, Edit2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// สีตาม confidence score (>= 0.95 สีเขียว, >= 0.85 สีเหลือง, < 0.85 สีแดง)
const getConfidenceClass = (confidence: number): string => {
  if (confidence >= 0.95) return 'text-green-700 bg-green-50 border-green-400';
  if (confidence >= 0.85) return 'text-yellow-700 bg-yellow-50 border-yellow-400';
  return 'text-red-700 bg-red-50 border-red-400';
};

export interface AiSuggestionFieldProps {
  label: string;
  value: string;
  suggestion?: string;
  confidence?: number;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (newValue: string) => void;
  className?: string;
}

export function AiSuggestionField({
  label,
  value,
  suggestion,
  confidence,
  onAccept,
  onReject,
  onEdit,
  className,
}: AiSuggestionFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // มีค่าจาก AI หรือไม่
  const hasSuggestion = suggestion !== undefined && suggestion !== '';
  // ค่าปัจจุบันตรงกับที่ AI แนะนำ
  const isAiValue = hasSuggestion && value === suggestion;

  const handleSave = () => {
    onEdit(editValue);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  return (
    <div className={cn('space-y-1', className)}>
      {/* Label พร้อม Confidence Badge */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">{label}</label>
        {hasSuggestion && confidence !== undefined && (
          <Badge
            variant="outline"
            className={cn('text-xs gap-1 px-1.5 py-0', getConfidenceClass(confidence))}
          >
            <Sparkles className="h-3 w-3" />
            AI {Math.round(confidence * 100)}%
          </Badge>
        )}
      </div>

      {/* Field Content — highlight สีเหลืองเมื่อใช้ค่าจาก AI */}
      <div
        className={cn(
          'rounded border px-3 py-2 text-sm min-h-[2.25rem]',
          isAiValue && 'bg-yellow-50 border-l-4 border-yellow-400'
        )}
      >
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={handleSave} className="h-7 px-2">
              <Check className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(false)}
              className="h-7 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span>
              {value !== '' ? value : <span className="text-muted-foreground italic">—</span>}
            </span>
            {hasSuggestion && (
              <div className="flex gap-1 shrink-0">
                {/* ปุ่ม "รับ" จะแสดงเมื่อค่าปัจจุบันยังไม่ใช่ค่า AI */}
                {!isAiValue && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAccept}
                    className="h-6 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                    title={`รับค่าจาก AI: ${suggestion}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    รับ
                  </Button>
                )}
                {/* ปุ่ม "ปฏิเสธ" จะแสดงเมื่อใช้ค่า AI อยู่ */}
                {isAiValue && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onReject}
                    className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                    title="ปฏิเสธค่า AI"
                  >
                    <X className="h-3 w-3 mr-1" />
                    ปฏิเสธ
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleStartEdit}
                  className="h-6 w-6 p-0"
                  title="แก้ไขค่า"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* แสดง AI Suggestion hint เมื่อค่าปัจจุบันต่างจาก AI */}
      {hasSuggestion && !isAiValue && (
        <p className="text-xs text-muted-foreground pl-1">
          AI แนะนำ:{' '}
          <button
            type="button"
            className="font-medium text-yellow-700 hover:underline"
            onClick={onAccept}
          >
            {suggestion}
          </button>
        </p>
      )}
    </div>
  );
}
