'use client';

// File: components/response-code/ResponseCodeSelector.tsx
// เลือก Response Code ตาม Category ของเอกสาร (FR-006)
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useResponseCodesByDocType } from '@/hooks/use-response-codes';
import { ResponseCode } from '@/types/review-team';

interface ResponseCodeSelectorProps {
  documentTypeId: number;
  projectId?: number;
  value?: string;
  onChange: (publicId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  '1A': 'bg-success/10 text-success',
  '1B': 'bg-success/10 text-success',
  '1C': 'bg-warning/10 text-warning',
  '1D': 'bg-caution/10 text-caution',
  '1E': 'bg-info/10 text-info',
  '1F': 'bg-info/10 text-info',
  '1G': 'bg-ai/10 text-ai',
  '2': 'bg-warning/10 text-warning',
  '3': 'bg-destructive/10 text-destructive',
  '4': 'bg-muted text-muted-foreground',
};

function CodeBadge({ code }: { code: string }) {
  const colorClass = SEVERITY_COLORS[code] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${colorClass}`}>{code}</span>
  );
}

export function ResponseCodeSelector({
  documentTypeId,
  projectId,
  value,
  onChange,
  disabled,
  placeholder = 'Select Response Code...',
}: ResponseCodeSelectorProps) {
  const { data: codes = [], isLoading } = useResponseCodesByDocType(documentTypeId, projectId);

  // กลุ่ม codes ตาม category
  const grouped = (codes as ResponseCode[]).reduce<Record<string, ResponseCode[]>>((acc, code) => {
    const cat = code.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(code);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? 'Loading codes...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {categories.length === 0 && !isLoading && (
          <div className="p-3 text-sm text-muted-foreground">No codes available</div>
        )}
        {categories.map((cat) => (
          <SelectGroup key={cat}>
            <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">{cat}</SelectLabel>
            {grouped[cat].map((code) => (
              <SelectItem key={code.publicId} value={code.publicId}>
                <div className="flex items-center gap-2">
                  <CodeBadge code={code.code} />
                  <span className="text-sm">{code.descriptionEn}</span>
                  {(code.implications?.affectsCost || code.implications?.requiresContractReview) && (
                    <span className="text-xs font-medium text-caution">⚠ Action Required</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
