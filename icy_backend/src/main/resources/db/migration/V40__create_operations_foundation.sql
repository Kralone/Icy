ALTER TABLE events.events
    ADD COLUMN IF NOT EXISTS activity_type VARCHAR(20) NOT NULL DEFAULT 'EVENT';

ALTER TABLE events.events
    ADD CONSTRAINT events_activity_type_ck CHECK (activity_type IN ('EVENT', 'OPERATION'));

CREATE TABLE IF NOT EXISTS events.operations (
    event_id UUID PRIMARY KEY REFERENCES events.events(id) ON DELETE CASCADE,
    briefing TEXT,
    meeting_point VARCHAR(255),
    publication_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operations_publication_status_ck CHECK (publication_status IN ('DRAFT', 'PUBLISHED'))
);

CREATE INDEX IF NOT EXISTS events_activity_type_idx ON events.events(activity_type);
