// File: src/modules/workflow-engine/workflow-dsl.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

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
  on?: Record<string, RawTransition>;
}

export interface RawTransition {
  to: string;
  require?: {
    role?: string | string[];
    user?: string;
  };
  condition?: string; // JavaScript Expression string
  events?: RawEvent[];
}

export interface RawEvent {
  type: 'notify' | 'webhook' | 'assign' | 'auto_action';
  target?: string;
  template?: string;
  payload?: any;
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
  transitions: Record<string, CompiledTransition>;
}

export interface CompiledTransition {
  to: string;
  requirements: {
    roles: string[];
    userId?: string;
  };
  condition?: string;
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
          throw new BadRequestException(
            `DSL Error: Multiple initial states found (at "${rawState.name}").`
          );
        }
        compiled.initialState = rawState.name;
        initialFound = true;
      }

      const compiledState: CompiledState = {
        terminal: !!rawState.terminal,
        transitions: {},
      };

      // 2. Process Transitions
      if (rawState.on) {
        for (const [action, rule] of Object.entries(rawState.on)) {
          // Validation: Target state must exist
          if (!definedStates.has(rule.to)) {
            throw new BadRequestException(
              `DSL Error: State "${rawState.name}" transitions via "${action}" to unknown state "${rule.to}".`
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
      throw new BadRequestException('DSL Error: No initial state defined.');
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
    context: any = {}
  ): { nextState: string; events: RawEvent[] } {
    const stateConfig = compiled.states[currentState];

    // 1. Validate State Existence
    if (!stateConfig) {
      throw new BadRequestException(
        `Runtime Error: Current state "${currentState}" is invalid.`
      );
    }

    // 2. Check if terminal
    if (stateConfig.terminal) {
      throw new BadRequestException(
        `Runtime Error: Cannot transition from terminal state "${currentState}".`
      );
    }

    // 3. Find Transition
    const transition = stateConfig.transitions[action];
    if (!transition) {
      const allowed = Object.keys(stateConfig.transitions).join(', ');
      throw new BadRequestException(
        `Invalid Action: "${action}" is not allowed from "${currentState}". Allowed: [${allowed}]`
      );
    }

    // 4. Validate Requirements (RBAC)
    this.checkRequirements(transition.requirements, context);

    // 5. Evaluate Condition (Dynamic Logic)
    if (transition.condition) {
      const isMet = this.evaluateCondition(transition.condition, context);
      if (!isMet) {
        throw new BadRequestException(
          'Condition Failed: The criteria for this transition are not met.'
        );
      }
    }

    return {
      nextState: transition.to,
      events: transition.events,
    };
  }

  // --------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------

  private validateSchemaStructure(dsl: any) {
    if (!dsl || typeof dsl !== 'object') {
      throw new BadRequestException('DSL must be a JSON object.');
    }
    if (!dsl.workflow || !dsl.states || !Array.isArray(dsl.states)) {
      throw new BadRequestException(
        'DSL Error: Missing required fields (workflow, states).'
      );
    }
  }

  private checkRequirements(
    req: CompiledTransition['requirements'],
    context: any
  ) {
    // [FIX] Early return if no requirements defined
    if (!req) {
      return;
    }

    const userRoles: string[] = context.roles || [];
    const userId: string | number = context.userId;

    // Check Roles (OR logic inside array) - with null-safety
    const requiredRoles = req.roles || [];
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        throw new BadRequestException(
          `Access Denied: Required roles [${requiredRoles.join(', ')}]`
        );
      }
    }

    // Check Specific User
    if (req.userId && String(req.userId) !== String(userId)) {
      throw new BadRequestException('Access Denied: User mismatch.');
    }
  }

  /**
   * Evaluate simple JS expression securely
   * NOTE: In production, use a safe parser like 'json-logic-js' or vm2
   * For this phase, we use a simple Function constructor with restricted scope.
   */
  private evaluateCondition(expression: string, context: any): boolean {
    try {
      // Simple guard against malicious code (basic)
      if (expression.includes('process') || expression.includes('require')) {
        throw new Error('Unsafe expression detected');
      }

      // Create a function that returns the expression result
      // "context" is available inside the expression
      const func = new Function('context', `return ${expression};`);
      return !!func(context);
    } catch (error: any) {
      this.logger.error(`Condition Error: "${expression}" -> ${error.message}`);
      return false; // Fail safe
    }
  }
}
