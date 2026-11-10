-- Banque de guilde : l'argent reste en jeu chez le trésorier, l'application en tient le registre.
-- Trésorier est une fonction qui s'ajoute au grade d'un membre, pas un grade.
INSERT INTO core.roles (name)
VALUES ('TRESORIER')
ON CONFLICT (name) DO NOTHING;

CREATE SCHEMA bank;

-- Projets financés par la banque (achat d'un vaisseau, d'un équipement…).
CREATE TABLE bank.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    target_amount BIGINT,
    ship_id BIGINT,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_by UUID NOT NULL REFERENCES core.users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bank_projects_status CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_bank_projects_target CHECK (target_amount IS NULL OR target_amount > 0)
);

-- Journal des mouvements. Une ligne ne se supprime pas : elle s'annule avec un motif et reste visible.
-- amount est toujours positif, sauf pour un ajustement où son signe donne le sens de la correction.
CREATE TABLE bank.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(16) NOT NULL,
    amount BIGINT NOT NULL,
    user_id UUID REFERENCES core.users(id),
    project_id UUID REFERENCES bank.projects(id),
    note VARCHAR(300),
    occurred_on DATE NOT NULL,
    recorded_by UUID NOT NULL REFERENCES core.users(id),
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES core.users(id),
    cancel_reason VARCHAR(300),
    CONSTRAINT ck_bank_entries_kind CHECK (kind IN ('DEPOSIT', 'EXPENSE', 'PAYOUT', 'ADJUSTMENT')),
    CONSTRAINT ck_bank_entries_amount CHECK ((kind = 'ADJUSTMENT' AND amount <> 0) OR (kind <> 'ADJUSTMENT' AND amount > 0)),
    CONSTRAINT ck_bank_entries_player CHECK (kind NOT IN ('DEPOSIT', 'PAYOUT') OR user_id IS NOT NULL),
    CONSTRAINT ck_bank_entries_cancel CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL) AND (cancelled_at IS NULL) = (cancel_reason IS NULL))
);

CREATE INDEX idx_bank_entries_occurred_on ON bank.entries(occurred_on);
CREATE INDEX idx_bank_entries_user_id ON bank.entries(user_id);
CREATE INDEX idx_bank_entries_project_id ON bank.entries(project_id);
