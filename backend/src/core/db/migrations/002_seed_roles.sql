-- Static seed data — only rows that contain no secrets
-- Dynamic seed data (users, orgs, teams, content) lives in src/core/db/seed.ts

INSERT INTO roles (name, permissions) VALUES
  ('Viewer', '["content:read"]'::jsonb),
  ('Editor', '["content:read","content:create","content:update","content:delete"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
