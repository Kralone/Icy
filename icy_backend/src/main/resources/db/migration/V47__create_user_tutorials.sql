-- Tutoriels d'interface vus par chaque joueur : la version permet de reproposer un tutoriel modifié.
CREATE TABLE core.user_tutorials (
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    tutorial_id VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_user_tutorials PRIMARY KEY (user_id, tutorial_id),
    CONSTRAINT ck_user_tutorials_status CHECK (status IN ('COMPLETED', 'DISMISSED')),
    CONSTRAINT ck_user_tutorials_version CHECK (version > 0)
);
