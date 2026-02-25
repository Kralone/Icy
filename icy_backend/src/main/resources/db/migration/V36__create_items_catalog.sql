CREATE TABLE IF NOT EXISTS fleet.item_categories (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_item_categories_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS fleet.items (
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

CREATE INDEX IF NOT EXISTS idx_items_category_id ON fleet.items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON fleet.items (name);
