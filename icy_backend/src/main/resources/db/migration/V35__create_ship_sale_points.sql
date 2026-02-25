CREATE TABLE IF NOT EXISTS fleet.ship_sale_points (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ship_id BIGINT NOT NULL,
    location VARCHAR(120) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ship_sale_points_ship
        FOREIGN KEY (ship_id) REFERENCES fleet.ships (id) ON DELETE CASCADE,
    CONSTRAINT uk_ship_sale_points_ship_location UNIQUE (ship_id, location)
);

CREATE INDEX IF NOT EXISTS idx_ship_sale_points_ship_id ON fleet.ship_sale_points (ship_id);

ALTER TABLE fleet.ships
    ADD COLUMN IF NOT EXISTS notes TEXT;
