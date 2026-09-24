CREATE TABLE content_guides (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(500),
    content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    published BOOLEAN NOT NULL DEFAULT FALSE,
    game_version VARCHAR(40),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_guides_public_idx ON content_guides (published, updated_at DESC);

INSERT INTO content_guides (slug, title, summary, content, status, published, game_version)
VALUES
 ('minage-star-citizen', 'Guide Minage Star Citizen', 'Scan, fracture, extraction, raffinage et vente.', '{"sections": []}', 'WRITING', TRUE, 'Alpha 4.9'),
 ('salvage', 'Guide Salvage', 'Tri des coques, extraction et revente sécurisée.', '{"sections": []}', 'LIVE', TRUE, 'Alpha 4.9'),
 ('minage-confirmed', 'Guide Minage avancé', 'Réglages experts, gadgets, risques et pipeline de production.', '{"sections": []}', 'LIVE', TRUE, 'Alpha 4.9'),
 ('hathor', 'Guide Hathor', 'Préparation, trajet OLP, extraction de Carinite et sécurisation PvP.', '{"sections": []}', 'LIVE', TRUE, 'Alpha 4.9');
