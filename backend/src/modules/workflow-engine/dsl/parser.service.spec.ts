import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkflowDslParser } from './parser.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { RFA_WORKFLOW_EXAMPLE } from './workflow-dsl.schema';
import { BadRequestException } from '@nestjs/common';

describe('WorkflowDslParser', () => {
  let parser: WorkflowDslParser;
  let mockRepository: Partial<Repository<WorkflowDefinition>>;

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn((def) => Promise.resolve(def)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowDslParser,
        {
          provide: getRepositoryToken(WorkflowDefinition),
          useValue: mockRepository,
        },
      ],
    }).compile();

    parser = module.get<WorkflowDslParser>(WorkflowDslParser);
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  describe('parse', () => {
    it('should parse valid RFA workflow DSL', async () => {
      const dslJson = JSON.stringify(RFA_WORKFLOW_EXAMPLE);

      const result = await parser.parse(dslJson);

      expect(result).toBeDefined();
      expect(result.name).toBe('RFA_APPROVAL');
      expect(result.version).toBe('1.0.0');
      expect(result.isActive).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should reject invalid JSON', async () => {
      const invalidJson = '{ invalid json }';

      await expect(parser.parse(invalidJson)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject workflow with invalid state reference', async () => {
      const invalidDsl = {
        name: 'INVALID',
        version: '1.0.0',
        states: ['DRAFT', 'APPROVED'],
        initialState: 'DRAFT',
        finalStates: ['APPROVED'],
        transitions: [
          {
            from: 'DRAFT',
            to: 'NONEXISTENT_STATE', // Invalid state
            trigger: 'SUBMIT',
          },
        ],
      };

      await expect(parser.parse(JSON.stringify(invalidDsl))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject workflow with invalid initial state', async () => {
      const invalidDsl = {
        name: 'INVALID',
        version: '1.0.0',
        states: ['DRAFT', 'APPROVED'],
        initialState: 'NONEXISTENT', // Invalid
        finalStates: ['APPROVED'],
        transitions: [],
      };

      await expect(parser.parse(JSON.stringify(invalidDsl))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject workflow with invalid final state', async () => {
      const invalidDsl = {
        name: 'INVALID',
        version: '1.0.0',
        states: ['DRAFT', 'APPROVED'],
        initialState: 'DRAFT',
        finalStates: ['NONEXISTENT'], // Invalid
        transitions: [],
      };

      await expect(parser.parse(JSON.stringify(invalidDsl))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject workflow with duplicate transitions', async () => {
      const invalidDsl = {
        name: 'INVALID',
        version: '1.0.0',
        states: ['DRAFT', 'SUBMITTED'],
        initialState: 'DRAFT',
        finalStates: ['SUBMITTED'],
        transitions: [
          { from: 'DRAFT', to: 'SUBMITTED', trigger: 'SUBMIT' },
          { from: 'DRAFT', to: 'SUBMITTED', trigger: 'SUBMIT' }, // Duplicate
        ],
      };

      await expect(parser.parse(JSON.stringify(invalidDsl))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject workflow with invalid version format', async () => {
      const invalidDsl = {
        ...RFA_WORKFLOW_EXAMPLE,
        version: 'invalid-version',
      };

      await expect(parser.parse(JSON.stringify(invalidDsl))).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateOnly', () => {
    it('should validate correct DSL without saving', () => {
      const dslJson = JSON.stringify(RFA_WORKFLOW_EXAMPLE);

      const result = parser.validateOnly(dslJson);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should return error for invalid DSL', () => {
      const invalidDsl = {
        name: 'INVALID',
        version: '1.0.0',
        states: ['DRAFT'],
        initialState: 'NONEXISTENT',
        finalStates: [],
        transitions: [],
      };

      const result = parser.validateOnly(JSON.stringify(invalidDsl));

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getParsedDsl', () => {
    it('should retrieve and parse stored DSL', async () => {
      const storedDefinition = {
        id: 1,
        name: 'RFA_APPROVAL',
        version: '1.0.0',
        dslContent: JSON.stringify(RFA_WORKFLOW_EXAMPLE),
      };

      mockRepository.findOne = jest.fn().mockResolvedValue(storedDefinition);

      const result = await parser.getParsedDsl(1);

      expect(result).toBeDefined();
      expect(result.name).toBe('RFA_APPROVAL');
    });

    it('should throw error if definition not found', async () => {
      mockRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(parser.getParsedDsl(999)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
