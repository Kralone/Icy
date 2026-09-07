ALTER TABLE catalog.canonical_selections
    DROP CONSTRAINT canonical_selections_pkey;

ALTER TABLE catalog.canonical_selections
    ADD CONSTRAINT canonical_selections_pkey
        PRIMARY KEY (source, dataset_key, canonical_key, selected_external_id);

CREATE TABLE catalog.sync_conflict_selections (
    conflict_id BIGINT NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (conflict_id, external_id),
    CONSTRAINT fk_catalog_sync_conflict_selection_candidate
        FOREIGN KEY (conflict_id, external_id)
        REFERENCES catalog.sync_conflict_candidates (conflict_id, external_id)
        ON DELETE CASCADE
);

INSERT INTO catalog.sync_conflict_selections (conflict_id, external_id)
SELECT id, selected_external_id
FROM catalog.sync_conflicts
WHERE status = 'RESOLVED'
  AND selected_external_id IS NOT NULL
ON CONFLICT DO NOTHING;
