-- Fiches de salvage (docs/salvage/SPEC.md) : elles réutilisent toute la couche commune des fiches de session
-- (participants, frais, ventes, règlements, historique) et la couche des lots de cargo du minage.
-- Migration additive : aucune donnée existante n'est modifiée.

-- 1. Une fiche de session est de minage ou de salvage.
ALTER TABLE session.sheets DROP CONSTRAINT session_sheets_activity_ck;
ALTER TABLE session.sheets ADD CONSTRAINT session_sheets_activity_ck CHECK (activity IN ('MINING', 'SALVAGE'));

-- 2. Frais propres au salvage : claim de récupération (Adagio Holdings) et location de vaisseau.
ALTER TABLE session.expenses DROP CONSTRAINT session_expenses_kind_ck;
ALTER TABLE session.expenses ADD CONSTRAINT session_expenses_kind_ck
    CHECK (kind IN ('FUEL', 'REPAIR', 'MATERIAL', 'OTHER', 'CLAIM', 'RENTAL'));

-- 3. Un lot de cargo est soit un ordre de raffinage (minerai, ou matériau de construction brut à raffiner en CMAT),
--    soit une cargaison récupérée (RMC, matériau de construction, prise directement à bord, sans attente).
ALTER TABLE mining.refinery_orders
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'REFINERY',
    ADD CONSTRAINT mining_refinery_orders_kind_ck CHECK (kind IN ('REFINERY', 'HAUL'));

-- 4. La qualité reste obligatoire pour le minerai (contrôlée par le serveur), mais le salvage n'en a pas :
--    une valeur absente reste absente plutôt que d'être notée 0.
ALTER TABLE mining.refinery_order_lines ALTER COLUMN quality DROP NOT NULL;

-- 5. Option « Session de salvage » d'une opération, sur le modèle de « Session de minage ».
--    Une opération a au plus une fiche (session.sheets.operation_event_id unique) : les deux options s'excluent.
ALTER TABLE events.operations
    ADD COLUMN salvage_session BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT operations_one_session_kind_ck CHECK (NOT (mining_session AND salvage_session));
