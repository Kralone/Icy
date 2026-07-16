CREATE SCHEMA mining;

CREATE TABLE mining.mining_sheets (
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

CREATE TABLE mining.mining_sheet_members (
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

CREATE INDEX idx_mining_sheet_members_sheet_id
    ON mining.mining_sheet_members (sheet_id);

CREATE INDEX idx_mining_sheet_members_user_id
    ON mining.mining_sheet_members (user_id);

CREATE TABLE mining.mining_sheet_jobs (
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

CREATE INDEX idx_mining_sheet_jobs_sheet_id
    ON mining.mining_sheet_jobs (sheet_id);

CREATE INDEX idx_mining_sheet_jobs_owner_user_id
    ON mining.mining_sheet_jobs (owner_user_id);

CREATE TABLE mining.mining_sheet_job_ores (
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

CREATE INDEX idx_mining_sheet_job_ores_job_id
    ON mining.mining_sheet_job_ores (job_id);

CREATE TABLE mining.mining_sheet_ships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL,
    ship_id BIGINT NOT NULL,
    added_by_user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mining_sheet_ships_sheet_ship_owner
        UNIQUE (sheet_id, ship_id, added_by_user_id),
    CONSTRAINT fk_mining_sheet_ships_sheet
        FOREIGN KEY (sheet_id) REFERENCES mining.mining_sheets(id) ON DELETE CASCADE,
    CONSTRAINT fk_mining_sheet_ships_ship
        FOREIGN KEY (ship_id) REFERENCES fleet.ships(id),
    CONSTRAINT fk_mining_sheet_ships_added_by
        FOREIGN KEY (added_by_user_id) REFERENCES core.users(id)
);

CREATE INDEX idx_mining_sheet_ships_sheet_id
    ON mining.mining_sheet_ships (sheet_id);

CREATE INDEX idx_mining_sheet_ships_ship_id
    ON mining.mining_sheet_ships (ship_id);

CREATE INDEX idx_mining_sheet_ships_added_by_user_id
    ON mining.mining_sheet_ships (added_by_user_id);

CREATE TABLE mining.mining_sheet_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL,
    declared_by_user_id UUID NOT NULL,
    credit_auec BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mining_sheet_sales_credit
        CHECK (credit_auec > 0),
    CONSTRAINT fk_mining_sheet_sales_sheet
        FOREIGN KEY (sheet_id) REFERENCES mining.mining_sheets(id) ON DELETE CASCADE,
    CONSTRAINT fk_mining_sheet_sales_declared_by
        FOREIGN KEY (declared_by_user_id) REFERENCES core.users(id)
);

CREATE INDEX idx_mining_sheet_sales_sheet_id
    ON mining.mining_sheet_sales (sheet_id);

CREATE INDEX idx_mining_sheet_sales_declared_by_user_id
    ON mining.mining_sheet_sales (declared_by_user_id);
