-- Un type d'événement encore utilisé ne peut pas être supprimé (clé étrangère events.event_type) :
-- on l'archive. Il disparaît des listes de création et reste affiché sur les événements existants.
-- Migration additive : aucune donnée existante n'est modifiée.
ALTER TABLE events.event_types
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
