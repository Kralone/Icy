-- Organisation d'une opération : groupes et sous-groupes, affectations des membres, demandes d'affectation.
CREATE TABLE events.operation_groups (
    id BIGSERIAL PRIMARY KEY,
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES events.operation_groups(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
    assignment_mode VARCHAR(20) NOT NULL DEFAULT 'INHERITED',
    sort_order INTEGER NOT NULL DEFAULT 0,
    responsible_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    CONSTRAINT operation_group_mode_ck CHECK (assignment_mode IN ('INHERITED', 'FREE', 'VALIDATION', 'MANAGED')),
    CONSTRAINT operation_group_name_uk UNIQUE (operation_event_id, parent_id, name)
);

CREATE INDEX operation_groups_operation_idx ON events.operation_groups(operation_event_id, sort_order);
CREATE INDEX operation_groups_responsible_idx ON events.operation_groups(responsible_user_id);

-- Un membre n'a qu'une affectation par opération.
CREATE TABLE events.operation_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES events.operation_groups(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_assignment_status_ck CHECK (status IN ('CONFIRMED', 'PENDING')),
    CONSTRAINT operation_assignment_user_uk UNIQUE (operation_event_id, user_id)
);

CREATE INDEX operation_assignments_group_idx ON events.operation_assignments(group_id, status);

CREATE TABLE events.operation_assignment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES events.operation_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_assignment_request_status_ck CHECK (status IN ('PENDING', 'APPROVED', 'REFUSED', 'CANCELLED'))
);

CREATE INDEX operation_assignment_requests_pending_idx ON events.operation_assignment_requests(operation_event_id, status);

-- Une seule demande en attente par membre et par opération ; l'historique des demandes traitées n'est pas limité.
CREATE UNIQUE INDEX operation_assignment_request_one_pending
    ON events.operation_assignment_requests(operation_event_id, user_id)
    WHERE status = 'PENDING';
