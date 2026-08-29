// File: src/modules/workflow-engine/workflow-dsl.service.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  ValidationException,
  WorkflowException,
} from '../../common/exceptions';
// ADR-001/ADR-049 FR-015: ใช้ JSON Logic สำหรับ transition condition (ห้าม string eval)
import jsonLogic from 'json-logic-js';

// ==========================================
// 1. Interfaces for RAW DSL (Input from User)
// ==========================================
export interface RawWorkflowDSL {
  workflow: string;
  version?: number;
  description?: string;
  states: RawState[];
}

export interface RawState {
  name: string;
  initial?: boolean;
  terminal?: boolean;
  // ADR-049: statusProjection — map workflow state → module status code
  // Engine เขียน projected status ลง entity column ตอน transition (เช่น { rfa: 'FRE' })
  statusProjection?: Record<string, string>;
  on?: Record<string, RawTransition>;
}

export interface RawTransition {
  to: string;
  require?: {
    role?: string | string[];
    user?: string;
  };
  // ADR-001/ADR-049 FR-015: JSON Logic object (ห้าม string eval)
  // ตัวอย่าง: { "==": [{ "var": "context.amount" }, 100] }
  condition?: Record<string, unknown>;
  // ADR-049: approveCode — code ที่ engine เขียนลง rfa_approve_code_id เมื่อ transition นี้สำเร็จ
  // เป็น metadata ไม่มีผลต่อ state (state กำหนดโดย `to`) แต่เป็นตัวบอกว่า transition นี้ map ไป code ไหน
  approveCode?: string;
  events?: RawEvent[];
}

export interface RawEvent {
  type: 'notify' | 'webhook' | 'assign' | 'auto_action';
  target?: string;
  template?: string;
  payload?: Record<string, unknown>;
}

// ==========================================
// 2. Interfaces for COMPILED Schema (Optimized for Runtime)
// ==========================================
export interface CompiledWorkflow {
  workflow: string;
  version: number;
  initialState: string; // Optimize: เก็บชื่อ Initial State ไว้เลย ไม่ต้อง loop หา
  states: Record<string, CompiledState>;
}

export interface CompiledState {
  terminal: boolean;
  // ADR-049: statusProjection — map workflow state → module status code
  statusProjection: Record<string, string>;
  transitions: Record<string, CompiledTransition>;
}

export interface CompiledTransition {
  to: string;
  requirements: {
    roles: string[];
    userId?: string;
  };
  // ADR-001/ADR-049 FR-015: JSON Logic object (ห้าม string eval)
  condition?: Record<string, unknown>;
  // ADR-049: approveCode — code ที่ engine เขียนลง rfa_approve_code_id
  approveCode?: string;
  events: RawEvent[];
}

@Injectable()
export class WorkflowDslService {
  private readonly logger = new Logger(WorkflowDslService.name);

  /**
   * [Compile Time]
   * แปลง Raw DSL เป็น Compiled Structure พร้อม Validation
   */
  compile(dsl: RawWorkflowDSL): CompiledWorkflow {
    this.validateSchemaStructure(dsl);

    const compiled: CompiledWorkflow = {
      workflow: dsl.workflow,
      version: dsl.version || 1,
      initialState: '',
      states: {},
    };

    const definedStates = new Set<string>(dsl.states.map((s) => s.name));
    let initialFound = false;

    // 1. Process States
    for (const rawState of dsl.states) {
      if (rawState.initial) {
        if (initialFound) {
          throw new WorkflowException(
            'DSL_MULTIPLE_INITIAL_STATES',
            `DSL Error: Multiple initial states found (at "${rawState.name}")`,
            'DSL มี Initial State หลายค่า แต่ละ Workflow ต้องมีเพียง Initial State เดียว',
            ['ตรวจสอบโครงสร้าง DSL และแก้ไข Initial State']
          );
        }
        compiled.initialState = rawState.name;
        initialFound = true;
      }

      const compiledState: CompiledState = {
        terminal: !!rawState.terminal,
        // ADR-049: เก็บ statusProjection จาก DSL (default = empty object ถ้าไม่ระบุ)
        statusProjection: rawState.statusProjection ?? {},
        transitions: {},
      };

      // 2. Process Transitions
      if (rawState.on) {
        for (const [action, rule] of Object.entries(rawState.on)) {
          // Validation: Target state must exist
          if (!definedStates.has(rule.to)) {
            throw new WorkflowException(
              'DSL_UNKNOWN_TRANSITION_TARGET',
              `DSL Error: State "${rawState.name}" transitions via "${action}" to unknown state "${rule.to}"`,
              'DSL อ้างอิง State ที่ไม่พบ',
              ['ตรวจสอบชื่อ State ที่กำหนดใน Transition']
            );
          }

          // ADR-001/ADR-049 FR-015: ปฏิเสธ string condition (ห้าม string eval)
          if (
            rule.condition !== undefined &&
            typeof rule.condition !== 'object'
          ) {
            throw new WorkflowException(
              'DSL_STRING_CONDITION_FORBIDDEN',
              `DSL Error: Transition "${action}" in state "${rawState.name}" has a string condition — JSON Logic required (ADR-001/FR-015)`,
              'DSL ใช้ string condition ซึ่งถูกห้าม — ต้องใช้ JSON Logic object',
              [
                'แปลง condition เป็น JSON Logic format เช่น { "==": [{ "var": "field" }, value] }',
              ]
            );
          }

          compiledState.transitions[action] = {
            to: rule.to,
            requirements: {
              roles: rule.require?.role
                ? Array.isArray(rule.require.role)
                  ? rule.require.role
                  : [rule.require.role]
                : [],
              userId: rule.require?.user,
            },
            condition: rule.condition,
            // ADR-049: เก็บ approveCode metadata จาก DSL
            approveCode: rule.approveCode,
            events: rule.events || [],
          };
        }
      } else if (!rawState.terminal) {
        this.logger.warn(
          `State "${rawState.name}" is not terminal but has no transitions.`
        );
      }

      compiled.states[rawState.name] = compiledState;
    }

    if (!initialFound) {
      throw new WorkflowException(
        'DSL_NO_INITIAL_STATE',
        'DSL Error: No initial state defined',
        'DSL ไม่มีการกำหนด Initial State',
        ['เพิ่ม initial: true ใน State หนึ่ง']
      );
    }

    return compiled;
  }

