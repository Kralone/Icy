-- Flotte d'une opération : besoins en vaisseaux exprimés par l'organisation, vaisseaux proposés par les membres.
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

-- Une proposition peut répondre à un besoin et désigner un pilote ; les deux liens sont facultatifs.
CREATE TABLE events.operation_ship_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_event_id UUID NOT NULL REFERENCES events.operations(event_id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES events.operation_groups(id) ON DELETE SET NULL,
    owner_user_id UUID NOT NULL,
    ship_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requirement_id UUID REFERENCES events.operation_ship_requirements(id) ON DELETE SET NULL,
    pilot_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    CONSTRAINT operation_ship_status_ck CHECK (status IN ('PROPOSED', 'ACCEPTED', 'DECLINED', 'UNAVAILABLE')),
    CONSTRAINT operation_ship_owner_fk FOREIGN KEY (owner_user_id) REFERENCES core.users(id),
    CONSTRAINT operation_ship_catalog_fk FOREIGN KEY (ship_id) REFERENCES catalog.entries(id),
    CONSTRAINT operation_ship_unique UNIQUE (operation_event_id, owner_user_id, ship_id)
);

CREATE INDEX operation_ship_proposals_requirement_idx ON events.operation_ship_proposals(requirement_id);
CREATE INDEX operation_ship_proposals_pilot_idx ON events.operation_ship_proposals(pilot_user_id);
