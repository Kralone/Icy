ALTER TABLE events.operation_ship_proposals
    ADD COLUMN requirement_id UUID REFERENCES events.operation_ship_requirements(id) ON DELETE SET NULL;

CREATE INDEX operation_ship_proposals_requirement_idx
    ON events.operation_ship_proposals(requirement_id);