  /**
   * [Runtime]
   * ประมวลผล Action และคืนค่า State ถัดไป
   */
  evaluate(
    compiled: CompiledWorkflow,
    currentState: string,
    action: string,
    context: Record<string, unknown> = {}
  ): { nextState: string; events: RawEvent[]; approveCode?: string } {
    const stateConfig = compiled.states[currentState];

    // 1. Validate State Existence
    if (!stateConfig) {
      throw new WorkflowException(
        'WORKFLOW_INVALID_CURRENT_STATE',
        `Runtime Error: Current state "${currentState}" is invalid`,
        'Workflow อยู่ในสถานะที่ไม่รู้จัก',
        ['ตรวจสอบ DSL ของ Workflow']
      );
    }

    // 2. Check if terminal
    if (stateConfig.terminal) {
      throw new WorkflowException(
        'WORKFLOW_TERMINAL_STATE',
        `Runtime Error: Cannot transition from terminal state "${currentState}"`,
        'ไม่สามารถดำเนินการจาก State สุดท้ายได้',
        ['เอกสารสิ้นสุดกระบวนการแล้ว']
      );
    }

    // 3. Find Transition
    const transition = stateConfig.transitions[action];
    if (!transition) {
      const allowed = Object.keys(stateConfig.transitions).join(', ');
      throw new WorkflowException(
        'WORKFLOW_INVALID_ACTION',
        `Invalid Action: "${action}" is not allowed from "${currentState}". Allowed: [${allowed}]`,
        `ไม่สามารถดำเนินการ "${action}" ในสถานะปัจจุบัน ทำได้: [${allowed}]`,
        ['เลือกการดำเนินการที่อนุญาตจากรายการ']
      );
    }

    // 4. Validate Requirements (RBAC)
    this.checkRequirements(transition.requirements, context);

    // 5. Evaluate Condition (Dynamic Logic)
    if (transition.condition) {
      const isMet = this.evaluateCondition(transition.condition, context);
      if (!isMet) {
        throw new WorkflowException(
          'WORKFLOW_CONDITION_NOT_MET',
          'Condition Failed: The criteria for this transition are not met',
          'เงื่อนไขสำหรับการดำเนินการนี้ไม่ผ่าน',
          ['ตรวจสอบเงื่อนไขที่กำหนดใน Workflow']
        );
      }
    }

    return {
      nextState: transition.to,
      events: transition.events,
      // ADR-049: ส่ง approveCode กลับให้ engine เขียนลง rfa_approve_code_id
      approveCode: transition.approveCode,
    };
  }

  // --------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------

  private validateSchemaStructure(dsl: unknown) {
    if (!dsl || typeof dsl !== 'object') {
      throw new ValidationException('DSL must be a JSON object');
    }
    const d = dsl as Record<string, unknown>;
    if (!d.workflow || !d.states || !Array.isArray(d.states)) {
      throw new ValidationException(
        'DSL Error: Missing required fields (workflow, states)'
      );
    }
  }

  private checkRequirements(
    req: CompiledTransition['requirements'],
    context: Record<string, unknown>
  ) {
    // [FIX] Early return if no requirements defined
    if (!req) {
      return;
    }

    const userRoles: string[] = (context.roles as string[]) || [];
    const userId: string | number = context.userId as string | number;

    // Check Roles (OR logic inside array) - with null-safety
    const requiredRoles = req.roles || [];
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        throw new WorkflowException(
          'WORKFLOW_ROLE_REQUIRED',
          `Access Denied: Required roles [${requiredRoles.join(', ')}]`,
          `ต้องมี Role: [${requiredRoles.join(', ')}] จึงจะดำเนินการนี้ได้`,
          ['ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์']
        );
      }
    }

    // Check Specific User
    if (req.userId && String(req.userId) !== String(userId)) {
      throw new WorkflowException(
        'WORKFLOW_USER_MISMATCH',
        'Access Denied: User mismatch',
        'ผู้ใช้ไม่ได้รับอนุญาตให้ดำเนินการนี้',
        ['ตรวจสอบว่าเล็็กชื่ออีเมลที่ป้อนให้เข้าสู่ระบบ']
      );
    }
  }

  /**
   * ADR-001/ADR-049 FR-015: Evaluate JSON Logic condition (ห้าม string eval)
   * ใช้ json-logic-js library ซึ่งเป็น safe evaluator — ไม่มี code injection risk
   */
  private evaluateCondition(
    condition: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    try {
      // json-logic-js รับ rule object + data context แล้วคืน boolean/value
      const result = jsonLogic.apply(condition, context);
      return !!result;
    } catch (error: unknown) {
      this.logger.error(
        `JSON Logic Condition Error: ${JSON.stringify(condition)} -> ${error instanceof Error ? error.message : String(error)}`
      );
      return false; // Fail safe
    }
  }
}
