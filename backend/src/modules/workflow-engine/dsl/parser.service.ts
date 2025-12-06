import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowDslSchema, WorkflowDsl } from './workflow-dsl.schema';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';

@Injectable()
export class WorkflowDslParser {
  private readonly logger = new Logger(WorkflowDslParser.name);

  constructor(
    @InjectRepository(WorkflowDefinition)
    private workflowDefRepo: Repository<WorkflowDefinition>
  ) {}

  /**
   * Parse และ Validate Workflow DSL from JSON string
   * @param dslJson JSON string ของ Workflow DSL
   * @returns WorkflowDefinition entity พร้อมบันทึกลง database
   */
  async parse(dslJson: string): Promise<WorkflowDefinition> {
    try {
      // Step 1: Parse JSON
      const rawDsl = JSON.parse(dslJson);

      // Step 2: Validate with Zod schema
      const dsl = WorkflowDslSchema.parse(rawDsl);

      // Step 3: Validate state machine integrity
      this.validateStateMachine(dsl);

      // Step 4: Build WorkflowDefinition entity
      const definition = this.buildDefinition(dsl);

      // Step 5: Save to database
      return await this.workflowDefRepo.save(definition);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException(`Invalid JSON: ${error.message}`);
      }
      if (error.name === 'ZodError') {
        throw new BadRequestException(
          `Invalid workflow DSL: ${JSON.stringify(error.errors)}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate state machine integrity
   * ตรวจสอบว่า state machine ถูกต้องตามหลักการ:
   * - All states in transitions must exist in states array
   * - Initial state must exist
   * - All final states must exist
   * - No dead-end states (states with no outgoing transitions except final states)
   */
  private validateStateMachine(dsl: WorkflowDsl): void {
    const stateSet = new Set(dsl.states);
    const finalStateSet = new Set(dsl.finalStates);

    // 1. Validate initial state
    if (!stateSet.has(dsl.initialState)) {
      throw new BadRequestException(
        `Initial state "${dsl.initialState}" not found in states array`
      );
    }

    // 2. Validate final states
    dsl.finalStates.forEach((state) => {
      if (!stateSet.has(state)) {
        throw new BadRequestException(
          `Final state "${state}" not found in states array`
        );
      }
    });

    // 3. Validate transitions
    const statesWithOutgoing = new Set<string>();

    dsl.transitions.forEach((transition, index) => {
      // Check 'from' state
      if (!stateSet.has(transition.from)) {
        throw new BadRequestException(
          `Transition ${index}: 'from' state "${transition.from}" not found in states array`
        );
      }

      // Check 'to' state
      if (!stateSet.has(transition.to)) {
        throw new BadRequestException(
          `Transition ${index}: 'to' state "${transition.to}" not found in states array`
        );
      }

      // Track states with outgoing transitions
      statesWithOutgoing.add(transition.from);
    });

    // 4. Check for dead-end states (except final states)
    const nonFinalStates = dsl.states.filter(
      (state) => !finalStateSet.has(state)
    );

    nonFinalStates.forEach((state) => {
      if (!statesWithOutgoing.has(state) && state !== dsl.initialState) {
        this.logger.warn(
          `Warning: State "${state}" has no outgoing transitions (potential dead-end)`
        );
      }
    });

    // 5. Check for duplicate transitions
    const transitionKeys = new Set<string>();
    dsl.transitions.forEach((transition) => {
      const key = `${transition.from}-${transition.trigger}-${transition.to}`;
      if (transitionKeys.has(key)) {
        throw new BadRequestException(
          `Duplicate transition: ${transition.from} --[${transition.trigger}]--> ${transition.to}`
        );
      }
      transitionKeys.add(key);
    });

    this.logger.log(
      `Workflow "${dsl.name}" v${dsl.version} validated successfully`
    );
  }

  /**
   * Build WorkflowDefinition entity from validated DSL
   */
  private buildDefinition(dsl: WorkflowDsl): WorkflowDefinition {
    const definition = new WorkflowDefinition();
    definition.name = dsl.name;
    definition.version = dsl.version;
    definition.description = dsl.description;
    definition.dslContent = JSON.stringify(dsl, null, 2); // Pretty print for readability
    definition.isActive = true;

    return definition;
  }

  /**
   * Get parsed DSL from WorkflowDefinition
   */
  async getParsedDsl(definitionId: number): Promise<WorkflowDsl> {
    const definition = await this.workflowDefRepo.findOne({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new BadRequestException(
        `Workflow definition ${definitionId} not found`
      );
    }

    try {
      const dsl = JSON.parse(definition.dslContent);
      return WorkflowDslSchema.parse(dsl);
    } catch (error) {
      this.logger.error(
        `Failed to parse stored DSL for definition ${definitionId}`,
        error
      );
      throw new BadRequestException(`Invalid stored DSL: ${error.message}`);
    }
  }

  /**
   * Validate DSL without saving (dry-run)
   */
  validateOnly(dslJson: string): { valid: boolean; errors?: string[] } {
    try {
      const rawDsl = JSON.parse(dslJson);
      const dsl = WorkflowDslSchema.parse(rawDsl);
      this.validateStateMachine(dsl);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }
}
