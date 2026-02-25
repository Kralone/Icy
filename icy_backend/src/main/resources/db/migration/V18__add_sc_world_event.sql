-- Rename V999 to your next Flyway version.
-- SC World Events (official narrative/dev events), distinct from internal scheduled events.

CREATE TABLE IF NOT EXISTS sc_world_event_type (
  name            VARCHAR(100) PRIMARY KEY,
  text_color      VARCHAR(50),
  image_url       VARCHAR(512),
  score_schema    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sc_world_event (
  id                  UUID PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ,
  type_name           VARCHAR(100) NOT NULL REFERENCES sc_world_event_type(name),
  banner_image_url    VARCHAR(512),
  gallery             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of type.score_schema at creation time (keeps events stable when type evolves)
  score_schema_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scwe_start_at ON sc_world_event(start_at);
CREATE INDEX IF NOT EXISTS idx_scwe_type_name ON sc_world_event(type_name);
CREATE INDEX IF NOT EXISTS idx_scwe_gallery_gin ON sc_world_event USING GIN (gallery);
CREATE INDEX IF NOT EXISTS idx_scwe_schema_gin  ON sc_world_event USING GIN (score_schema_snapshot);

CREATE TABLE IF NOT EXISTS sc_world_event_participation (
  id              UUID PRIMARY KEY,
  scwe_id         UUID NOT NULL REFERENCES sc_world_event(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          SMALLINT NOT NULL DEFAULT 0, -- -1 refused, 0 maybe, 1 confirmed
  points          JSONB NOT NULL DEFAULT '{}'::jsonb,
  total           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scwe_user UNIQUE (scwe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scwep_scwe_id ON sc_world_event_participation(scwe_id);
CREATE INDEX IF NOT EXISTS idx_scwep_user_id ON sc_world_event_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_scwep_points_gin ON sc_world_event_participation USING GIN(points);
