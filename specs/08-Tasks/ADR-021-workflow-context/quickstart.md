# Quickstart: ADR-021 Implementation Guide

**Phase 1 Output** | Generated: 2026-04-12 | Branch: `feat/adr-021-integrated-workflow-context`

---

## Prerequisites

- `backend/` and `frontend/` dev servers running
- MariaDB accessible
- Redis running (Redlock + Cache)
- ClamAV running (file upload pipeline)

---

## Step 1: Apply SQL Delta (🔴 CRITICAL FIRST)

```bash
# Apply delta to DB before touching any entity code
# ตรวจสอบ DB connection ก่อน

mysql -h <DB_HOST> -u <USER> -p <DB_NAME> < \
  specs/03-Data-and-Storage/deltas/04-add-workflow-history-id-to-attachments.sql
```

**Verify:**
```sql
DESCRIBE attachments;
-- ต้องเห็น workflow_history_id CHAR(36) NULL
SHOW INDEX FROM attachments;
-- ต้องเห็น idx_att_wfhist_created
```

---

## Step 2: Backend — Entity Updates (T2, T3)

### T2: `attachment.entity.ts`

เพิ่มหลัง `referenceDate` column:

```typescript
@Column({ name: 'workflow_history_id', length: 36, nullable: true })
workflowHistoryId?: string;

@ManyToOne(
  () => WorkflowHistory,
  (history: WorkflowHistory) => history.attachments,
  { nullable: true, onDelete: 'SET NULL', lazy: true }
)
@JoinColumn({ name: 'workflow_history_id' })
workflowHistory?: Promise<WorkflowHistory>;
```

เพิ่ม import:
```typescript
import { WorkflowHistory } from '../../../modules/workflow-engine/entities/workflow-history.entity';
```

### T3: `workflow-history.entity.ts`

เพิ่มหลัง `createdAt`:

```typescript
@OneToMany(
  () => Attachment,
  (attachment: Attachment) => attachment.workflowHistory,
  { lazy: true }
)
attachments?: Promise<Attachment[]>;
```

เพิ่ม import:
```typescript
import { OneToMany } from 'typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
```

---

## Step 3: Backend — DTO Update (T4)

### `workflow-transition.dto.ts`

เพิ่มใน `WorkflowTransitionDto`:

```typescript
@ApiPropertyOptional({
  description: 'รายการ publicId ของไฟล์แนบ (ต้องอัปโหลดผ่าน Two-Phase ก่อน)',
  type: [String],
})
@IsArray()
@IsUUID('all', { each: true })
@ArrayMaxSize(20)
@IsOptional()
attachmentPublicIds?: string[];
```

---

## Step 4: Backend — Guard (T5)

สร้าง `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts`:

```typescript
// Guard ตรวจสอบสิทธิ์ 4-Level RBAC ตาม ADR-021 §6
// Level 1: system.manage_all (Superadmin)
// Level 2: organization.manage_users + same org
// Level 3: Assigned handler (context.userId matches req.user.user_id)
// Level 4: Read-only → FORBIDDEN

@Injectable()
export class WorkflowTransitionGuard implements CanActivate {
  constructor(
    private readonly caslFactory: CaslAbilityFactory,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    private readonly logger = new Logger(WorkflowTransitionGuard.name)
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const instanceId = request.params['id'];
    const user = request.user;

    // Level 1: Superadmin bypass
    if (user.permissions?.includes('system.manage_all')) {
      return true;
    }

    // ดึง Instance เพื่อตรวจสอบ Context
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException('Workflow Instance', instanceId);
    }

    // Level 2: Org Admin (organization.manage_users + same org)
    const docOrgId = instance.context?.organizationId as number | undefined;
    if (
      user.permissions?.includes('organization.manage_users') &&
      docOrgId &&
      user.organizationId === docOrgId
    ) {
      return true;
    }

    // Level 3: Assigned Handler
    const assignedUserId = instance.context?.assignedUserId as number | undefined;
    if (assignedUserId && user.user_id === assignedUserId) {
      return true;
    }

    this.logger.warn(
      `Unauthorized transition attempt: User ${user.user_id} on Instance ${instanceId}`
    );
    throw new ForbiddenException({
      userMessage: 'คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้',
      recoveryAction: 'ติดต่อผู้รับผิดชอบหรือ Admin',
    });
  }
}
```

---

## Step 5: Backend — Service Extension (T6)

ใน `WorkflowEngineService.processTransition()` — เพิ่มหลัง `queryRunner.commitTransaction()`:

```typescript
// Link attachments ไปยัง history record (ถ้ามี)
if (attachmentPublicIds && attachmentPublicIds.length > 0) {
  await queryRunner.manager
    .createQueryBuilder()
    .update(Attachment)
    .set({ workflowHistoryId: history.id })
    .where('uuid IN (:...publicIds)', { publicIds: attachmentPublicIds })
    .andWhere('is_temporary = :temp', { temp: false })  // ต้องเป็น committed files เท่านั้น
    .execute();
}
```

**Signature change:**
```typescript
async processTransition(
  instanceId: string,
  action: string,
  userId: number,
  comment?: string,
  payload: Record<string, unknown> = {},
  attachmentPublicIds: string[] = []   // NEW parameter
): Promise<WorkflowTransitionResponseDto>
```

---

## Step 6: Backend — Controller Update (T7)

