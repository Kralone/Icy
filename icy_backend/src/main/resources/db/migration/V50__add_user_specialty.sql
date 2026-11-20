-- Sous-grade des Spécialistes : le pôle dont le membre est le référent.
-- Renseigné uniquement pour le grade SPECIALISTE (règle appliquée par le backend) ; NULL pour les autres grades.
ALTER TABLE core.users
    ADD COLUMN specialty VARCHAR(16),
    ADD CONSTRAINT ck_users_specialty CHECK (specialty IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'));

-- Un Spécialiste nommé avant cette version n'a pas de pôle : il repasse au grade précédent, Ingénieur.
-- Il retrouvera le grade Spécialiste quand un pôle lui sera attribué depuis la page Membres.
UPDATE core.user_roles ur
SET role_id = (SELECT id FROM core.roles WHERE name = 'INGENIEUR')
WHERE ur.role_id = (SELECT id FROM core.roles WHERE name = 'SPECIALISTE')
  AND NOT EXISTS (SELECT 1 FROM core.user_roles other
                  WHERE other.user_id = ur.user_id
                    AND other.role_id = (SELECT id FROM core.roles WHERE name = 'INGENIEUR'));

DELETE FROM core.user_roles
WHERE role_id = (SELECT id FROM core.roles WHERE name = 'SPECIALISTE');

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

-- Pôle auquel un événement ou une opération est rattaché, pour l'afficher sur la page du pôle. Facultatif.
ALTER TABLE events.events
    ADD COLUMN pole VARCHAR(16),
    ADD CONSTRAINT ck_events_pole CHECK (pole IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'));

CREATE INDEX idx_events_pole_end ON events.events (pole, end_date_time) WHERE pole IS NOT NULL;

-- Pôle auquel un objectif principal est rattaché, pour l'afficher sur la page du pôle. Facultatif ; ses étapes le suivent.
ALTER TABLE goals.goals
    ADD COLUMN pole VARCHAR(16),
    ADD CONSTRAINT ck_goals_pole CHECK (pole IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'));

CREATE INDEX idx_goals_pole ON goals.goals (pole) WHERE pole IS NOT NULL;
