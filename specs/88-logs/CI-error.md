🧪 Run Tests
18s
> backend@1.8.1 test /workspace/np-dms/lcbp3/backend
> jest --forceExit --watchAll=false
[Nest] 446  - 03/23/2026, 1:50:33 AM   ERROR [WorkflowEngineService] Transition Failed for inst-1: DB Error
PASS src/modules/workflow-engine/workflow-engine.service.spec.ts
FAIL src/common/auth/auth.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/auth/auth.service.ts:24:1)
      at Object.<anonymous> (common/auth/auth.service.spec.ts:2:1)
FAIL src/modules/correspondence/correspondence.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.ts:15:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.spec.ts:4:1)
PASS src/common/services/uuid-resolver.service.spec.ts
FAIL src/modules/document-numbering/document-numbering.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/document-numbering/entities/document-number-format.entity.ts:13:1)
      at Object.<anonymous> (modules/document-numbering/services/document-numbering.service.ts:6:1)
      at Object.<anonymous> (modules/document-numbering/document-numbering.service.spec.ts:3:1)
PASS src/modules/workflow-engine/dsl/parser.service.spec.ts
FAIL src/common/auth/casl/ability.factory.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (common/auth/casl/ability.factory.spec.ts:3:1)
FAIL src/common/file-storage/file-storage.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      12 | import * as path from 'path';
      13 | import * as crypto from 'crypto';
    >[***m 14 | import { v4 as uuidv4 } from 'uuid';
         | ^[***m
      15 | import { Attachment } from './entities/attachment.entity';
      16 | import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม
      17 |
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/file-storage/file-storage.service.ts:14:1)
      at Object.<anonymous> (common/file-storage/file-storage.service.spec.ts:2:1)
FAIL src/modules/user/user.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (modules/user/user.service.spec.ts:5:1)
PASS src/common/pipes/parse-uuid.pipe.spec.ts
FAIL src/modules/correspondence/correspondence.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.ts:15:1)
      at Object.<anonymous> (modules/correspondence/correspondence.controller.ts:19:1)
      at Object.<anonymous> (modules/correspondence/correspondence.controller.spec.ts:2:1)
FAIL src/modules/project/project.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/project/project.service.ts:11:1)
      at Object.<anonymous> (modules/project/project.service.spec.ts:3:1)
PASS src/common/entities/uuid-base.entity.spec.ts
FAIL src/common/auth/auth.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/auth/auth.service.ts:24:1)
      at Object.<anonymous> (common/auth/auth.controller.ts:18:1)
      at Object.<anonymous> (common/auth/auth.controller.spec.ts:3:1)
FAIL src/modules/migration/migration.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/migration/migration.service.ts:15:1)
      at Object.<anonymous> (modules/migration/migration.service.spec.ts:2:1)
FAIL src/modules/project/project.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/project/project.service.ts:11:1)
      at Object.<anonymous> (modules/project/project.controller.ts:14:1)
      at Object.<anonymous> (modules/project/project.controller.spec.ts:2:1)
PASS src/modules/document-numbering/services/manual-override.service.spec.ts
FAIL src/modules/migration/migration.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/migration/migration.service.ts:15:1)
      at Object.<anonymous> (modules/migration/migration.controller.ts:13:1)
      at Object.<anonymous> (modules/migration/migration.controller.spec.ts:2:1)
FAIL src/common/file-storage/file-storage.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      12 | import * as path from 'path';
      13 | import * as crypto from 'crypto';
    >[***m 14 | import { v4 as uuidv4 } from 'uuid';
         | ^[***m
      15 | import { Attachment } from './entities/attachment.entity';
      16 | import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม
      17 |
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/file-storage/file-storage.service.ts:14:1)
      at Object.<anonymous> (common/file-storage/file-storage.controller.ts:21:1)
      at Object.<anonymous> (common/file-storage/file-storage.controller.spec.ts:2:1)
PASS src/app.controller.spec.ts
FAIL src/modules/json-schema/json-schema.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/guards/rbac.guard.ts:9:1)
      at Object.<anonymous> (modules/json-schema/json-schema.controller.ts:35:1)
      at Object.<anonymous> (modules/json-schema/json-schema.controller.spec.ts:2:1)
Summary of all failing tests
FAIL common/auth/auth.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/auth/auth.service.ts:24:1)
      at Object.<anonymous> (common/auth/auth.service.spec.ts:2:1)
FAIL modules/correspondence/correspondence.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.ts:15:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.spec.ts:4:1)
FAIL modules/document-numbering/document-numbering.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/document-numbering/entities/document-number-format.entity.ts:13:1)
      at Object.<anonymous> (modules/document-numbering/services/document-numbering.service.ts:6:1)
      at Object.<anonymous> (modules/document-numbering/document-numbering.service.spec.ts:3:1)
