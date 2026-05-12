# Quickstart Guide: RFA Approval System Refactor

**Branch**: `1-rfa-approval-refactor`  
**Prerequisites**: Docker Compose environment running (MariaDB, Redis)

---

## 1. Environment Setup

### 1.1 Database Schema

```bash
# Apply new SQL schema (ADR-009: no TypeORM migrations)
# File will be created in specs/03-Data-and-Storage/
mysql -u root -p lcbp3 < specs/03-Data-and-Storage/lcbp3-v1.9.0-rfa-approval-schema.sql
```

### 1.2 Seed Master Data

```bash
# Run seeder for Response Codes and default rules
cd backend
npx ts-node -r tsconfig-paths/register src/modules/response-code/seeders/response-code.seed.ts
```

**Expected Output**:
```
Seeding Response Codes...
✓ 1A-1G Engineering codes created
✓ 1A-1G Material codes created
✓ 1A-1G Contract codes created
✓ 1A-1G Testing codes created
✓ 1A-1G ESG codes created
✓ Codes 2, 3, 4 created (all categories)
✓ Default rules applied for all document types
Done! 55 response codes created.
```

---

## 2. Backend Setup

### 2.1 Install Dependencies

```bash
cd backend
npm install
```

### 2.2 Environment Variables

Add to `.env`:
```env
# Redis (for BullMQ and Redlock)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# BullMQ Queues
BULLMQ_QUEUE_PREFIX=rfa
BULLMQ_REMINDER_QUEUE=rfa-reminders
BULLMQ_DISTRIBUTION_QUEUE=rfa-distribution

# Reminder Schedule
REMINDER_DAYS_BEFORE_DUE=2
ESCALATION_DAYS_AFTER_DUE_L1=1
ESCALATION_DAYS_AFTER_DUE_L2=3
```

### 2.3 Start Development Server

```bash
npm run start:dev
```

Verify modules loaded:
```
[Nest] 1234  - 01/01/2024, 09:00:00 AM     LOG [ReviewTeamModule] Module initialized
[Nest] 1234  - 01/01/2024, 09:00:00 AM     LOG [ResponseCodeModule] Module initialized
[Nest] 1234  - 01/01/2024, 09:00:00 AM     LOG [DelegationModule] Module initialized
[Nest] 1234  - 01/01/2024, 09:00:00 AM     LOG [ReminderModule] Module initialized
[Nest] 1234  - 01/01/2024, 09:00:00 AM     LOG [DistributionModule] Module initialized
```

### 2.4 Start Queue Workers

```bash
# Terminal 2 - Reminder processor
npx ts-node -r tsconfig-paths/register src/modules/reminder/processors/reminder.processor.ts

# Terminal 3 - Distribution processor  
npx ts-node -r tsconfig-paths/register src/modules/distribution/processors/distribution.processor.ts
```

---

## 3. Frontend Setup

### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

### 3.2 Start Development Server

```bash
npm run dev
```

### 3.3 Access URLs

- **RFA Review Page**: http://localhost:3000/dashboard/rfa/{id}/review
- **Review Teams Admin**: http://localhost:3000/dashboard/review-teams
- **Response Codes Admin**: http://localhost:3000/dashboard/response-codes
- **Delegation Settings**: http://localhost:3000/dashboard/delegation

---

## 4. First Time Setup

### 4.1 Create Review Team

```bash
# Using API
curl -X POST http://localhost:3001/api/v1/review-teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Structural Review Team",
    "description": "Team for structural drawings review",
    "projectId": "019505a1-7c3e-7000-8000-abc123def456",
    "defaultForRfaTypes": ["SDW", "DDW"]
  }'
```

### 4.2 Add Team Members

```bash
curl -X POST http://localhost:3001/api/v1/review-teams/{teamId}/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "019505a1-7c3e-7000-8000-abc123def789",
    "disciplineId": 1,
    "role": "LEAD"
  }'
```

### 4.3 Setup Reminder Rules

```bash
curl -X POST http://localhost:3001/api/v1/reminder-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "RFA Due Soon Reminder",
    "triggerDaysBeforeDue": 2,
    "reminderType": "DUE_SOON",
    "recipients": ["ASSIGNEE", "MANAGER"],
    "messageTemplateTh": "RFA #{docNumber} ใกล้ครบกำหนดในอีก {days} วัน",
    "messageTemplateEn": "RFA #{docNumber} is due in {days} days"
  }'
```

### 4.4 Setup Distribution Matrix

```bash
curl -X POST http://localhost:3001/api/v1/distribution-matrices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Shop Drawing Distribution",
    "documentTypeId": 1,
    "conditions": {
      "codes": ["1A", "1B", "2"]
    },
    "recipients": [
      { "recipientType": "ROLE", "recipientId": "SITE_TEAM", "deliveryMethod": "BOTH" },
      { "recipientType": "ROLE", "recipientId": "QS_TEAM", "deliveryMethod": "EMAIL" }
    ]
  }'
```

---

## 5. Test Workflow

### 5.1 Submit RFA with Review Team

```bash
# Submit RFA - triggers workflow and creates review tasks
curl -X POST http://localhost:3001/api/v1/rfa/{uuid}/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "templateId": 1,
    "reviewTeamId": "019505a1-7c3e-7000-8000-abc123def456"
  }'
```

### 5.2 Check Review Tasks Created

```bash
# As reviewer, check inbox
curl http://localhost:3001/api/v1/review-tasks \
  -H "Authorization: Bearer $REVIEWER_TOKEN"
```

### 5.3 Complete Review with Response Code

```bash
curl -X POST http://localhost:3001/api/v1/review-tasks/{taskId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -d '{
    "responseCodeId": "019505a1-7c3e-7000-8000-abc123def111",
    "comments": "Approved with minor comments on detail A3"
  }'
```

---

## 6. Verification Checklist

- [ ] Review Team created and visible in admin
- [ ] Review Team members assigned by discipline
- [ ] RFA submission creates parallel review tasks
- [ ] Response codes filtered by document category
- [ ] Code 3 triggers veto and returns workflow
- [ ] Reminders scheduled on due date
- [ ] Distribution executes after approval
- [ ] Delegation forwards tasks correctly
- [ ] Aggregate status shows real-time progress

---

## 7. Troubleshooting

### Queue Jobs Not Processing

```bash
# Check BullMQ board (if enabled)
open http://localhost:3001/admin/queues

# Or check Redis
redis-cli KEYS "bull*"
redis-cli LRANGE "bull:rfa-reminders:waiting" 0 -1
```

### Parallel Review Not Working

Check workflow-engine DSL configuration:
```bash
# Verify parallel gateway enabled
curl http://localhost:3001/api/v1/workflow-definitions/RFA_APPROVAL \
  -H "Authorization: Bearer $TOKEN"
```

### Response Codes Not Loading

```bash
# Verify seed data
mysql -u root -p lcbp3 -e "SELECT COUNT(*) FROM response_codes;"
# Expected: 55 rows minimum
```

---

## 8. Next Steps

1. **Run Tests**: `npm test` (backend), `npm run test:e2e` (frontend)
2. **Load Test**: `k6 run load-tests/rfa-approval-load.js`
3. **Deploy**: Follow `specs/04-Infrastructure-OPS/04-08-release-management-policy.md`
