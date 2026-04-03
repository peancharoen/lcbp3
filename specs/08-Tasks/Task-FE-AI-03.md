# Task FE-AI-03: Frontend Human-in-the-Loop Interface

**Phase:** Step 3 - AI Verification & User Experience (Next.js)
**ADR Compliance:** ADR-018 (AI Boundary), ADR-019 (UUID Strategy)
**Priority:** 🔴 Critical - Human validation layer for AI outputs

> **Context:** เป็นส่วนสำคัญที่สุดในการเปลี่ยนข้อมูลที่ AI สกัดได้ให้เป็นข้อมูลที่มีคุณภาพ (Verified Data) ตามกฎ ADR-018 โดยเน้นการสร้าง UI ที่ใช้งานง่ายสำหรับทั้ง Admin (เอกสารเก่า) และ User (เอกสารใหม่)

---

## 🖥️ Implementation Tasks

### **AI-3.1: Reusable AI Review Components**
- [ ] **AiSuggestionField Component:**
  ```typescript
  // components/ai/ai-suggestion-field.tsx
  interface AiSuggestionFieldProps {
    value: string;
    suggestion?: string;
    confidence?: number;
    onAccept: () => void;
    onReject: () => void;
    onEdit: (newValue: string) => void;
  }
  ```
  Features:
  - AI icon with confidence badge (✨ 95%)
  - Yellow highlight for AI-suggested values
  - Accept/Reject/Edit actions
  - Tooltip showing raw AI extraction

- [ ] **DocumentComparisonView Component:**
  ```typescript
  // components/ai/document-comparison-view.tsx
  interface DocumentComparisonViewProps {
    fileUrl: string;
    extractedData: ExtractionResult;
    formData: FormData;
    onFieldUpdate: (field: string, value: string) => void;
  }
  ```
  Features:
  - PDF viewer sidebar (react-pdf)
  - Form fields with AI suggestions
  - Side-by-side comparison layout
  - Real-time validation feedback

- [ ] **Client-side Validation Integration:**
  ```typescript
  // Validation schema with confidence thresholds
  const documentSchema = z.object({
    subject: z.string().min(1, "จำเป็นต้องระบุชื่อเรื่อง"),
    documentDate: z.string().refine(validateThaiDate),
    discipline: z.enum(['Civil', 'Mechanical', 'Electrical', 'Architectural'])
  });

  // React Hook Form integration
  const form = useForm({
    resolver: zodResolver(documentSchema),
    mode: 'onChange',
    defaultValues: aiSuggestions
  });
  ```

### **AI-3.2: Legacy Migration Dashboard (Admin Interface)**
- [ ] **Migration List Page:**
  ```typescript
  // app/(admin)/admin/migration/page.tsx
  interface MigrationListProps {
    status?: MigrationStatus;
    confidenceRange?: [number, number];
    dateRange?: [Date, Date];
  }
  ```
  Features:
  - Paginated table with sorting/filtering
  - Status badges (Pending/Verified/Failed)
  - Confidence score heat map (red/yellow/green)
  - Bulk selection for actions

- [ ] **Filter System:**
  ```typescript
  // Filter components
  const StatusFilter = () => (
    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
      <SelectItem value="PENDING_REVIEW">รอตรวจสอบ</SelectItem>
      <SelectItem value="VERIFIED">ผ่านการตรวจสอบ</SelectItem>
      <SelectItem value="FAILED">ล้มเหลว</SelectItem>
    </Select>
  );

  const ConfidenceFilter = () => (
    <Slider
      min={0}
      max={100}
      value={confidenceRange}
      onValueChange={setConfidenceRange}
      marks={[{value: 60, label: 'ต่ำ'}, {value: 85, label: 'ปานกลาง'}, {value: 95, label: 'สูง'}]}
    />
  );
  ```

- [ ] **Bulk Actions Implementation:**
  ```typescript
  // Bulk verification for high-confidence items
  const handleBulkVerify = async (selectedIds: string[]) => {
    const confirmed = await confirm({
      title: "ยืนยันการนำเข้าข้อมูล",
      description: `จะยืนยันนำเข้าเอกสาร ${selectedIds.length} รายการที่มีความมั่นใจ >95% หรือไม่?`
    });

    if (confirmed) {
      await Promise.all(
        selectedIds.map(publicId =>
          api.migration.update(publicId, { status: 'VERIFIED' })
        )
      );
    }
  };
  ```

- [ ] **Error Logging UI:**
  - Error details modal for failed extractions
  - OCR error screenshots
  - AI response raw text viewer
  - Retry mechanism with different parameters

### **AI-3.3: Real-time Ingestion Integration (User Interface)**
- [ ] **RFA Creation Flow Enhancement:**
  ```typescript
  // app/(dashboard)/rfas/create/page.tsx
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ExtractionResult | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      // 1. Upload file to temporary storage
      const uploadResult = await api.storage.uploadTemp(file);

      // 2. Trigger AI extraction
      const extraction = await api.ai.extract({
        publicId: uploadResult.publicId,
        context: 'ingestion'
      });

      // 3. Apply suggestions to form
      setAiSuggestions(extraction);
      form.reset(extraction.suggestions);
    } finally {
      setIsProcessing(false);
    }
  };
  ```

- [ ] **Processing State UI:**
  ```typescript
  // Loading component during AI processing
  const AiProcessingIndicator = () => (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="flex items-center space-x-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
        <div>
          <p className="font-medium text-yellow-800">AI กำลังวิเคราะห์เอกสาร...</p>
          <p className="text-sm text-yellow-600">กรุณารอสักครู่ (ประมาณ 15-30 วินาที)</p>
        </div>
      </CardContent>
    </Card>
  );
  ```

