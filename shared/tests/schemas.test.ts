import { describe, it, expect } from 'vitest';

import {
  LoginSchema,
  CreateOrganizationSchema,
  CreateTeamSchema,
  CreateUserSchema,
  CreateRoleSchema,
  CreateContentSchema,
  UpdateContentSchema,
} from '../src/index.js';

describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    expect(() =>
      LoginSchema.parse({ email: 'user@example.com', password: 'Pass1234' }),
    ).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => LoginSchema.parse({ email: 'not-an-email', password: 'Pass1234' })).toThrow();
  });

  it('rejects missing password', () => {
    expect(() => LoginSchema.parse({ email: 'user@example.com' })).toThrow();
  });

  it('lowercases email via transform', () => {
    const result = LoginSchema.parse({ email: 'USER@Example.COM', password: 'Pass1234' });
    expect(result.email).toBe('user@example.com');
  });
});

describe('CreateUserSchema', () => {
  const valid = {
    email: 'jane@mdm.local',
    name: 'Jane',
    password: 'Secur3Pass',
  };

  it('accepts valid user input', () => {
    expect(() => CreateUserSchema.parse(valid)).not.toThrow();
  });

  it('rejects password shorter than 8 chars', () => {
    expect(() => CreateUserSchema.parse({ ...valid, password: 'short1' })).toThrow();
  });

  it('rejects password with no digits', () => {
    expect(() => CreateUserSchema.parse({ ...valid, password: 'NoDigitsHere' })).toThrow();
  });

  it('rejects name shorter than 2 chars', () => {
    expect(() => CreateUserSchema.parse({ ...valid, name: 'A' })).toThrow();
  });

  it('defaults isAdmin to false', () => {
    const result = CreateUserSchema.parse(valid);
    expect(result.isAdmin).toBe(false);
  });

  it('lowercases email via transform', () => {
    const result = CreateUserSchema.parse({ ...valid, email: 'JANE@MDM.LOCAL' });
    expect(result.email).toBe('jane@mdm.local');
  });
});

describe('CreateOrganizationSchema', () => {
  it('accepts valid name', () => {
    expect(() => CreateOrganizationSchema.parse({ name: 'Acme Corp' })).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() => CreateOrganizationSchema.parse({ name: '' })).toThrow();
  });
});

describe('CreateTeamSchema', () => {
  it('accepts valid team', () => {
    expect(() =>
      CreateTeamSchema.parse({
        name: 'Engineering',
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).not.toThrow();
  });

  it('rejects invalid organizationId (not a UUID)', () => {
    expect(() => CreateTeamSchema.parse({ name: 'Eng', organizationId: 'not-a-uuid' })).toThrow();
  });
});

describe('CreateRoleSchema', () => {
  it('accepts role with permissions array', () => {
    expect(() =>
      CreateRoleSchema.parse({ name: 'Editor', permissions: ['content:read', 'content:create'] }),
    ).not.toThrow();
  });

  it('requires permissions field when omitted', () => {
    expect(() => CreateRoleSchema.parse({ name: 'Viewer' })).toThrow();
  });
});

describe('CreateContentSchema', () => {
  it('accepts valid content', () => {
    expect(() => CreateContentSchema.parse({ title: 'Hello', body: 'World' })).not.toThrow();
  });

  it('rejects missing title', () => {
    expect(() => CreateContentSchema.parse({ body: 'World' })).toThrow();
  });

  it('requires body field when omitted', () => {
    expect(() => CreateContentSchema.parse({ title: 'Hello' })).toThrow();
  });
});

describe('UpdateContentSchema', () => {
  it('accepts partial update (title only)', () => {
    expect(() => UpdateContentSchema.parse({ title: 'New Title' })).not.toThrow();
  });

  it('accepts empty object (no-op update)', () => {
    expect(() => UpdateContentSchema.parse({})).not.toThrow();
  });
});
