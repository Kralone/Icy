-- Avertissements disciplinaires donnés à un membre par un Officier ou un Directeur.
-- rank est la position de l'avertissement parmi les avertissements en cours au moment où il est donné (1er, 2e, 3e…).
-- Un avertissement levé reste dans l'historique mais ne compte plus.
-- dm_status suit le message privé envoyé par le bot : PENDING (en cours), SENT (reçu par Discord), FAILED (refusé).
CREATE TABLE core.member_warnings (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           UUID         NOT NULL REFERENCES core.users (id) ON DELETE CASCADE,
    category          VARCHAR(16)  NOT NULL,
    reason            TEXT         NOT NULL,
    rank              INTEGER      NOT NULL,
    issued_by_user_id UUID REFERENCES core.users (id) ON DELETE SET NULL,
    issued_by_name    VARCHAR(255) NOT NULL,
    created_at        TIMESTAMP    NOT NULL,
    revoked_at        TIMESTAMP,
    revoked_by_name   VARCHAR(255),
    revoke_reason     VARCHAR(500),
    dm_delivery_id    UUID,
    dm_status         VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    dm_failure        VARCHAR(32),
    CONSTRAINT ck_member_warnings_category CHECK (category IN ('COMPORTEMENT', 'REGLEMENT', 'ABSENCE', 'OPERATION', 'AUTRE')),
    CONSTRAINT ck_member_warnings_rank CHECK (rank >= 1),
    CONSTRAINT ck_member_warnings_dm_status CHECK (dm_status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_member_warnings_user_created ON core.member_warnings (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_member_warnings_delivery ON core.member_warnings (dm_delivery_id) WHERE dm_delivery_id IS NOT NULL;

-- Décision d'un Directeur quand un membre atteint le seuil d'avertissements :
-- EXCLUDE désactive le compte du site (le ban Discord se fait à la main, discord_ban_done_at le confirme),
-- KEEP laisse une dernière chance ; un nouvel avertissement rouvre alors la décision.
CREATE TABLE core.member_sanctions (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                UUID         NOT NULL REFERENCES core.users (id) ON DELETE CASCADE,
    decision               VARCHAR(16)  NOT NULL,
    note                   VARCHAR(1000),
    decided_by_user_id     UUID REFERENCES core.users (id) ON DELETE SET NULL,
    decided_by_name        VARCHAR(255) NOT NULL,
    created_at             TIMESTAMP    NOT NULL,
    discord_ban_done_at    TIMESTAMP,
    discord_ban_done_by    VARCHAR(255),
    dm_delivery_id         UUID,
    dm_status              VARCHAR(16),
    dm_failure             VARCHAR(32),
    CONSTRAINT ck_member_sanctions_decision CHECK (decision IN ('EXCLUDE', 'KEEP')),
    CONSTRAINT ck_member_sanctions_dm_status CHECK (dm_status IS NULL OR dm_status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_member_sanctions_user_created ON core.member_sanctions (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_member_sanctions_delivery ON core.member_sanctions (dm_delivery_id) WHERE dm_delivery_id IS NOT NULL;
