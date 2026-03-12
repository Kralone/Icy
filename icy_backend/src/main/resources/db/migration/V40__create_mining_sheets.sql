CREATE SCHEMA IF NOT EXISTS mining;

CREATE TABLE IF NOT EXISTS mining.mining_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_name VARCHAR(180) NOT NULL,
    operation_date DATE NOT NULL,
    refinery_location VARCHAR(180) NOT NULL,
    sale_location VARCHAR(180),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mining_sheets_status
        CHECK (status IN ('OPEN', 'LOCKED', 'FINALIZED')),
    CONSTRAINT fk_mining_sheets_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES core.users(id)
);

CREATE TABLE IF NOT EXISTS mining.mining_sheet_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mining_sheet_members_sheet_user UNIQUE (sheet_id, user_id),
    CONSTRAINT fk_mining_sheet_members_sheet
        FOREIGN KEY (sheet_id) REFERENCES mining.mining_sheets(id) ON DELETE CASCADE,
    CONSTRAINT fk_mining_sheet_members_user
        FOREIGN KEY (user_id) REFERENCES core.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_members_sheet_id
    ON mining.mining_sheet_members (sheet_id);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_members_user_id
    ON mining.mining_sheet_members (user_id);

CREATE TABLE IF NOT EXISTS mining.mining_sheet_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL,
    refinery_method VARCHAR(120),
    duration_minutes INTEGER,
    cost_auec INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP,
    finish_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mining_sheet_jobs_type
        CHECK (type IN ('REFINERY', 'FUEL', 'REPAIR', 'MATERIAL')),
    CONSTRAINT chk_mining_sheet_jobs_duration
        CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CONSTRAINT chk_mining_sheet_jobs_cost
        CHECK (cost_auec >= 0),
    CONSTRAINT fk_mining_sheet_jobs_sheet
        FOREIGN KEY (sheet_id) REFERENCES mining.mining_sheets(id) ON DELETE CASCADE,
    CONSTRAINT fk_mining_sheet_jobs_owner
        FOREIGN KEY (owner_user_id) REFERENCES core.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_jobs_sheet_id
    ON mining.mining_sheet_jobs (sheet_id);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_jobs_owner_user_id
    ON mining.mining_sheet_jobs (owner_user_id);

CREATE TABLE IF NOT EXISTS mining.mining_sheet_job_ores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    ore_name VARCHAR(120) NOT NULL,
    quantity_cscu NUMERIC(14, 4) NOT NULL,
    include_in_sale BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mining_sheet_job_ores_quantity
        CHECK (quantity_cscu >= 0),
    CONSTRAINT fk_mining_sheet_job_ores_job
        FOREIGN KEY (job_id) REFERENCES mining.mining_sheet_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_job_ores_job_id
    ON mining.mining_sheet_job_ores (job_id);

ALTER TABLE IF EXISTS mining.mining_sheets
    ADD COLUMN IF NOT EXISTS sheet_name VARCHAR(180);

ALTER TABLE IF EXISTS mining.mining_sheets
    ADD COLUMN IF NOT EXISTS sale_location VARCHAR(180);

ALTER TABLE IF EXISTS mining.mining_sheet_job_ores
    ADD COLUMN IF NOT EXISTS include_in_sale BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE mining.mining_sheet_job_ores
SET include_in_sale = TRUE
WHERE include_in_sale IS NULL;

UPDATE mining.mining_sheets
SET sheet_name = CONCAT('Fiche ', TO_CHAR(created_at, 'DD/MM HH24:MI'))
WHERE sheet_name IS NULL OR BTRIM(sheet_name) = '';

ALTER TABLE IF EXISTS mining.mining_sheets
    ALTER COLUMN sheet_name SET NOT NULL;
