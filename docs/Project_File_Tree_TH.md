# **🌳 โครงสร้างไฟล์และโฟลเดอร์ทั้งหมด \- DMS v1.3.0 Backend**

DMS\_Backend\_Project/  
├── Dockerfile  
├── docker-compose.yml  
├── nest-cli.json  
├── package.json  
├── tsconfig.json  
└── src/  
├── app.module.ts  
├── main.ts  
├── common/  
│ ├── common.module.ts  
│ ├── audit-log/  
│ │ ├── audit-log.interceptor.ts  
│ │ └── audit-log.service.ts  
│ ├── auth/  
│ │ ├── auth.controller.ts  
│ │ ├── auth.module.ts  
│ │ ├── auth.service.spec.ts  
│ │ ├── auth.service.ts  
│ │ ├── decorators/  
│ │ │ ├── current-user.decorator.ts  
│ │ │ └── require-permission.decorator.ts  
│ │ ├── dto/  
│ │ │ └── login.dto.ts  
│ │ ├── guards/  
│ │ │ ├── rbac.guard.spec.ts  
│ │ │ └── rbac.guard.ts  
│ │ └── strategies/  
│ │ └── jwt.strategy.ts  
│ ├── config/  
│ │ └── typeorm.config.ts (ตามที่ระบุใน app.module)  
│ ├── entities/  
│ │ ├── attachment.entity.ts  
│ │ ├── audit-log.entity.ts  
│ │ ├── circulation-action.entity.ts  
│ │ ├── circulation-assignee.entity.ts  
│ │ ├── circulation-attachment.entity.ts  
│ │ ├── circulation-recipient.entity.ts  
│ │ ├── circulation-status-code.entity.ts  
│ │ ├── circulation.entity.ts  
│ │ ├── contract-drawing-attachment.entity.ts  
│ │ ├── contract-drawing-category.entity.ts  
│ │ ├── contract-drawing-sub-category.entity.ts  
│ │ ├── contract-drawing-volume.entity.ts  
│ │ ├── contract-drawing.entity.ts  
│ │ ├── correspondence-attachment.entity.ts  
│ │ ├── correspondence-recipient.entity.ts  
│ │ ├── correspondence-revision.entity.ts  
│ │ ├── correspondence-status.entity.ts  
│ │ ├── correspondence-type.entity.ts  
│ │ ├── correspondence.entity.ts  
│ │ ├── document-number-counter.entity.ts  
│ │ ├── document-number-format.entity.ts  
│ │ ├── permission.entity.ts  
│ │ ├── rfa-approve-code.entity.ts  
│ │ ├── rfa-item.entity.ts  
│ │ ├── rfa-revision.entity.ts  
│ │ ├── rfa-status-code.entity.ts  
│ │ ├── rfa-type.entity.ts  
│ │ ├── rfa.entity.ts  
│ │ ├── role.entity.ts  
│ │ ├── shop-drawing-main-category.entity.ts  
│ │ ├── shop-drawing-revision-attachment.entity.ts  
│ │ ├── shop-drawing-revision-contract-ref.entity.ts  
│ │ ├── shop-drawing-revision.entity.ts  
│ │ ├── shop-drawing-sub-category.entity.ts  
│ │ ├── shop-drawing.entity.ts  
│ │ ├── tag.entity.ts  
│ │ ├── transmittal-item.entity.ts  
│ │ ├── transmittal.entity.ts  
│ │ ├── user.entity.ts  
│ │ └── views/  
│ │ ├── view-current-correspondence.entity.ts  
│ │ └── view-current-rfa.entity.ts  
│ ├── exceptions/  
│ │ └── http-exception.filter.ts  
│ ├── file-storage/  
│ │ ├── file-storage.service.ts  
│ │ └── file.controller.ts  
│ └── security/  
│ └── rate-limiter.module.ts  
└── modules/  
├── caching/  
│ └── caching.module.ts  
├── circulation/  
│ ├── circulation.controller.ts  
│ ├── circulation.module.ts  
│ ├── circulation.service.ts  
│ └── dto/  
│ ├── add-action.dto.ts  
│ ├── assignee.dto.ts  
│ ├── attachment.dto.ts  
│ ├── create-circulation.dto.ts  
│ └── recipient.dto.ts  
├── correspondence/  
│ ├── correspondence.controller.ts  
│ ├── correspondence.module.ts  
│ ├── correspondence.service.ts  
│ └── dto/  
│ ├── create-correspondence.dto.ts  
│ └── query-correspondence.dto.ts  
├── document-numbering/  
│ ├── admin-numbering.controller.ts  
│ ├── document-numbering.module.ts  
│ ├── document-numbering.service.ts  
│ └── dto/  
│ ├── admin-create-number-format.dto.ts  
│ └── admin-update-number-format.dto.ts  
├── drawing/  
│ ├── drawing.controller.ts  
│ ├── drawing.module.ts  
│ ├── drawing.service.ts  
│ └── dto/  
│ ├── attachment.dto.ts  
│ ├── create-contract-drawing.dto.ts  
│ ├── create-shop-drawing-revision.dto.ts  
│ └── create-shop-drawing.dto.ts  
├── health/  
│ ├── health.controller.ts  
│ └── health.module.ts  
├── master-data/  
│ ├── admin-master-data.controller.ts  
│ ├── master-data.module.ts  
│ ├── master-data.service.ts  
│ └── dto/  
│ └── create-tag.dto.ts  
├── notification/  
│ ├── notification.module.ts  
│ └── notification.service.ts  
├── project/  
│ └── (ยังไม่ได้สร้างไฟล์)  
├── rfa/  
│ ├── rfa.controller.ts  
│ ├── rfa.module.ts  
│ ├── rfa.service.ts  
│ └── dto/  
│ └── create-rfa.dto.ts  
├── search/  
│ ├── search.controller.ts  
│ ├── search.module.ts  
│ ├── search.service.ts  
│ └── dto/  
│ └── advanced-search.dto.ts  
├── transmittal/  
│ ├── transmittal.controller.ts  
│ ├── transmittal.module.ts  
│ ├── transmittal.service.ts  
│ └── dto/  
│ ├── create-transmittal-item.dto.ts  
│ └── create-transmittal.dto.ts  
└── user/  
├── admin-roles.controller.ts  
├── admin-users.controller.ts  
├── roles.service.ts  
├── user.module.ts  
├── user.service.ts  
└── dto/  
├── admin-assign-permissions.dto.ts  
├── admin-create-role.dto.ts  
└── admin-create-user.dto.ts