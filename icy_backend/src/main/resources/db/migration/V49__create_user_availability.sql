-- Disponibilités habituelles des membres, à l'heure de Paris : quatre créneaux par jour.
-- MORNING 6h-12h, AFTERNOON 12h-18h, EVENING 18h-23h, NIGHT 23h-6h.
-- day_of_week suit la norme ISO (1 = lundi, 7 = dimanche) ; la nuit appartient au jour où elle commence.
CREATE TABLE core.user_availability (
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    period VARCHAR(16) NOT NULL,
    CONSTRAINT pk_user_availability PRIMARY KEY (user_id, day_of_week, period),
    CONSTRAINT ck_user_availability_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_user_availability_period CHECK (period IN ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'))
);