- [ ] **Auto-fill with User Override:**
  ```typescript
  // Form field with AI suggestion
  const FormFieldWithAi = ({ name, label }: { name: string; label: string }) => {
    const { control, watch } = useFormContext();
    const value = watch(name);
    const suggestion = aiSuggestions?.suggestions[name];
    const confidence = aiSuggestions?.confidence[name];

    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              {label}
              {suggestion && confidence && (
                <Badge variant="secondary" className="text-xs">
                  ✨ AI {Math.round(confidence * 100)}%
                </Badge>
              )}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                className={suggestion && value === suggestion ? 'bg-yellow-50' : ''}
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  };
  ```

- [ ] **Raw Text Comparison Toggle:**
  ```typescript
  // Collapsible panel showing OCR text
  const OcrTextViewer = ({ extractedText }: { extractedText: string }) => (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-blue-600">
          <Eye className="h-4 w-4 mr-2" />
          ดูข้อความดิบจาก AI
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="p-4">
            <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto max-h-48">
              {extractedText}
            </pre>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
  ```

### **AI-3.4: Human-AI Feedback Loop Implementation**
- [ ] **Feedback Collection System:**
  ```typescript
  // Track user corrections for AI improvement
  const trackUserCorrection = async (
    field: string,
    aiSuggestion: string,
    userCorrection: string,
    documentPublicId: string
  ) => {
    await api.ai.feedback.create({
      documentPublicId,
      field,
      aiSuggestion,
      userCorrection,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  };
  ```

- [ ] **Accuracy Analytics Dashboard:**
  ```typescript
  // Admin dashboard for AI performance
  const AiPerformanceDashboard = () => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>();

    useEffect(() => {
      const loadMetrics = async () => {
        const data = await api.ai.analytics.getPerformance();
        setMetrics(data);
      };
      loadMetrics();
    }, []);

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ความแม่นยำโดยรวม</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.overallAccuracy}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">อัตราการแก้ไขโดยผู้ใช้</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.userCorrectionRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">เวลาประมวลผลเฉลี่ย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {metrics?.avgProcessingTime}s
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  ```

- [ ] **Feedback Data Structure:**
  ```typescript
  // Types for feedback collection
  interface AiFeedbackDto {
    documentPublicId: string;
    field: string;
    aiSuggestion: string;
    userCorrection: string;
    confidence: number;
    timestamp: string;
    userAgent: string;
  }

  interface PerformanceMetrics {
    overallAccuracy: number;
    userCorrectionRate: number;
    avgProcessingTime: number;
    fieldAccuracy: Record<string, number>;
    modelPerformance: Record<string, number>;
  }
  ```

---

## 🎨 UX/UI Design Guidelines

### Design Principles
- **Trust through Transparency:** Always show AI confidence and sources
- **Human Control First:** User can override any AI suggestion
- **Progressive Disclosure:** Hide complexity, show details on demand
- **Thai Language First:** All UI text in Thai, engineering terms in context

### Visual Indicators
```typescript
// Confidence score color coding
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.95) return 'text-green-600 bg-green-50';
  if (confidence >= 0.85) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

// AI suggestion highlighting
const aiSuggestionStyles = {
  backgroundColor: '#fef3c7', // yellow-50
  borderLeft: '3px solid #f59e0b', // yellow-500
  padding: '0.5rem'
};
```

---

## 🔴 Critical Rules (Non-Negotiable)

1. **ADR-019 UUID Strategy:**
   - All API calls use `publicId` (string) only
   - NEVER use integer IDs or fallback patterns
   - Type safety: `publicId?: string` in interfaces

2. **ADR-018 AI Boundary:**
   - Frontend communicates with DMS API only
   - NO direct calls to n8n, Ollama, or PaddleOCR
   - AI processing via `/api/ai/extract` endpoint only

3. **Thai Language Standards:**
   - All UI text in Thai (i18n keys)
   - Code comments in Thai
   - Engineering terms preserved in original language

4. **Security Requirements:**
   - File uploads through StorageService only
   - Proper error handling without exposing system details
   - Rate limiting on AI endpoints

5. **Data Integrity:**
   - All AI suggestions require explicit user confirmation
   - Audit trail for all user corrections
   - Validation before form submission

---

## 📁 Related Specifications

- **ADR-018:** AI Boundary Policy - Security requirements
- **ADR-019:** Hybrid Identifier Strategy - UUID usage patterns
- **ADR-020:** AI Intelligence Integration - Architecture overview
- **05-03-frontend-guidelines.md:** Next.js patterns and conventions
- **05-08-i18n-guidelines.md:** Thai language implementation

---

## 📝 Component Library Usage

### Shadcn/UI Components
```typescript
// Required components for AI features
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Select,
  Slider,
  Collapsible,
  Dialog,
  Table,
  Pagination
} from '@/components/ui';

// Custom AI components
import { AiSuggestionField } from '@/components/ai/ai-suggestion-field';
import { DocumentComparisonView } from '@/components/ai/document-comparison-view';
import { AiProcessingIndicator } from '@/components/ai/processing-indicator';
```

### Tailwind CSS Classes
```css
/* AI-specific utility classes */
.ai-suggestion {
  @apply bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded;
}

.ai-high-confidence {
  @apply text-green-600 bg-green-50 border-green-500;
}

.ai-medium-confidence {
  @apply text-yellow-600 bg-yellow-50 border-yellow-500;
}

.ai-low-confidence {
  @apply text-red-600 bg-red-50 border-red-500;
}
```

