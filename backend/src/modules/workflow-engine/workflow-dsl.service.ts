// File: src/modules/workflow-engine/workflow-dsl.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';

export interface WorkflowState {
  initial?: boolean;
  terminal?: boolean;
  transitions?: Record<string, TransitionRule>;
}

export interface TransitionRule {
  to: string;
  requirements?: RequirementRule[];
  events?: EventRule[];
}

export interface RequirementRule {
  role?: string;
  user?: string;
  condition?: string; // e.g. "amount > 5000" (Advanced)
}

export interface EventRule {
  type: 'notify' | 'webhook' | 'update_status';
  target?: string;
  payload?: any;
}

export interface CompiledWorkflow {
  workflow: string;
  version: string | number;
  states: Record<string, WorkflowState>;
}

@Injectable()
export class WorkflowDslService {
  /**
   * คอมไพล์ DSL Input ให้เป็น Standard Execution Tree
   * @param dsl ข้อมูลดิบจาก User (JSON/Object)
   * @returns CompiledWorkflow Object ที่พร้อมใช้งาน
   */
  compile(dsl: any): CompiledWorkflow {
    // 1. Basic Structure Validation
    if (!dsl.states || !Array.isArray(dsl.states)) {
      throw new BadRequestException(
        'DSL syntax error: "states" array is required.',
      );
    }

    const compiled: CompiledWorkflow = {
      workflow: dsl.workflow || 'UNKNOWN',
      version: dsl.version || 1,
      states: {},
    };

    const stateMap = new Set<string>();

    // 2. First Pass: Collect all state names and normalize structure
    for (const rawState of dsl.states) {
      if (!rawState.name) {
        throw new BadRequestException(
          'DSL syntax error: All states must have a "name".',
        );
      }

      stateMap.add(rawState.name);

      const normalizedState: WorkflowState = {
        initial: !!rawState.initial,
        terminal: !!rawState.terminal,
        transitions: {},
      };

      // Normalize transitions "on:"
      if (rawState.on) {
        for (const [action, rule] of Object.entries(rawState.on)) {
          const rawRule = rule as any;
          normalizedState.transitions![action] = {
            to: rawRule.to,
            requirements: rawRule.require || [],
            events: rawRule.events || [],
          };
        }
      }

      compiled.states[rawState.name] = normalizedState;
    }

    // 3. Second Pass: Validate Integrity
    this.validateIntegrity(compiled, stateMap);

    return compiled;
  }

  /**
   * ตรวจสอบความสมบูรณ์ของ Workflow Logic
   */
  private validateIntegrity(compiled: CompiledWorkflow, stateMap: Set<string>) {
    let hasInitial = false;

    for (const [stateName, state] of Object.entries(compiled.states)) {
      if (state.initial) {
        if (hasInitial)
          throw new BadRequestException(
            `DSL Error: Multiple initial states found.`,
          );
        hasInitial = true;
      }

      // ตรวจสอบ Transitions
      if (state.transitions) {
        for (const [action, rule] of Object.entries(state.transitions)) {
          // 1. ปลายทางต้องมีอยู่จริง
          if (!stateMap.has(rule.to)) {
            throw new BadRequestException(
              `DSL Error: State "${stateName}" transitions via "${action}" to unknown state "${rule.to}".`,
            );
          }
          // 2. Action name convention (Optional but recommended)
          if (!/^[A-Z0-9_]+$/.test(action)) {
            // Warning or Strict Error could be here
          }
        }
      }
    }

    if (!hasInitial) {
      throw new BadRequestException('DSL Error: No initial state defined.');
    }
  }

  /**
   * ประเมินผล (Evaluate) การเปลี่ยนสถานะ
   * @param compiled ข้อมูล Workflow ที่ Compile แล้ว
   * @param currentState สถานะปัจจุบัน
   * @param action การกระทำ
   * @param context ข้อมูลประกอบ (User roles, etc.)
   */
  evaluate(
    compiled: CompiledWorkflow,
    currentState: string,
    action: string,
    context: any,
  ): { nextState: string; events: EventRule[] } {
    const stateConfig = compiled.states[currentState];

    if (!stateConfig) {
      throw new BadRequestException(
        `Runtime Error: Current state "${currentState}" not found in definition.`,
      );
    }

    if (stateConfig.terminal) {
      throw new BadRequestException(
        `Runtime Error: Cannot transition from terminal state "${currentState}".`,
      );
    }

    const transition = stateConfig.transitions?.[action];

    if (!transition) {
      throw new BadRequestException(
        `Runtime Error: Action "${action}" is not allowed from state "${currentState}". Available actions: ${Object.keys(stateConfig.transitions || {}).join(', ')}`,
      );
    }

    // Check Requirements (RBAC Logic inside Engine)
    if (transition.requirements && transition.requirements.length > 0) {
      this.checkRequirements(transition.requirements, context);
    }

    return {
      nextState: transition.to,
      events: transition.events || [],
    };
  }

  /**
   * ตรวจสอบเงื่อนไขสิทธิ์ (Requirements)
   */
  private checkRequirements(requirements: RequirementRule[], context: any) {
    const userRoles = context.roles || [];
    const userId = context.userId;

    const isAllowed = requirements.some((req) => {
      // กรณีเช็ค Role
      if (req.role) {
        return userRoles.includes(req.role);
      }
      // กรณีเช็ค Specific User
      if (req.user) {
        return userId === req.user;
      }
      return false;
    });

    if (!isAllowed) {
      throw new BadRequestException(
        'Access Denied: You do not meet the requirements for this action.',
      );
    }
  }
}
