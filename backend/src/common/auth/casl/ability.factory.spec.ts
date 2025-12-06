import { Test, TestingModule } from '@nestjs/testing';
import { AbilityFactory, ScopeContext } from './ability.factory';
import { User } from '../../../modules/user/entities/user.entity';
import { UserAssignment } from '../../../modules/user/entities/user-assignment.entity';

describe('AbilityFactory', () => {
  let factory: AbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbilityFactory],
    }).compile();

    factory = module.get<AbilityFactory>(AbilityFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('Global Admin', () => {
    it('should grant all permissions for global admin', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            organizationId: undefined,
            projectId: undefined,
            contractId: undefined,
            permissionNames: ['system.manage_all'],
          }),
        ],
      });

      const ability = factory.createForUser(user, {});

      expect(ability.can('manage', 'all')).toBe(true);
    });
  });

  describe('Organization Level', () => {
    it('should grant permissions for matching organization', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            organizationId: 1,
            permissionNames: ['correspondence.create', 'correspondence.read'],
          }),
        ],
      });

      const context: ScopeContext = { organizationId: 1 };
      const ability = factory.createForUser(user, context);

      expect(ability.can('create', 'correspondence')).toBe(true);
      expect(ability.can('read', 'correspondence')).toBe(true);
    });

    it('should deny permissions for non-matching organization', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            organizationId: 1,
            permissionNames: ['correspondence.create'],
          }),
        ],
      });

      const context: ScopeContext = { organizationId: 2 };
      const ability = factory.createForUser(user, context);

      expect(ability.can('create', 'correspondence')).toBe(false);
    });
  });

  describe('Project Level', () => {
    it('should grant permissions for matching project', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            projectId: 10,
            permissionNames: ['rfa.create'],
          }),
        ],
      });

      const context: ScopeContext = { projectId: 10 };
      const ability = factory.createForUser(user, context);

      expect(ability.can('create', 'rfa')).toBe(true);
    });
  });

  describe('Contract Level', () => {
    it('should grant permissions for matching contract', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            contractId: 5,
            permissionNames: ['drawing.create'],
          }),
        ],
      });

      const context: ScopeContext = { contractId: 5 };
      const ability = factory.createForUser(user, context);

      expect(ability.can('create', 'drawing')).toBe(true);
    });
  });

  describe('Multiple Assignments', () => {
    it('should combine permissions from multiple assignments', () => {
      const user = createMockUser({
        assignments: [
          createMockAssignment({
            organizationId: 1,
            permissionNames: ['correspondence.create'],
          }),
          createMockAssignment({
            projectId: 10,
            permissionNames: ['rfa.create'],
          }),
        ],
      });

      const orgAbility = factory.createForUser(user, { organizationId: 1 });
      expect(orgAbility.can('create', 'correspondence')).toBe(true);

      const projectAbility = factory.createForUser(user, { projectId: 10 });
      expect(projectAbility.can('create', 'rfa')).toBe(true);
    });
  });
});

// Helper functions using mock objects
function createMockUser(props: { assignments: UserAssignment[] }): User {
  const user = new User();
  user.user_id = 1;
  user.username = 'testuser';
  user.email = 'test@example.com';
  user.assignments = props.assignments;
  return user;
}

function createMockAssignment(props: {
  organizationId?: number;
  projectId?: number;
  contractId?: number;
  permissionNames: string[];
}): UserAssignment {
  const assignment = new UserAssignment();
  assignment.organizationId = props.organizationId;
  assignment.projectId = props.projectId;
  assignment.contractId = props.contractId;

  // Create mock role with permissions
  assignment.role = {
    permissions: props.permissionNames.map((name) => ({
      permissionName: name,
    })),
  } as any;

  return assignment;
}
