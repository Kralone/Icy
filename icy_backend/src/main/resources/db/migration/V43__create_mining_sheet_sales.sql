CREATE TABLE IF NOT EXISTS mining.mining_sheet_sales (
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

CREATE INDEX IF NOT EXISTS idx_mining_sheet_sales_sheet_id
    ON mining.mining_sheet_sales (sheet_id);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_sales_declared_by_user_id
    ON mining.mining_sheet_sales (declared_by_user_id);
