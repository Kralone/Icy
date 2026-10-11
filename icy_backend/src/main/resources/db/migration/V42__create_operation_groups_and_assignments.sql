CREATE TABLE events.operation_groups (
    id BIGSERIAL PRIMARY KEY,
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES events.operation_groups(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
    assignment_mode VARCHAR(20) NOT NULL DEFAULT 'INHERITED',
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT operation_group_mode_ck CHECK (assignment_mode IN ('INHERITED', 'FREE', 'VALIDATION', 'MANAGED')),
    CONSTRAINT operation_group_name_uk UNIQUE (operation_event_id, parent_id, name)
);

CREATE INDEX operation_groups_operation_idx ON events.operation_groups(operation_event_id, sort_order);

CREATE TABLE events.operation_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES events.operation_groups(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_assignment_status_ck CHECK (status IN ('CONFIRMED', 'PENDING')),
    CONSTRAINT operation_assignment_user_uk UNIQUE (operation_event_id, user_id)
);

CREATE INDEX operation_assignments_group_idx ON events.operation_assignments(group_id, status);
