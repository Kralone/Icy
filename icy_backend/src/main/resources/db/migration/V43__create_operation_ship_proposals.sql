CREATE TABLE events.operation_ship_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES events.operation_groups(id) ON DELETE SET NULL,
    owner_user_id UUID NOT NULL,
    ship_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT operation_ship_status_ck CHECK (status IN ('PROPOSED', 'ACCEPTED', 'DECLINED', 'UNAVAILABLE')),
    CONSTRAINT operation_ship_owner_fk FOREIGN KEY (owner_user_id, ship_id) REFERENCES fleet.user_ships(user_id, ship_id),
    CONSTRAINT operation_ship_unique UNIQUE (operation_event_id, owner_user_id, ship_id)
);