FAIL common/auth/casl/ability.factory.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (common/auth/casl/ability.factory.spec.ts:3:1)
FAIL common/file-storage/file-storage.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      12 | import * as path from 'path';
      13 | import * as crypto from 'crypto';
    >[***m 14 | import { v4 as uuidv4 } from 'uuid';
         | ^[***m
      15 | import { Attachment } from './entities/attachment.entity';
      16 | import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม
      17 |
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/file-storage/file-storage.service.ts:14:1)
      at Object.<anonymous> (common/file-storage/file-storage.service.spec.ts:2:1)
FAIL modules/user/user.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (modules/user/user.service.spec.ts:5:1)
FAIL modules/correspondence/correspondence.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/correspondence/correspondence.service.ts:15:1)
      at Object.<anonymous> (modules/correspondence/correspondence.controller.ts:19:1)
      at Object.<anonymous> (modules/correspondence/correspondence.controller.spec.ts:2:1)
FAIL modules/project/project.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/project/project.service.ts:11:1)
      at Object.<anonymous> (modules/project/project.service.spec.ts:3:1)
FAIL common/auth/auth.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/auth/auth.service.ts:24:1)
      at Object.<anonymous> (common/auth/auth.controller.ts:18:1)
      at Object.<anonymous> (common/auth/auth.controller.spec.ts:3:1)
FAIL modules/migration/migration.service.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/migration/migration.service.ts:15:1)
      at Object.<anonymous> (modules/migration/migration.service.spec.ts:2:1)
FAIL modules/project/project.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/project/project.service.ts:11:1)
      at Object.<anonymous> (modules/project/project.controller.ts:14:1)
      at Object.<anonymous> (modules/project/project.controller.spec.ts:2:1)
FAIL modules/migration/migration.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
       6 |   BeforeInsert,
       7 | } from 'typeorm';
    >[***m  8 | import { v7 as uuidv7 } from 'uuid';
         | ^[***m
       9 | import { Exclude, Expose } from 'class-transformer';
      10 | import { BaseEntity } from '../../../common/entities/base.entity';
      11 | import { Contract } from '../../contract/entities/contract.entity';
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (modules/project/entities/project.entity.ts:8:1)
      at Object.<anonymous> (modules/correspondence/entities/correspondence.entity.ts:11:1)
      at Object.<anonymous> (modules/migration/migration.service.ts:15:1)
      at Object.<anonymous> (modules/migration/migration.controller.ts:13:1)
      at Object.<anonymous> (modules/migration/migration.controller.spec.ts:2:1)
FAIL common/file-storage/file-storage.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      12 | import * as path from 'path';
      13 | import * as crypto from 'crypto';
    >[***m 14 | import { v4 as uuidv4 } from 'uuid';
         | ^[***m
      15 | import { Attachment } from './entities/attachment.entity';
      16 | import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม
      17 |
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/file-storage/file-storage.service.ts:14:1)
      at Object.<anonymous> (common/file-storage/file-storage.controller.ts:21:1)
      at Object.<anonymous> (common/file-storage/file-storage.controller.spec.ts:2:1)
FAIL modules/json-schema/json-schema.controller.spec.ts
  ● Test suite failed to run
    Jest encountered an unexpected token
    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.
    By default "node_modules" folder is ignored by transformers.
    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation, specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.
    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation
    Details:
    /workspace/np-dms/lcbp3/node_modules/.pnpm/uuid@13.0.0/node_modules/uuid/dist-node/index.js:1
    export { default as MAX } from './max.js';
    ^^^^^^
    SyntaxError: Unexpected token 'export'
      1 | import { Column, BeforeInsert } from 'typeorm';
    >[***m 2 | import { v7 as uuidv7 } from 'uuid';
        | ^[***m
      3 |
      4 | /**
      5 |  * Abstract base entity providing a UUID public identifier column.
      at Runtime.createScriptFromCode (../../node_modules/.pnpm/jest-runtime@30.2.0/node_modules/jest-runtime/build/index.js:1318:40)
      at Object.<anonymous> (common/entities/uuid-base.entity.ts:2:1)
      at Object.<anonymous> (modules/organization/entities/organization.entity.ts:13:1)
      at Object.<anonymous> (modules/user/entities/user.entity.ts:16:1)
      at Object.<anonymous> (modules/user/user.service.ts:15:1)
      at Object.<anonymous> (common/guards/rbac.guard.ts:9:1)
      at Object.<anonymous> (modules/json-schema/json-schema.controller.ts:35:1)
      at Object.<anonymous> (modules/json-schema/json-schema.controller.spec.ts:2:1)
Test Suites: 14 failed, 7 passed, 21 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        15.419 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
 ELIFECYCLE  Test failed. See above for more details.
  ❌  Failure - Main 🧪 Run Tests
exitcode '1': failure
