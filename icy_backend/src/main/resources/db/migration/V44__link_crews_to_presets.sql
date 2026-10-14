-- Un équipage créé à partir d'un preset en garde le lien : modifier le preset met à jour les équipages des opérations à venir.
-- Les équipages existants restent sans lien (copie indépendante, comme avant). Supprimer un preset ne supprime aucun équipage.
ALTER TABLE events.operation_groups
    ADD COLUMN crew_preset_id UUID REFERENCES events.operation_crew_presets(id) ON DELETE SET NULL;

CREATE INDEX operation_groups_crew_preset_idx ON events.operation_groups(crew_preset_id) WHERE crew_preset_id IS NOT NULL;
