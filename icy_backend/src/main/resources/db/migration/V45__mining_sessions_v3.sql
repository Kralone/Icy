-- Fiches de minage V3 (docs/mining-v3/SPEC.md).
-- Migration destructive : les fiches V1 sont supprimées sans reprise de données.
-- Une sauvegarde fraîche et une restauration vérifiée sont obligatoires avant de l'appliquer en production.

-- 1. Suppression de la V1 (schéma mining, V27 et V31).
DROP TABLE mining.mining_sheet_job_ores;
DROP TABLE mining.mining_sheet_jobs;
DROP TABLE mining.mining_sheet_ships;
DROP TABLE mining.mining_sheet_sales;
DROP TABLE mining.mining_sheet_members;
DROP TABLE mining.mining_sheets;

-- 2. Couche commune à toute fiche de session : participants, frais, ventes, règlements.
CREATE SCHEMA session;

CREATE TABLE session.sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity VARCHAR(20) NOT NULL DEFAULT 'MINING',
    name VARCHAR(160) NOT NULL,
    session_date DATE NOT NULL,
    organizer_user_id UUID NOT NULL REFERENCES core.users(id),
    -- Une fiche au plus par opération ; la fiche survit à la suppression de l'opération.
    operation_event_id UUID UNIQUE REFERENCES events.operations(event_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    revision BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_sheets_activity_ck CHECK (activity IN ('MINING')),
    CONSTRAINT session_sheets_status_ck CHECK (status IN ('ACTIVE', 'SETTLEMENT', 'CLOSED')),
    CONSTRAINT session_sheets_name_ck CHECK (btrim(name) <> '')
);

CREATE INDEX session_sheets_status_date_idx ON session.sheets(status, session_date DESC);

CREATE TABLE session.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id),
    -- Parts en centièmes : 100 = 1 part, 50 = demi-part, 0 = exclu du partage.
    shares_centi INTEGER NOT NULL DEFAULT 100,
    -- Ordre d'arrivée : départage des restes d'arrondi.
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_participants_uk UNIQUE (sheet_id, user_id),
    CONSTRAINT session_participants_shares_ck CHECK (shares_centi BETWEEN 0 AND 10000)
);

CREATE INDEX session_participants_user_idx ON session.participants(user_id);

CREATE TABLE session.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    payer_user_id UUID NOT NULL REFERENCES core.users(id),
    kind VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    note VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_expenses_kind_ck CHECK (kind IN ('FUEL', 'REPAIR', 'MATERIAL', 'OTHER')),
    CONSTRAINT session_expenses_amount_ck CHECK (amount > 0)
);

CREATE INDEX session_expenses_sheet_idx ON session.expenses(sheet_id);

CREATE TABLE session.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    seller_user_id UUID NOT NULL REFERENCES core.users(id),
    terminal_id INTEGER,
    terminal_label VARCHAR(200) NOT NULL,
    amount BIGINT NOT NULL,
    sold_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_sales_amount_ck CHECK (amount > 0),
    CONSTRAINT session_sales_terminal_ck CHECK (btrim(terminal_label) <> '')
);

CREATE INDEX session_sales_sheet_idx ON session.sales(sheet_id);

-- Un règlement par arrêt des comptes. Annulé par une réouverture vers ACTIVE, il est conservé.
CREATE TABLE session.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID NOT NULL REFERENCES core.users(id),
    total_sales BIGINT NOT NULL,
    total_expenses BIGINT NOT NULL,
    net BIGINT NOT NULL,
    cancelled_at TIMESTAMP,
    cancelled_by_user_id UUID REFERENCES core.users(id),
    closed_at TIMESTAMP,
    close_kind VARCHAR(20),
    close_reason VARCHAR(500),
    CONSTRAINT session_settlements_close_kind_ck CHECK (close_kind IS NULL OR close_kind IN ('NORMAL', 'FORCED')),
    CONSTRAINT session_settlements_closed_ck CHECK ((closed_at IS NULL) = (close_kind IS NULL)),
    CONSTRAINT session_settlements_net_ck CHECK (net = total_sales - total_expenses)
);

-- Au plus un règlement en cours par fiche.
CREATE UNIQUE INDEX session_settlements_one_current ON session.settlements(sheet_id) WHERE cancelled_at IS NULL;

