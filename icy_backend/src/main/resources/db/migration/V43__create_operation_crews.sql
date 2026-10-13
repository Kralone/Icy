-- Équipages de vaisseau, postes et presets.
-- Un équipage est une spécialisation facultative d'un groupe : tous les groupes existants restent STANDARD.
ALTER TABLE events.operation_groups
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN ship_model_id BIGINT REFERENCES catalog.entries(id) ON DELETE SET NULL,
    ADD COLUMN ship_model_name VARCHAR(200),
    ADD COLUMN position_mode VARCHAR(20) NOT NULL DEFAULT 'SELF',
    ADD CONSTRAINT operation_group_kind_ck CHECK (kind IN ('STANDARD', 'CREW')),
    ADD CONSTRAINT operation_group_position_mode_ck CHECK (position_mode IN ('SELF', 'MANAGED'));

-- Postes facultatifs d'un équipage ; la capacité d'un poste est elle aussi facultative.
CREATE TABLE events.operation_group_positions (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES events.operation_groups(id) ON DELETE CASCADE,
    label VARCHAR(80) NOT NULL,
    icon VARCHAR(40),
    capacity INTEGER CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 1000),
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT operation_group_position_label_uk UNIQUE (group_id, label)
);

CREATE INDEX operation_group_positions_group_idx ON events.operation_group_positions(group_id, sort_order);

-- Le poste est un attribut de l'affectation principale : jamais une seconde affectation. Les affectations existantes restent sans poste.
ALTER TABLE events.operation_assignments
    ADD COLUMN position_id BIGINT REFERENCES events.operation_group_positions(id) ON DELETE SET NULL;

CREATE INDEX operation_assignments_position_idx ON events.operation_assignments(position_id);

-- Bibliothèque de presets d'équipage, gérée par les administrateurs. Un preset est copié dans l'opération : aucune opération ne le référence.
CREATE TABLE events.operation_crew_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    ship_model_id BIGINT REFERENCES catalog.entries(id) ON DELETE SET NULL,
    ship_model_name VARCHAR(200) NOT NULL,
    capacity INTEGER CHECK (capacity IS NULL OR capacity BETWEEN 0 AND 10000),
    position_mode VARCHAR(20) NOT NULL DEFAULT 'SELF',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT operation_crew_preset_position_mode_ck CHECK (position_mode IN ('SELF', 'MANAGED'))
);

CREATE INDEX operation_crew_presets_model_idx ON events.operation_crew_presets(ship_model_id, archived);

CREATE TABLE events.operation_crew_preset_positions (
    id BIGSERIAL PRIMARY KEY,
    preset_id UUID NOT NULL REFERENCES events.operation_crew_presets(id) ON DELETE CASCADE,
    label VARCHAR(80) NOT NULL,
    icon VARCHAR(40),
    capacity INTEGER CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 1000),
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT operation_crew_preset_position_label_uk UNIQUE (preset_id, label)
);
