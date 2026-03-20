CREATE TABLE IF NOT EXISTS fleet.ship_cargo_grids (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ship_id BIGINT NOT NULL,
    grid_name VARCHAR(120),
    size_x INTEGER NOT NULL CHECK (size_x > 0),
    size_y INTEGER NOT NULL CHECK (size_y > 0),
    size_z INTEGER NOT NULL CHECK (size_z > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ship_cargo_grids_ship
        FOREIGN KEY (ship_id) REFERENCES fleet.ships(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ship_cargo_grids_ship_id
    ON fleet.ship_cargo_grids (ship_id);

CREATE TABLE IF NOT EXISTS mining.mining_sheet_ships (
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

CREATE INDEX IF NOT EXISTS idx_mining_sheet_ships_sheet_id
    ON mining.mining_sheet_ships (sheet_id);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_ships_ship_id
    ON mining.mining_sheet_ships (ship_id);

CREATE INDEX IF NOT EXISTS idx_mining_sheet_ships_added_by_user_id
    ON mining.mining_sheet_ships (added_by_user_id);
