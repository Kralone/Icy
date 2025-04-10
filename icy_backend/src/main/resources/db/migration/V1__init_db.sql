-- Création des tables pour la base de données IceForge

CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       username VARCHAR(50) NOT NULL,
                       discord_id BIGINT UNIQUE NOT NULL,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                       password VARCHAR(255) NOT NULL,
                       active BOOLEAN DEFAULT TRUE
);

CREATE TABLE ships (
                       id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                       name VARCHAR(100) NOT NULL,
                       brand VARCHAR(50) NOT NULL,
                       focus VARCHAR(100),
                       scu INT,
                       size VARCHAR(50),
                       crew VARCHAR(5),
                       flight_ready BOOLEAN DEFAULT FALSE,
                       image_url TEXT
);

CREATE TABLE user_ships (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                            ship_id BIGINT REFERENCES ships(id) ON DELETE CASCADE,
                            acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);