```typescript
// เพิ่ม Idempotency-Key header validation + guard + history endpoint

// 1. เพิ่ม Guard บน transition endpoint
@Post('instances/:id/transition')
@UseGuards(JwtAuthGuard, WorkflowTransitionGuard)
async processTransition(
  @Param('id') instanceId: string,
  @Body() dto: WorkflowTransitionDto,
  @Headers('Idempotency-Key') idempotencyKey: string,
  @Request() req: RequestWithUser
) {
  if (!idempotencyKey) {
    throw new BadRequestException({
      userMessage: 'กรุณาระบุ Idempotency-Key header',
      errorCode: 'MISSING_IDEMPOTENCY_KEY',
    });
  }

  // ตรวจสอบ Redis idempotency key
  const cached = await this.redisService.get(
    `idempotency:transition:${idempotencyKey}:${req.user.user_id}`
  );
  if (cached) {
    return JSON.parse(cached);
  }

  const result = await this.workflowService.processTransition(
    instanceId,
    dto.action,
    req.user.user_id,
    dto.comment,
    dto.payload,
    dto.attachmentPublicIds ?? []
  );

  // บันทึก idempotency key (TTL 24h)
  await this.redisService.set(
    `idempotency:transition:${idempotencyKey}:${req.user.user_id}`,
    JSON.stringify(result),
    86400
  );

  return result;
}

// 2. New history endpoint
@Get('instances/:id/history')
@RequirePermission('document.view')
async getInstanceHistory(@Param('id') instanceId: string) {
  return this.workflowService.getHistoryWithAttachments(instanceId);
}
```

---

## Step 7: Frontend — Types (F1, F2)

อัปเดต `frontend/types/workflow.ts` และ `frontend/types/dto/workflow-engine/workflow-engine.dto.ts` ตาม `data-model.md` ส่วน 5.

---

## Step 8: Frontend — `use-workflow-action` Hook (F3)

```typescript
// frontend/hooks/use-workflow-action.ts
export function useWorkflowAction(instanceId: string) {
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => generateUUIDv7()); // สร้าง 1 ครั้งต่อ action intent

  const mutation = useMutation({
    mutationFn: async (dto: WorkflowTransitionWithAttachmentsDto) => {
      return workflowEngineService.transition(instanceId, dto, idempotencyKey);
    },
    onSuccess: () => {
      // Invalidate cache สำหรับ document + history
      void queryClient.invalidateQueries({ queryKey: ['workflow-history', instanceId] });
      // Invalidate parent document queries (RFA, Correspondence, etc.)
      void queryClient.invalidateQueries({ queryKey: ['rfa'] });
      void queryClient.invalidateQueries({ queryKey: ['correspondence'] });
    },
  });

  return { execute: mutation.mutateAsync, isPending: mutation.isPending };
}
```

---

## Step 9: Frontend — Components (F4–F6)

### `IntegratedBanner` Props:
```typescript
interface IntegratedBannerProps {
  documentNo: string;
  subject: string;
  status: string;
  priority?: WorkflowPriority;
  currentState: string;
  availableActions: string[];
  onAction: (action: string, comment?: string, files?: string[]) => void;
  isLoading?: boolean;
}
```

### `WorkflowLifecycle` Props:
```typescript
interface WorkflowLifecycleProps {
  history: WorkflowHistoryItem[];
  currentState: string;
  onFileClick: (attachment: WorkflowAttachmentSummary) => void;
}
```

### `FilePreviewModal` Props:
```typescript
interface FilePreviewModalProps {
  attachment: WorkflowAttachmentSummary | null;
  onClose: () => void;
}
```

---

## Step 10: Page Refactors (F7, F8)

ตัวอย่าง RFA detail page integration:

```tsx
// frontend/app/(dashboard)/rfas/[uuid]/page.tsx
export default function RFADetailPage() {
  const { uuid } = useParams();
  const { data: rfa, isLoading } = useRFA(String(uuid));
  const [previewFile, setPreviewFile] = useState<WorkflowAttachmentSummary | null>(null);
  const { execute, isPending } = useWorkflowAction(rfa?.workflowInstanceId ?? '');

  return (
    <>
      <IntegratedBanner
        documentNo={rfa?.rfaNo ?? ''}
        subject={rfa?.subject ?? ''}
        status={rfa?.status ?? ''}
        priority={rfa?.priority}
        currentState={rfa?.workflowState ?? ''}
        availableActions={rfa?.availableActions ?? []}
        onAction={(action, comment, files) =>
          execute({ action, comment, attachmentPublicIds: files })
        }
        isLoading={isPending}
      />
      <Tabs>
        <TabsContent value="workflow">
          <WorkflowLifecycle
            history={rfa?.workflowHistory ?? []}
            currentState={rfa?.workflowState ?? ''}
            onFileClick={setPreviewFile}
          />
        </TabsContent>
      </Tabs>
      <FilePreviewModal attachment={previewFile} onClose={() => setPreviewFile(null)} />
    </>
  );
}
```

---

## Testing Checklist

```bash
# Backend unit tests
cd backend
pnpm test --testPathPattern=workflow-engine.service
pnpm test --testPathPattern=workflow-transition.guard

# Frontend component tests
cd frontend
pnpm test --run --reporter=verbose

# TypeScript check (both)
cd backend && pnpm tsc --noEmit
cd frontend && pnpm tsc --noEmit

# Lint (both)
cd backend && pnpm lint
cd frontend && pnpm lint
```

---

## Security Pre-commit Checklist

- [ ] `workflow_history_id` FK applied and verified in DB
- [ ] `attachmentPublicIds` validates UUID format + `is_temporary = false`
- [ ] `Idempotency-Key` header required — missing returns `400`
- [ ] `WorkflowTransitionGuard` blocks Level 4 users with `403`
- [ ] ClamAV test: EICAR test file blocked before transition
- [ ] No `parseInt()` on any UUID in new code
- [ ] No `console.log` in committed code
- [ ] Comments in Thai, identifiers in English
- [ ] TypeScript strict — no `any` types
