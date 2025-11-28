// File: src/modules/workflow-engine/workflow-dsl.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';

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
  condition?: string;
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
   */
  compile(dsl: any): CompiledWorkflow {
    if (!dsl || typeof dsl !== 'object') {
      throw new BadRequestException('DSL must be a valid JSON object.');
    }

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

    this.validateIntegrity(compiled, stateMap);

    return compiled;
  }

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

      if (state.transitions) {
        for (const [action, rule] of Object.entries(state.transitions)) {
          if (!stateMap.has(rule.to)) {
            throw new BadRequestException(
              `DSL Error: State "${stateName}" transitions via "${action}" to unknown state "${rule.to}".`,
            );
          }
        }
      }
    }

    if (!hasInitial) {
      throw new BadRequestException('DSL Error: No initial state defined.');
    }
  }

  evaluate(
    compiled: CompiledWorkflow,
    currentState: string,
    action: string,
    context: any = {}, // Default empty object
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

    if (transition.requirements && transition.requirements.length > 0) {
      this.checkRequirements(transition.requirements, context);
    }

    return {
      nextState: transition.to,
      events: transition.events || [],
    };
  }

  private checkRequirements(requirements: RequirementRule[], context: any) {
    const safeContext = context || {};
    const userRoles = safeContext.roles || [];
    const userId = safeContext.userId;

    const isAllowed = requirements.some((req) => {
      if (req.role) {
        return userRoles.includes(req.role);
      }
      if (req.user) {
        return userId === req.user;
      }
      // Future: Add Condition Logic Evaluation here
      return false;
    });

    if (!isAllowed) {
      throw new BadRequestException(
        'Access Denied: You do not meet the requirements for this action.',
      );
    }
  }
}