-- Photographie des soldes au moment de l'arrêt des comptes.
CREATE TABLE session.settlement_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES session.settlements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id),
    shares_centi INTEGER NOT NULL,
    share BIGINT NOT NULL,
    advanced BIGINT NOT NULL,
    cashed BIGINT NOT NULL,
    balance BIGINT NOT NULL,
    position INTEGER NOT NULL,
    CONSTRAINT session_settlement_shares_uk UNIQUE (settlement_id, user_id),
    CONSTRAINT session_settlement_shares_balance_ck CHECK (balance = share + advanced)
);

CREATE TABLE session.settlement_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES session.settlements(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES core.users(id),
    to_user_id UUID NOT NULL REFERENCES core.users(id),
    amount BIGINT NOT NULL,
    position INTEGER NOT NULL,
    received_at TIMESTAMP,
    received_by_user_id UUID REFERENCES core.users(id),
    CONSTRAINT session_settlement_transfers_amount_ck CHECK (amount > 0),
    CONSTRAINT session_settlement_transfers_users_ck CHECK (from_user_id <> to_user_id),
    CONSTRAINT session_settlement_transfers_receipt_ck CHECK ((received_at IS NULL) = (received_by_user_id IS NULL))
);

CREATE INDEX session_settlement_transfers_settlement_idx ON session.settlement_transfers(settlement_id);

CREATE TABLE session.history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES core.users(id),
    action VARCHAR(30) NOT NULL,
    reason VARCHAR(500),
    at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_history_action_ck CHECK (action IN (
        'SETTLED', 'REOPENED_SETTLEMENT', 'REOPENED_ACTIVE', 'CLOSED', 'FORCED_CLOSE',
        'RECEIPT_CONFIRMED', 'RECEIPT_WITHDRAWN'))
);

CREATE INDEX session_history_sheet_idx ON session.history(sheet_id, at);

-- 3. Couche propre au minage : ordres de raffinage et lignes de vente.
CREATE TABLE mining.refinery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES session.sheets(id) ON DELETE CASCADE,
    launcher_user_id UUID NOT NULL REFERENCES core.users(id),
    terminal_id INTEGER,
    terminal_label VARCHAR(200) NOT NULL,
    method_code VARCHAR(20),
    method_label VARCHAR(80),
    cost BIGINT NOT NULL DEFAULT 0,
    finishes_at TIMESTAMP NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES core.users(id),
    -- Seule action de remise : « Remis » (ou « Je l'ai récupéré » quand le lanceur est le destinataire).
    handed_over_at TIMESTAMP,
    ready_notified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mining_refinery_orders_cost_ck CHECK (cost >= 0),
    CONSTRAINT mining_refinery_orders_terminal_ck CHECK (btrim(terminal_label) <> '')
);

CREATE INDEX mining_refinery_orders_sheet_idx ON mining.refinery_orders(sheet_id);
-- Ordres à annoncer sur Discord quand ils deviennent prêts.
CREATE INDEX mining_refinery_orders_ready_idx ON mining.refinery_orders(finishes_at) WHERE ready_notified_at IS NULL;

CREATE TABLE mining.refinery_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES mining.refinery_orders(id) ON DELETE CASCADE,
    commodity_id INTEGER NOT NULL,
    commodity_name VARCHAR(80) NOT NULL,
    quantity_cscu INTEGER NOT NULL,
    quality INTEGER NOT NULL,
    destination VARCHAR(10) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT mining_refinery_order_lines_quantity_ck CHECK (quantity_cscu > 0),
    CONSTRAINT mining_refinery_order_lines_quality_ck CHECK (quality BETWEEN 0 AND 1000),
    CONSTRAINT mining_refinery_order_lines_destination_ck CHECK (destination IN ('SELL', 'KEEP'))
);

CREATE INDEX mining_refinery_order_lines_order_idx ON mining.refinery_order_lines(order_id);

CREATE TABLE mining.sale_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES session.sales(id) ON DELETE CASCADE,
    commodity_id INTEGER NOT NULL,
    commodity_name VARCHAR(80) NOT NULL,
    quantity_cscu INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT mining_sale_lines_quantity_ck CHECK (quantity_cscu > 0)
);

CREATE INDEX mining_sale_lines_sale_idx ON mining.sale_lines(sale_id);

-- 4. Option « Session de minage » d'une opération : la fiche liée est créée à la publication.
ALTER TABLE events.operations
    ADD COLUMN mining_session BOOLEAN NOT NULL DEFAULT FALSE;
