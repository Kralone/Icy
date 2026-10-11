CREATE TABLE events.operation_assignment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES events.operation_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_assignment_request_status_ck CHECK (status IN ('PENDING', 'APPROVED', 'REFUSED', 'CANCELLED')),
    CONSTRAINT operation_assignment_request_one_active UNIQUE (operation_event_id, user_id, status)
);

CREATE INDEX operation_assignment_requests_pending_idx ON events.operation_assignment_requests(operation_event_id, status);
