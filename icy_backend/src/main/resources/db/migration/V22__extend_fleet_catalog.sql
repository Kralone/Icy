ALTER TABLE fleet.user_ships
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN reward_in_game BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE fleet.ships
    ADD COLUMN notes TEXT;

CREATE TABLE fleet.ship_sale_points (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ship_id BIGINT NOT NULL,
    location VARCHAR(120) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ship_sale_points_ship
        FOREIGN KEY (ship_id) REFERENCES fleet.ships (id) ON DELETE CASCADE,
    CONSTRAINT uk_ship_sale_points_ship_location UNIQUE (ship_id, location)
);

CREATE INDEX idx_ship_sale_points_ship_id ON fleet.ship_sale_points (ship_id);

CREATE TABLE fleet.item_categories (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_item_categories_name UNIQUE (name)
);

CREATE TABLE fleet.items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(180) NOT NULL,
    manufacturer VARCHAR(120),
    image_url TEXT,
    description TEXT,
    stats TEXT,
    category_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_items_category
        FOREIGN KEY (category_id) REFERENCES fleet.item_categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_items_category_id ON fleet.items (category_id);
CREATE INDEX idx_items_name ON fleet.items (name);

CREATE TABLE fleet.ship_cargo_grids (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ship_id BIGINT NOT NULL,
    size_x INTEGER NOT NULL CHECK (size_x > 0),
    size_y INTEGER NOT NULL CHECK (size_y > 0),
    size_z INTEGER NOT NULL CHECK (size_z > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ship_cargo_grids_ship
        FOREIGN KEY (ship_id) REFERENCES fleet.ships(id) ON DELETE CASCADE
);

CREATE INDEX idx_ship_cargo_grids_ship_id
    ON fleet.ship_cargo_grids (ship_id);
