CREATE TABLE template (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  archetype VARCHAR(32) NOT NULL,
  axis_x JSONB NOT NULL,
  axis_y JSONB NOT NULL,
  defaults JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_template_archetype ON template(archetype);

CREATE TABLE user_collection (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  template_id BIGINT NOT NULL REFERENCES template(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  checked JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_user_collection_user ON user_collection(user_id);