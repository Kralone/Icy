CREATE TABLE icelink_block (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    description VARCHAR(255),
    headline VARCHAR(255) NOT NULL DEFAULT '---'
);
