-- ============================================================
-- V20__add_image_categories.sql
-- Image library taxonomy + tags (merged migrations >= V20)
-- ============================================================

ALTER TABLE IF EXISTS media.image_metadata
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE INDEX IF NOT EXISTS idx_image_category ON media.image_metadata(category);
CREATE INDEX IF NOT EXISTS idx_image_subcategory ON media.image_metadata(subcategory);

CREATE TABLE IF NOT EXISTS media.image_tag (
                                              name  TEXT PRIMARY KEY,
                                              color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media.image_category (
                                                   name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS media.image_subcategory (
                                                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                                      category_name TEXT NOT NULL REFERENCES media.image_category(name) ON DELETE CASCADE,
                                                      name TEXT NOT NULL,
                                                      CONSTRAINT uq_image_subcategory UNIQUE (category_name, name)
);

CREATE INDEX IF NOT EXISTS idx_image_subcategory_category ON media.image_subcategory(category_name);

INSERT INTO media.image_category(name)
SELECT DISTINCT category
FROM media.image_metadata
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT DO NOTHING;

INSERT INTO media.image_subcategory(category_name, name)
SELECT DISTINCT category, subcategory
FROM media.image_metadata
WHERE category IS NOT NULL AND category <> '' AND subcategory IS NOT NULL AND subcategory <> ''
ON CONFLICT DO NOTHING;
