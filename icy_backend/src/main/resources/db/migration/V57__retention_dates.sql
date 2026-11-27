-- Dates nécessaires aux durées de conservation annoncées dans la politique de confidentialité.
-- Les valeurs existantes partent d'aujourd'hui : aucune donnée n'est purgée au déploiement.

ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS temp_password_issued_at TIMESTAMP;

-- Les mots de passe temporaires déjà envoyés expirent 72 h après le déploiement.
UPDATE core.users SET temp_password_issued_at = NOW() WHERE pwd_reset IS TRUE AND temp_password_issued_at IS NULL;

UPDATE core.users SET deactivated_at = NOW() WHERE active IS FALSE AND deactivated_at IS NULL;

CREATE OR REPLACE FUNCTION core.track_user_deactivation() RETURNS trigger AS $$
BEGIN
    IF NEW.active IS FALSE AND OLD.active IS DISTINCT FROM FALSE THEN
        NEW.deactivated_at := NOW();
    ELSIF NEW.active IS TRUE THEN
        NEW.deactivated_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_deactivated_at ON core.users;
CREATE TRIGGER trg_users_deactivated_at
    BEFORE UPDATE OF active ON core.users
    FOR EACH ROW EXECUTE FUNCTION core.track_user_deactivation();

ALTER TABLE recruitment.recruitment
    ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

UPDATE recruitment.recruitment SET decided_at = NOW() WHERE status <> 'PENDING' AND decided_at IS NULL;

CREATE OR REPLACE FUNCTION recruitment.track_recruitment_decision() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'PENDING' THEN
        NEW.decided_at := NULL;
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.decided_at IS NULL THEN
        NEW.decided_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recruitment_decided_at ON recruitment.recruitment;
CREATE TRIGGER trg_recruitment_decided_at
    BEFORE INSERT OR UPDATE OF status ON recruitment.recruitment
    FOR EACH ROW EXECUTE FUNCTION recruitment.track_recruitment_decision();

-- Effacements faits à la demande d'un membre. Après la restauration d'une sauvegarde plus ancienne,
-- les effacements postérieurs sont refaits à partir du registre tenu hors du serveur (docs/rgpd).
CREATE TABLE IF NOT EXISTS core.erasure_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES core.users (id),
    requested_by UUID REFERENCES core.users (id) ON DELETE SET NULL,
    erased_at TIMESTAMP NOT NULL DEFAULT NOW()
);
