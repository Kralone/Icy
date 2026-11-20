-- Sous-grade des Spécialistes : le pôle dont le membre est le référent.
-- Renseigné uniquement pour le grade SPECIALISTE (règle appliquée par le backend) ; NULL pour les autres grades
-- et pour les Spécialistes nommés avant cette version, à compléter depuis la page Membres.
ALTER TABLE core.users
    ADD COLUMN specialty VARCHAR(16),
    ADD CONSTRAINT ck_users_specialty CHECK (specialty IN ('LOGISTIQUE', 'MILITAIRE', 'INDUSTRIE'));
