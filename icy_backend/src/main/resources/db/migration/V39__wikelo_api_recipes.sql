-- These are imported offers, not user goals or participation data.
-- Retire the previous source; the next Wikelo sync publishes API contracts.
DELETE FROM utils.wikelo_ships;
DELETE FROM catalog.raw_records WHERE source = 'WIKELO' AND dataset_key = 'offers';

ALTER TABLE utils.wikelo_ships
    DROP CONSTRAINT wikelo_ships_ship_name_key,
    DROP COLUMN source_sheet,
    ADD COLUMN source_version VARCHAR(120) NOT NULL,
    ADD COLUMN mission_id VARCHAR(36) NOT NULL,
    ADD COLUMN reward_uuid VARCHAR(36) NOT NULL,
    ADD COLUMN rewards_text TEXT,
    ADD COLUMN reward_manufacturer VARCHAR(255),
    ADD COLUMN reward_image_url TEXT,
    ADD CONSTRAINT wikelo_ships_contract_reward_key UNIQUE (mission_id, reward_uuid);
