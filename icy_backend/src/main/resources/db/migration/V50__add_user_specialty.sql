-- Sous-grade des Spécialistes : le pôle dont le membre est le référent.
-- Renseigné uniquement pour le grade SPECIALISTE (règle appliquée par le backend) ; NULL pour les autres grades
-- et pour les Spécialistes nommés avant cette version, à compléter depuis la page Membres.
ALTER TABLE core.users
    ADD COLUMN specialty VARCHAR(16),
    ADD CONSTRAINT ck_users_specialty CHECK (specialty IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'));

-- Actualités d'un pôle, publiées par ses référents, les Officiers ou les Administrateurs.
-- L'auteur reste affiché par son pseudo même si son compte est supprimé.
CREATE TABLE core.pole_news (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pole           VARCHAR(16)  NOT NULL,
    title          VARCHAR(120) NOT NULL,
    content        TEXT         NOT NULL,
    author_user_id UUID REFERENCES core.users (id) ON DELETE SET NULL,
    author_name    VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP    NOT NULL,
    updated_at     TIMESTAMP,
    CONSTRAINT ck_pole_news_pole CHECK (pole IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'))
);

CREATE INDEX idx_pole_news_pole_created_at ON core.pole_news (pole, created_at DESC);
