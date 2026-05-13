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
  '1A': 'bg-green-100 text-green-800',
  '1B': 'bg-emerald-100 text-emerald-800',
  '1C': 'bg-yellow-100 text-yellow-800',
  '1D': 'bg-orange-100 text-orange-800',
  '1E': 'bg-blue-100 text-blue-800',
  '1F': 'bg-sky-100 text-sky-800',
  '1G': 'bg-purple-100 text-purple-800',
  '2': 'bg-amber-100 text-amber-800',
  '3': 'bg-red-100 text-red-800',
  '4': 'bg-gray-100 text-gray-600',
};

function CodeBadge({ code }: { code: string }) {
  const colorClass = SEVERITY_COLORS[code] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${colorClass}`}>
      {code}
    </span>
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
  const grouped = (codes as ResponseCode[]).reduce<Record<string, ResponseCode[]>>(
    (acc, code) => {
      const cat = code.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(code);
      return acc;
    },
    {},
  );

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
            <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wide">
              {cat}
            </SelectLabel>
            {grouped[cat].map((code) => (
              <SelectItem key={code.publicId} value={code.publicId}>
                <div className="flex items-center gap-2">
                  <CodeBadge code={code.code} />
                  <span className="text-sm">{code.descriptionEn}</span>
                  {(code.implications?.affectsCost || code.implications?.requiresContractReview) && (
                    <span className="text-xs text-orange-600 font-medium">⚠ Action Required</span>
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
