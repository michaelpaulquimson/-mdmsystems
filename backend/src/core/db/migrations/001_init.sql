CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Roles ────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  permissions JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Teams ────────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (name, organization_id)
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  is_admin        BOOLEAN      NOT NULL DEFAULT FALSE,
  organization_id UUID         REFERENCES organizations(id) ON DELETE SET NULL,
  team_id         UUID         REFERENCES teams(id)         ON DELETE SET NULL,
  role_id         UUID         REFERENCES roles(id)         ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Case-insensitive email uniqueness (belt + suspenders with zod .toLowerCase() transform)
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- ─── Content Items ────────────────────────────────────────────────────────────
CREATE TABLE content_items (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(255) NOT NULL,
  body                TEXT         NOT NULL DEFAULT '',
  assigned_to_user_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Refresh Tokens ───────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,     -- sha-256 of raw token; raw never stored
  issued_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID         REFERENCES refresh_tokens(id),
  user_agent   VARCHAR(500),
  ip_address   INET
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  action          VARCHAR(50) NOT NULL,           -- create | update | delete | login | logout
  entity_type     VARCHAR(50) NOT NULL,           -- organization | team | user | role | content_item
  entity_id       UUID,
  organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  before          JSONB,
  after           JSONB,
  ip_address      INET,
  user_agent      VARCHAR(500),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes (Postgres does NOT auto-index FKs) ───────────────────────────────
CREATE INDEX idx_content_assigned ON content_items(assigned_to_user_id);
CREATE INDEX idx_content_creator  ON content_items(created_by_user_id);
CREATE INDEX idx_content_org      ON content_items(organization_id);
CREATE INDEX idx_users_org        ON users(organization_id);
CREATE INDEX idx_users_team       ON users(team_id);
CREATE INDEX idx_users_role       ON users(role_id);
CREATE INDEX idx_teams_org        ON teams(organization_id);
CREATE INDEX idx_refresh_user     ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expires  ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_audit_entity     ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_org_time   ON audit_log(organization_id, occurred_at DESC);
CREATE INDEX idx_audit_actor      ON audit_log(actor_user_id, occurred_at DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teams_updated
  BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_items_updated
  BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
