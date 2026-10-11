CREATE TABLE events.operation_ship_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES events.operation_groups(id) ON DELETE SET NULL,
    ship_model_id BIGINT REFERENCES catalog.entries(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT operation_ship_requirement_quantity_ck CHECK (quantity BETWEEN 1 AND 100),
    CONSTRAINT operation_ship_requirement_status_ck CHECK (status IN ('OPEN', 'FULFILLED', 'CANCELLED'))
);
CREATE INDEX operation_ship_requirements_operation_idx ON events.operation_ship_requirements(operation_event_id);
