ALTER TABLE events.operations ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE OR REPLACE FUNCTION events.ensure_operation_activity_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM events.events e WHERE e.id = NEW.event_id AND e.activity_type = 'OPERATION') THEN
        RAISE EXCEPTION 'operations.event_id must reference an OPERATION activity';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operations_activity_type_guard ON events.operations;
CREATE TRIGGER operations_activity_type_guard
    BEFORE INSERT OR UPDATE ON events.operations
    FOR EACH ROW EXECUTE FUNCTION events.ensure_operation_activity_type();

CREATE OR REPLACE FUNCTION events.ensure_event_activity_type_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.activity_type <> 'OPERATION'
       AND EXISTS (SELECT 1 FROM events.operations o WHERE o.event_id = NEW.id) THEN
        RAISE EXCEPTION 'events.activity_type cannot leave OPERATION while an extension exists';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_activity_type_guard ON events.events;
CREATE TRIGGER events_activity_type_guard
    BEFORE UPDATE OF activity_type ON events.events
    FOR EACH ROW EXECUTE FUNCTION events.ensure_event_activity_type_consistency();
