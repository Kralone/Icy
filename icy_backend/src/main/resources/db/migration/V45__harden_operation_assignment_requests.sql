ALTER TABLE events.operation_assignment_requests DROP CONSTRAINT IF EXISTS operation_assignment_request_one_active;
CREATE UNIQUE INDEX operation_assignment_request_one_pending
    ON events.operation_assignment_requests(operation_event_id, user_id)
    WHERE status = 'PENDING';
