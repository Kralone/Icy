-- Une opération ou un événement peut concerner plusieurs pôles : il s'affiche sur la page de chacun.
-- Les rattachements existants (colonne events.pole) sont repris tels quels.
CREATE TABLE events.event_poles (
    event_id UUID        NOT NULL REFERENCES events.events (id) ON DELETE CASCADE,
    pole     VARCHAR(16) NOT NULL,
    PRIMARY KEY (event_id, pole),
    CONSTRAINT ck_event_poles_pole CHECK (pole IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'))
);

CREATE INDEX idx_event_poles_pole ON events.event_poles (pole, event_id);

INSERT INTO events.event_poles (event_id, pole)
SELECT id, pole FROM events.events WHERE pole IS NOT NULL;

-- La colonne events.pole est conservée et tenue à jour avec le premier pôle (ordre Logistique, Militaire, Industrie),
-- pour qu'un retour à l'image précédente relise des données cohérentes. Elle pourra être supprimée plus tard.
