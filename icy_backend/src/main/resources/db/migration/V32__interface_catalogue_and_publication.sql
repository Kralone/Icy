-- Single release migration from production/staging V31.

-- V32__cig_watch_publication_pipeline
-- Existing entries are historical imports, never a batch of Discord announcements.
ALTER TABLE news.cig_watch_entries
    ADD COLUMN translation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_retry_at TIMESTAMPTZ,
    ADD COLUMN last_error VARCHAR(300),
    ADD COLUMN news_id BIGINT UNIQUE REFERENCES news.news(id) ON DELETE SET NULL,
    ADD COLUMN delivery_status VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
    ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN delivery_retry_at TIMESTAMPTZ;

-- Old FR columns are retained, but PENDING prevents trusting the former English fallback.
CREATE INDEX idx_cig_watch_retry ON news.cig_watch_entries (next_retry_at) WHERE translation_status <> 'TRANSLATED';
INSERT INTO news.news_type(name, color, image_url)
VALUES ('CIG Watch', '#67e8f9', '') ON CONFLICT (name) DO NOTHING;

CREATE TABLE news.cig_watch_fetch_state (
    source_id BIGINT PRIMARY KEY,
    last_fetched_at TIMESTAMPTZ NOT NULL
);


-- V33__wikelo_equipment_recipes
CREATE TABLE catalog.wikelo_equipment_recipes (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_run_id BIGINT NOT NULL
);
COMMENT ON TABLE catalog.wikelo_equipment_recipes IS 'Published equipment recipes; raw WIKELO/equipment_recipes remains separate until validated publication';


-- V34__news_article_image
-- V13 already created this column; widen it without losing existing article images.
ALTER TABLE news.news ALTER COLUMN image_url TYPE TEXT;
COMMENT ON COLUMN news.news.image_url IS 'Optional article-specific source image; news type image remains the fallback';


-- V35__reconcile_vehicle_cargo_capacity
-- V31 preserved legacy SCU values while importing each vehicle's newer source payload.
-- Reconcile only the exact published vehicle; never borrow a base variant or mining capacity.
WITH capacities AS (
    SELECT id,
           CASE WHEN jsonb_typeof(source_payload->'cargo_capacity') = 'number' THEN
               CASE WHEN (source_payload->>'cargo_capacity')::numeric BETWEEN 0 AND 2147483647
                         AND (source_payload->>'cargo_capacity')::numeric = trunc((source_payload->>'cargo_capacity')::numeric)
                    THEN (source_payload->>'cargo_capacity')::numeric::integer
                    ELSE NULL END
               ELSE NULL END AS source_scu
    FROM catalog.entries
    WHERE source = 'STAR_CITIZEN_WIKI'
      AND dataset_key = 'vehicles'
      AND family IN ('SHIP', 'GROUND_VEHICLE')
)
UPDATE catalog.entries e
SET scu = c.source_scu
FROM capacities c
WHERE e.id = c.id AND e.scu IS DISTINCT FROM c.source_scu;


-- V36__expose_vehicle_ore_capacity
-- Derive ore storage from the exact published payload; no duplicated stored capacity.
-- Append the column to preserve the names/order of all existing view columns.
CREATE OR REPLACE VIEW catalog.ship_compat AS
SELECT e.id, e.name, b.id AS brand_id, e.focus, e.scu, e.size, e.crew,
       COALESCE(e.flight_ready, FALSE) AS flight_ready,
       e.image_url, e.description AS notes,
       CASE WHEN jsonb_typeof(e.source_payload->'ore_capacity') = 'number' THEN
           CASE WHEN (e.source_payload->>'ore_capacity')::numeric BETWEEN 0 AND 2147483647
                     AND (e.source_payload->>'ore_capacity')::numeric = trunc((e.source_payload->>'ore_capacity')::numeric)
                THEN (e.source_payload->>'ore_capacity')::numeric::integer
                ELSE NULL END
           ELSE NULL END AS ore_capacity
FROM catalog.entries e
JOIN fleet.brand b
  ON lower(trim(b.name)) = lower(trim(CASE
      WHEN e.manufacturer = 'Musashi Industrial and Starflight Concern' THEN 'MISC'
      ELSE e.manufacturer
  END))
WHERE e.active AND e.family IN ('SHIP', 'GROUND_VEHICLE');
COMMENT ON COLUMN catalog.ship_compat.ore_capacity IS 'Ore storage SCU from source payload, distinct from commercial cargo SCU; unknown remains NULL';


-- V37__link_misc_vehicle_market_offers
-- Link only previously unlinked vehicle offers to a unique, exact MISC-prefixed name.
-- Never replace an existing UUID/name match, remove a variant suffix, or alter prices.
WITH matches AS (
    SELECT o.id AS offer_id, MIN(e.id) AS entry_id
    FROM catalog.offers o
    JOIN catalog.entries e
      ON LOWER(e.name) = LOWER('MISC ' || o.entity_name)
     AND e.source = 'STAR_CITIZEN_WIKI'
     AND e.active = TRUE AND e.family = 'SHIP'
     AND e.manufacturer = 'Musashi Industrial and Starflight Concern'
    WHERE o.source = 'UEX' AND o.active = TRUE AND o.entry_id IS NULL
      AND (o.external_id LIKE 'vehicles_purchases_prices:%' OR o.external_id LIKE 'vehicles_rentals_prices:%')
      AND NOT EXISTS (SELECT 1 FROM catalog.entries exact
                      WHERE (exact.source = 'STAR_CITIZEN_WIKI' AND exact.external_id = o.entity_external_id)
                         OR (exact.active = TRUE AND LOWER(exact.name) = LOWER(o.entity_name)))
    GROUP BY o.id
    HAVING COUNT(*) = 1
)
UPDATE catalog.offers o SET entry_id = m.entry_id
FROM matches m WHERE o.id = m.offer_id AND o.entry_id IS NULL;


-- Persistent catalogue corrections
-- Fold into the single coordinated migration; do not execute independently.
ALTER TABLE catalog.entries ADD COLUMN source_image_url text,
 ADD COLUMN source_image_is_fallback boolean NOT NULL DEFAULT true,
 ADD COLUMN image_override_url text;
UPDATE catalog.entries SET source_image_url=image_url, source_image_is_fallback=image_is_fallback;
ALTER TABLE catalog.offers ADD COLUMN source_entry_id bigint REFERENCES catalog.entries(id) ON DELETE SET NULL,
 ADD COLUMN entry_override_id bigint REFERENCES catalog.entries(id) ON DELETE SET NULL;
UPDATE catalog.offers SET source_entry_id=entry_id;
CREATE INDEX catalog_offers_unassociated_idx ON catalog.offers(id) WHERE active AND entry_id IS NULL;
