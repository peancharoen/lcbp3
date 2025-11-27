```
└── 📁backend
    ├── 📁scripts                                     # Script files
    │   ├── debug-db.ts                               # Debug database script
    │   └──  verify-workflow.ts                       # Verify workflow script
    ├── 📁src                                         # Source files
    │   ├── 📁common                                  # Common files
    │   │   ├── 📁auth                                # Authentication files
    │   │   │   ├── 📁dto                               # Data transfer objects
    │   │   │   │   ├── login.dto.ts                    # Login data transfer object
    │   │   │   │   └──  register.dto.ts                # Register data transfer object
    │   │   │   ├── 📁strategies                        # Authentication strategies
    │   │   │   │   ├── jwt-refresh.strategy.ts         # JWT refresh strategy
    │   │   │   │   └──  jwt.strategy.ts                # JWT strategy
    │   │   │   ├── auth.controller.spec.ts             # Authentication controller spec
    │   │   │   ├── auth.controller.ts                  # Authentication controller
    │   │   │   ├── auth.module.ts                      # Authentication module
    │   │   │   ├── auth.service.spec.ts                # Authentication service spec
    │   │   │   └── auth.service.ts                     # Authentication service
    │   │   ├── 📁config                                # Configuration files
    │   │   │   ├── env.validation.ts                   # Environment validation
    │   │   │   └──  redis.config.ts                    # Redis configuration
    │   │   ├── 📁decorators                            # Decorators files
    │   │   │   ├── audit.decorator.ts                    # Audit decorator
    │   │   │   ├── bypass-maintenance.decorator.ts     # Bypass maintenance decorator
    │   │   │   ├── circuit-breaker.decorator.ts        # Circuit breaker decorator
    │   │   │   ├── current-user.decorator.ts           # Current user decorator
    │   │   │   ├── idempotency.decorator.ts            # Idempotency decorator
    │   │   │   ├── require-permission.decorator.ts    # Require permission decorator
    │   │   │   └── retry.decorator.ts                  # Retry decorator
    │   │   ├── 📁entities                              # Entities files
    │   │   │   ├── audit-log.entity.ts                 # Audit log entity
    │   │   │   └──  base.entity.ts                     # Base entity
    │   │   ├── 📁exceptions                            # Exceptions files
    │   │   │   └──  http-exception.filter.ts            # HTTP exception filter
    │   │   ├── 📁file-storage                          # File storage files
    │   │   │   ├── 📁entities                          # Entities files
    │   │   │   │   └──  attachment.entity.ts            # Attachment entity
    │   │   │   ├── file-cleanup.service.ts             # File cleanup service
    │   │   │   ├── file-storage.controller.spec.ts     # File storage controller spec
    │   │   │   ├── file-storage.controller.ts          # File storage controller
    │   │   │   ├── file-storage.module.ts              # File storage module
    │   │   │   ├── file-storage.service.spec.ts        # File storage service spec
    │   │   │   └──  file-storage.service.ts             # File storage service
    │   │   ├── 📁guards                                # Guards files
    │   │   │   ├── jwt-auth.guard.ts                   # JWT authentication guard
    │   │   │   ├── jwt-refresh.guard.ts                # JWT refresh guard
    │   │   │   ├── maintenance-mode.guard.ts           # Maintenance mode guard
    │   │   │   └──  rbac.guard.ts                       # Role-based access control guard
    │   │   ├── 📁idempotency                           # Idempotency files
    │   │   │   ├── idempotency.interceptor.ts            # Idempotency interceptor
    │   │   │   └── performance.interceptor.ts          # Performance interceptor
    │   │   ├── 📁interceptors                            # Interceptors files
    │   │   │   ├── audit-log.interceptor.ts              # Audit log interceptor
    │   │   │   ├── idempotency.interceptor.ts            # Idempotency interceptor
    │   │   │   ├── performance.interceptor.ts          # Performance interceptor
    │   │   │   └── transform.interceptor.ts              # Transform interceptor
    │   │   ├── 📁maintenance                             # Maintenance files
    │   │   ├── 📁resilience                              # Resilience files
    │   │   │   └──  resilience.module.ts                 # Resilience module
    │   │   ├── 📁security                                # Security files
    │   │   ├── 📁services                                # Services files
    │   │   │   ├── crypto.service.ts                     # Crypto service
    │   │   │   └── request-context.service.ts            # Request context service
    │   │   └── common.module.ts                          # Common module
    │   ├── 📁database                                    # Database files
    │   │   ├── 📁migrations                              # Migrations files
    │   │   ├── 📁seeds                                   # Seeds files
    │   │   │   └── workflow-definitions.seed.ts          # Workflow definitions seed
    │   ├── 📁modules                                     # Modules files
    │   │   ├── 📁circulation                             # Circulation files
    │   │   │   ├── 📁dto                                   # DTO files
    │   │   │   │   ├── create-circulation.dto.ts           # Create circulation DTO
    │   │   │   │   ├── search-circulation.dto.ts           # Search circulation DTO
    │   │   │   │   └── update-circulation-routing.dto.ts   # Update circulation routing DTO
    │   │   │   ├── 📁entities                              # Entities files
    │   │   │   │   ├── circulation-routing.entity.ts       # Circulation routing entity
    │   │   │   │   ├── circulation-status-code.entity.ts   # Circulation status code entity
    │   │   │   │   └── circulation.entity.ts               # Circulation entity
    │   │   │   ├── circulation.controller.ts                 # Circulation controller
    │   │   │   ├── circulation.module.ts                    # Circulation module
    │   │   │   └── circulation.service.ts                    # Circulation service
    │   │   ├── 📁correspondence                            # Correspondence files  
    │   │   │   ├── 📁dto
    │   │   │   │   ├── add-reference.dto.ts
    │   │   │   │   ├── create-correspondence.dto.ts
    │   │   │   │   ├── search-correspondence.dto.ts
    │   │   │   │   ├── submit-correspondence.dto.ts
    │   │   │   │   └── workflow-action.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── correspondence-reference.entity.ts
    │   │   │   │   ├── correspondence-revision.entity.ts
    │   │   │   │   ├── correspondence-routing.entity.ts
    │   │   │   │   ├── correspondence-status.entity.ts
    │   │   │   │   ├── correspondence-sub-type.entity.ts
    │   │   │   │   ├── correspondence-type.entity.ts
    │   │   │   │   ├── correspondence.entity.ts
    │   │   │   │   ├── routing-template-step.entity.ts
    │   │   │   │   └── routing-template.entity.ts
    │   │   │   ├── correspondence.controller.spec.ts
    │   │   │   ├── correspondence.controller.ts
    │   │   │   ├── correspondence.module.ts
    │   │   │   ├── correspondence.service.spec.ts
    │   │   │   └── correspondence.service.ts
    │   │   ├── 📁document-numbering
    │   │   │   ├── 📁entities
    │   │   │   │   ├── document-number-counter.entity.ts
    │   │   │   │   └── document-number-format.entity.ts
    │   │   │   ├── 📁interfaces
    │   │   │   │   └── document-numbering.interface.ts
    │   │   │   ├── document-numbering.module.ts
    │   │   │   ├── document-numbering.service.spec.ts
    │   │   │   └── document-numbering.service.ts
    │   │   ├── 📁drawing
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-contract-drawing.dto.ts
    │   │   │   │   ├── create-shop-drawing-revision.dto.ts
    │   │   │   │   ├── create-shop-drawing.dto.ts
    │   │   │   │   ├── search-contract-drawing.dto.ts
    │   │   │   │   ├── search-shop-drawing.dto.ts
    │   │   │   │   └── update-contract-drawing.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── contract-drawing-sub-category.entity.ts
    │   │   │   │   ├── contract-drawing-volume.entity.ts
    │   │   │   │   ├── contract-drawing.entity.ts
    │   │   │   │   ├── shop-drawing-main-category.entity.ts
    │   │   │   │   ├── shop-drawing-revision.entity.ts
    │   │   │   │   ├── shop-drawing-sub-category.entity.ts
    │   │   │   │   └── shop-drawing.entity.ts
    │   │   │   ├── contract-drawing.controller.ts
    │   │   │   ├── contract-drawing.service.ts
    │   │   │   ├── drawing-master-data.controller.ts
    │   │   │   ├── drawing-master-data.service.ts
    │   │   │   ├── drawing.module.ts
    │   │   │   ├── shop-drawing.controller.ts
    │   │   │   └── shop-drawing.service.ts
    │   │   ├── 📁json-schema
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-json-schema.dto.ts
    │   │   │   │   ├── search-json-schema.dto.ts
    │   │   │   │   └── update-json-schema.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   └── json-schema.entity.ts 
    │   │   │   ├── json-schema.controller.spec.ts
    │   │   │   ├── json-schema.controller.ts
    │   │   │   ├── json-schema.module.ts
    │   │   │   ├── json-schema.service.spec.ts
    │   │   │   └── json-schema.service.ts
    │   │   ├── 📁master
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-discipline.dto.ts
    │   │   │   │   ├── create-sub-type.dto.ts
    │   │   │   │   ├── create-tag.dto.ts
    │   │   │   │   ├── save-number-format.dto.ts
    │   │   │   │   ├── search-tag.dto.ts
    │   │   │   │   └── update-tag.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── discipline.entity.ts
    │   │   │   │   └── tag.entity.ts
    │   │   │   ├── master.controller.ts
    │   │   │   ├── master.module.ts
    │   │   │   └── master.service.ts
    │   │   ├── 📁monitoring
    │   │   │   ├── 📁controllers
    │   │   │   │   └── health.controller.ts
    │   │   │   ├── 📁dto
    │   │   │   │   └── set-maintenance.dto.ts
    │   │   │   ├── 📁logger
    │   │   │   │   └── winston.config.ts
    │   │   │   ├── 📁services
    │   │   │   │   └── metrics.service.ts
    │   │   │   ├── monitoring.controller.ts
    │   │   │   ├── monitoring.module.ts
    │   │   │   └── monitoring.service.ts
    │   │   ├── 📁notification
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-notification.dto.ts
    │   │   │   │   └── search-notification.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   └── notification.entity.ts
    │   │   │   ├── notification-cleanup.service.ts
    │   │   │   ├── notification.controller.ts
    │   │   │   ├── notification.gateway.ts
    │   │   │   ├── notification.module.ts
    │   │   │   ├── notification.processor.ts
    │   │   │   └── notification.service.ts
    │   │   ├── 📁project
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-project.dto.ts
    │   │   │   │   ├── search-project.dto.ts
    │   │   │   │   └── update-project.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── contract-organization.entity.ts
    │   │   │   │   ├── contract.entity.ts
    │   │   │   │   ├── organization.entity.ts
    │   │   │   │   ├── project-organization.entity.ts
    │   │   │   │   └── project.entity.ts
    │   │   │   ├── project.controller.spec.ts
    │   │   │   ├── project.controller.ts
    │   │   │   ├── project.module.ts
    │   │   │   ├── project.service.spec.ts
    │   │   │   └── project.service.ts
    │   │   ├── 📁rfa
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-rfa.dto.ts
    │   │   │   │   ├── search-rfa.dto.ts
    │   │   │   │   └── update-rfa.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── rfa-approve-code.entity.ts
    │   │   │   │   ├── rfa-item.entity.ts
    │   │   │   │   ├── rfa-revision.entity.ts
    │   │   │   │   ├── rfa-status-code.entity.ts
    │   │   │   │   ├── rfa-type.entity.ts
    │   │   │   │   ├── rfa-workflow-template-step.entity.ts
    │   │   │   │   ├── rfa-workflow-template.entity.ts
    │   │   │   │   ├── rfa-workflow.entity.ts
    │   │   │   │   └── rfa.entity.ts
    │   │   │   ├── rfa.controller.ts
    │   │   │   ├── rfa.module.ts
    │   │   │   └── rfa.service.ts
    │   │   ├── 📁search
    │   │   │   ├── 📁dto
    │   │   │   │   └── search-query.dto.ts
    │   │   │   ├── search.controller.ts
    │   │   │   ├── search.module.ts
    │   │   │   └── search.service.ts
    │   │   ├── 📁transmittal
    │   │   │   ├── 📁dto
    │   │   │   │   ├── create-transmittal.dto.ts
    │   │   │   │   ├── search-transmittal.dto.ts
    │   │   │   │   └── update-transmittal.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── transmittal-item.entity.ts
    │   │   │   │   └── transmittal.entity.ts
    │   │   │   ├── transmittal.controller.ts
    │   │   │   ├── transmittal.module.ts
    │   │   │   └── transmittal.service.ts
    │   │   ├── 📁user
    │   │   │   ├── 📁dto
    │   │   │   │   ├── assign-role.dto.ts
    │   │   │   │   ├── create-user.dto.ts
    │   │   │   │   ├── update-preference.dto.ts
    │   │   │   │   └── update-user.dto.ts
    │   │   │   ├── 📁entities
    │   │   │   │   ├── permission.entity.ts
    │   │   │   │   ├── role.entity.ts
    │   │   │   │   ├── user-assignment.entity.ts
    │   │   │   │   ├── user-preference.entity.ts
    │   │   │   │   └── user.entity.ts
    │   │   │   ├── user-assignment.service.ts
    │   │   │   ├── user-preference.service.ts
    │   │   │   ├── user.controller.ts
    │   │   │   ├── user.module.ts
    │   │   │   ├── user.service.spec.ts
    │   │   │   └── user.service.ts
    │   │   └── 📁workflow-engine
    │   │       ├── 📁dto
    │   │       │   ├── create-workflow-definition.dto.ts
    │   │       │   ├── evaluate-workflow.dto.ts
    │   │       │   ├── get-available-actions.dto.ts
    │   │       │   └── update-workflow-definition.dto.ts
    │   │       ├── 📁entities
    │   │       │   └── workflow-definition.entity.ts
    │   │       ├── 📁interfaces
    │   │       │   └── workflow.interface.ts
    │   │       ├── workflow-dsl.service.ts
    │   │       ├── workflow-engine.controller.ts
    │   │       ├── workflow-engine.module.ts
    │   │       ├── workflow-engine.service.spec.ts
    │   │       └── workflow-engine.service.ts
    │   ├── app.controller.spec.ts
    │   ├── app.controller.ts
    │   ├── app.module.ts
    │   ├── app.service.ts
    │   ├── main.ts
    │   └── redlock.d.ts
    ├── 📁test
    │   ├── app.e2e-spec.ts
    │   ├── jest-e2e.json
    │   ├── phase3-workflow.e2e-spec.ts
    │   └── simple.e2e-spec.ts
    ├─ 📁uploads
    │   └── 📁temp
    │       ├── 5a6d4c26-84b2-4c8a-b177-9fa267651a93.pdf
    │       └── d60d9807-a22d-4ca0-b99a-5d5d8b81b3e8.pdf
    ├── .editorconfig
    ├── .env
    ├── .gitignore
    ├── .prettierrc
    ├── docker-compose.override.yml.example
    ├── docker-compose.yml
    ├── eslint.config.mjs
    ├── Infrastructure Setup.yml
    ├── nest-cli.json
    ├── package-lock.json
    ├── package.json
    ├── pnpm-lock.yaml
    ├── README.md
    ├── tsconfig.build.json
    └── tsconfig.json
```