-- Création de la table brand
CREATE TABLE brand (
                       id BIGSERIAL PRIMARY KEY,
                       name VARCHAR(255) NOT NULL UNIQUE,
                       image_url TEXT
);

-- Ajout de la colonne brand_id à la table ships
ALTER TABLE ships ADD COLUMN brand_id INT;

-- Création de la contrainte FK entre ships et brand
ALTER TABLE ships
    ADD CONSTRAINT fk_ships_brand FOREIGN KEY (brand_id) REFERENCES brand(id);

-- Suppression de l'ancienne colonne brand dans ships
ALTER TABLE ships DROP COLUMN brand;
