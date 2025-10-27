-- ============================================================
-- V17__create_image_table.sql
-- Table de bibliothèque d’images (ImageMetadata)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS image_metadata (
                                              id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                              name            VARCHAR(255) NOT NULL,
                                              url             VARCHAR(512) NOT NULL,
                                              size            BIGINT NOT NULL,
                                              uploaded_at     TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

                                              uploader_id     UUID NULL,
                                              uploaded_by     VARCHAR(255) NULL,

                                              description     TEXT NULL,
                                              tags            TEXT[] NULL,

                                              CONSTRAINT uq_image_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_image_uploaded_at ON image_metadata(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_name ON image_metadata(name);
