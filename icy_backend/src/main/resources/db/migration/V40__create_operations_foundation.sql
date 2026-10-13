-- Fondations du module Opérations.
-- Une opération est un événement d'un type particulier : la ligne de events.events porte le titre et les horaires,
-- events.operations porte le contenu propre à l'opération. Les événements existants restent des événements classiques.
ALTER TABLE events.events
    ADD COLUMN activity_type VARCHAR(20) NOT NULL DEFAULT 'EVENT';

ALTER TABLE events.events
    ADD CONSTRAINT events_activity_type_ck CHECK (activity_type IN ('EVENT', 'OPERATION'));

CREATE INDEX events_activity_type_idx ON events.events(activity_type);

CREATE TABLE events.operations (
    event_id UUID PRIMARY KEY REFERENCES events.events(id) ON DELETE CASCADE,
    briefing TEXT,
    meeting_point VARCHAR(255),
    publication_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT,
    allow_ship_proposals BOOLEAN NOT NULL DEFAULT FALSE,
    objectives TEXT,
    -- Compteur de modifications : refuse l'enregistrement d'une version périmée de l'éditeur.
    revision BIGINT NOT NULL DEFAULT 0,
    default_assignment_mode VARCHAR(20) NOT NULL DEFAULT 'FREE',
    CONSTRAINT operations_publication_status_ck CHECK (publication_status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT operations_default_assignment_mode_ck CHECK (default_assignment_mode IN ('FREE', 'VALIDATION', 'MANAGED'))
);

-- Une extension d'opération ne peut exister que pour un événement de type OPERATION.
CREATE FUNCTION events.ensure_operation_activity_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM events.events e WHERE e.id = NEW.event_id AND e.activity_type = 'OPERATION') THEN
        RAISE EXCEPTION 'operations.event_id must reference an OPERATION activity';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER operations_activity_type_guard
    BEFORE INSERT OR UPDATE ON events.operations
    FOR EACH ROW EXECUTE FUNCTION events.ensure_operation_activity_type();

-- Et un événement ne peut pas quitter le type OPERATION tant que son extension existe.
CREATE FUNCTION events.ensure_event_activity_type_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.activity_type <> 'OPERATION'
       AND EXISTS (SELECT 1 FROM events.operations o WHERE o.event_id = NEW.id) THEN
        RAISE EXCEPTION 'events.activity_type cannot leave OPERATION while an extension exists';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER events_activity_type_guard
    BEFORE UPDATE OF activity_type ON events.events
    FOR EACH ROW EXECUTE FUNCTION events.ensure_event_activity_type_consistency();
