import type { Organization, Team, Role, User, ContentItem, AuthUser } from '@mdm/shared';

let seq = 0;
const next = () => `00000000-0000-0000-0000-${String(++seq).padStart(12, '0')}`;
const now = () => new Date().toISOString();

export function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: next(),
    name: `Org-${seq}`,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: next(),
    name: `Team-${seq}`,
    organizationId: next(),
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: next(),
    name: `Role-${seq}`,
    permissions: [],
    createdAt: now(),
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: next(),
    email: `user${seq}@example.com`,
    name: `User ${seq}`,
    isAdmin: false,
    organizationId: null,
    teamId: null,
    roleId: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: next(),
    email: `user${seq}@example.com`,
    name: `User ${seq}`,
    isAdmin: false,
    organizationId: null,
    teamId: null,
    roleId: null,
    permissions: [],
    ...overrides,
  };
}

export function makeContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: next(),
    title: `Content ${seq}`,
    body: 'Body text',
    assignedToUserId: null,
    createdByUserId: null,
    organizationId: next(),
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}
