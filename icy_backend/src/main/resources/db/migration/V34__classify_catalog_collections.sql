ALTER TABLE catalog.entries
    ADD COLUMN catalog_group VARCHAR(24) NOT NULL DEFAULT 'STANDARD';

UPDATE catalog.entries
SET catalog_group = CASE
    WHEN LOWER(name) LIKE '%wikelo%' THEN 'WIKELO'
    WHEN family = 'SHIP' AND LOWER(name) ~ 'pyam[[:space:]]+exec$' THEN 'PYAM_EXEC'
    WHEN family = 'SHIP' AND LOWER(name) ~ '[[:space:]]+alliance$' THEN 'BATTAGLIA'
    ELSE 'STANDARD'
END;

ALTER TABLE catalog.entries
    ADD CONSTRAINT chk_catalog_entry_group
        CHECK (catalog_group IN ('STANDARD', 'WIKELO', 'PYAM_EXEC', 'BATTAGLIA'));

CREATE INDEX idx_catalog_entries_group_family
    ON catalog.entries (catalog_group, family, active, name);
