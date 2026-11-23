-- Suivi de l'activité des membres, rappels aux inactifs et messages privés envoyés par le bot Discord.

-- Messages privés envoyés par le bot (rappels, promotions, avertissements…). Une ligne par envoi.
-- status : PENDING tant que le bot n'a pas répondu, puis SENT ou FAILED ; reason précise un échec
-- (dm_closed, user_not_found…) ou une réserve sur un envoi réussi (media_missing).
CREATE TABLE core.direct_messages (
    id           UUID PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES core.users (id) ON DELETE CASCADE,
    origin       VARCHAR(24)  NOT NULL,
    reference    VARCHAR(64),
    content      TEXT,
    embed_title  VARCHAR(256),
    media_file   VARCHAR(200),
    requested_by UUID REFERENCES core.users (id) ON DELETE SET NULL,
    requested_at TIMESTAMP    NOT NULL,
    status       VARCHAR(16)  NOT NULL,
    reason       VARCHAR(40),
    completed_at TIMESTAMP,
    CONSTRAINT ck_direct_messages_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);
CREATE INDEX idx_direct_messages_user ON core.direct_messages (user_id, requested_at DESC);
CREATE INDEX idx_direct_messages_pending ON core.direct_messages (requested_at) WHERE status = 'PENDING';

-- Seuils d'activité, en jours sans activité. Une seule ligne.
CREATE TABLE core.member_activity_settings (
    id            SMALLINT PRIMARY KEY DEFAULT 1,
    watch_days    INT NOT NULL DEFAULT 14,
    inactive_days INT NOT NULL DEFAULT 30,
    CONSTRAINT ck_member_activity_settings_single CHECK (id = 1),
    CONSTRAINT ck_member_activity_settings_days CHECK (watch_days >= 1 AND inactive_days > watch_days AND inactive_days <= 365)
);
INSERT INTO core.member_activity_settings (id) VALUES (1);

-- Correction manuelle de l'état calculé : un membre noté actif ou en pause, jusqu'à une date facultative.
CREATE TABLE core.member_follow_up (
    user_id      UUID PRIMARY KEY REFERENCES core.users (id) ON DELETE CASCADE,
    manual_state VARCHAR(16),
    manual_until DATE,
    note         VARCHAR(500),
    updated_at   TIMESTAMP NOT NULL,
    updated_by   VARCHAR(255),
    CONSTRAINT ck_member_follow_up_state CHECK (manual_state IS NULL OR manual_state IN ('ACTIF', 'EN_PAUSE'))
);

-- Modèles des messages privés. {pseudo}, {grade} et {pôle} sont remplacés à l'envoi.
-- media_file est le nom d'un fichier de la bibliothèque d'images, joint au message.
CREATE TABLE core.message_templates (
    code       VARCHAR(48) PRIMARY KEY,
    category   VARCHAR(16)  NOT NULL,
    label      VARCHAR(80)  NOT NULL,
    body       TEXT         NOT NULL,
    media_file VARCHAR(200),
    sort_order INT          NOT NULL DEFAULT 0,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    CONSTRAINT ck_message_templates_category CHECK (category IN ('RAPPEL', 'PROMOTION'))
);

-- Campagne de rappel : un message (copié du modèle, modifiable) et les membres à prévenir.
-- delivery BOT : le bot envoie, tout de suite ou à scheduled_at. MANUEL : l'officier envoie lui-même et coche.
CREATE TABLE core.reminder_campaigns (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           VARCHAR(120) NOT NULL,
    body            TEXT         NOT NULL,
    media_file      VARCHAR(200),
    delivery        VARCHAR(16)  NOT NULL,
    status          VARCHAR(16)  NOT NULL,
    scheduled_at    TIMESTAMP,
    sent_at         TIMESTAMP,
    created_by      UUID REFERENCES core.users (id) ON DELETE SET NULL,
    created_by_name VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP    NOT NULL,
    CONSTRAINT ck_reminder_campaigns_delivery CHECK (delivery IN ('BOT', 'MANUEL')),
    CONSTRAINT ck_reminder_campaigns_status CHECK (status IN ('BROUILLON', 'PROGRAMMEE', 'EN_COURS', 'ANNULEE'))
);
CREATE INDEX idx_reminder_campaigns_due ON core.reminder_campaigns (scheduled_at) WHERE status = 'PROGRAMMEE';

-- Fiche de rappel d'un membre : quand il a été prévenu, s'il a répondu et ce qu'il a décidé.
CREATE TABLE core.member_reminders (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campaign_id     BIGINT      NOT NULL REFERENCES core.reminder_campaigns (id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES core.users (id) ON DELETE CASCADE,
    days_inactive   INT,
    contacted_at    TIMESTAMP,
    delivery_id     UUID REFERENCES core.direct_messages (id) ON DELETE SET NULL,
    answered_at     TIMESTAMP,
    decision        VARCHAR(16),
    pause_until     DATE,
    note            VARCHAR(500),
    updated_at      TIMESTAMP,
    updated_by      VARCHAR(255),
    CONSTRAINT uq_member_reminders_campaign_user UNIQUE (campaign_id, user_id),
    CONSTRAINT ck_member_reminders_decision CHECK (decision IS NULL OR decision IN ('REVIENT', 'PAUSE', 'QUITTE', 'SANS_REPONSE'))
);
CREATE INDEX idx_member_reminders_user ON core.member_reminders (user_id, id DESC);
CREATE INDEX idx_member_reminders_delivery ON core.member_reminders (delivery_id) WHERE delivery_id IS NOT NULL;

-- Textes de départ : ceux que la Direction envoyait jusqu'ici à la main.
INSERT INTO core.message_templates (code, category, label, media_file, sort_order, body) VALUES
('RAPPEL_INACTIVITE', 'RAPPEL', 'Rappel d''inactivité', 'rappel-inactivite.gif', 0, $tpl$Hello {pseudo} ! 👋

Ça fait un petit moment qu'on ne t'a pas croisé dans le 'verse, alors je voulais simplement prendre de tes nouvelles. J'espère que tout va bien de ton côté ! 🙂

Pas de pression hein, on sait tous que la vie (et Star Citizen 😅) a ses hauts et ses bas. Mais si l'envie te reprend, sache qu'il y a toujours une place pour toi chez IceForge. On serait vraiment contents de repartir en opé avec toi un de ces quatre. 🚀

Et si tu as décidé de faire une pause ou de passer à autre chose, aucun souci, dis-le-moi simplement, ça m'aidera à garder la liste de la corpo à jour.

À bientôt j'espère ! o7$tpl$),
('BIENVENUE_JUNIOR', 'PROMOTION', 'Bienvenue (Junior)', 'bienvenue-junior.gif', 10, $tpl$❄️ **IceForge Industries**
🛰️ **Bienvenue dans la corporation**

{pseudo},

C'est avec un grand plaisir que nous vous accueillons au sein d'IceForge Industries, au grade de **Junior**. 🎉

Ce premier grade marque le début de votre parcours parmi nous. Nos opérations vous sont ouvertes, tout comme nos trois pôles d'activité : ⛏️ Industrie, 📦 Logistique et ⚔️ Militaire. Votre progression au sein de la corporation se construira au fil de votre implication aux côtés de nos équipages.

Bienvenue à bord. o7$tpl$),
('PROMOTION_ASSOCIE', 'PROMOTION', 'Promotion Associé', 'promotion-associe.gif', 20, $tpl$❄️ **IceForge Industries**
🎖️ **Promotion au grade d'Associé**

{pseudo},

C'est avec plaisir que nous vous annonçons votre accession au grade d'**Associé**. 🎉

Cette promotion salue la régularité de votre participation et la fiabilité dont vous avez fait preuve au fil de nos opérations. Vous comptez désormais parmi les membres sur lesquels la corporation s'appuie pour mener ses activités. 🤝

Toutes nos félicitations ! o7$tpl$),
('PROMOTION_INGENIEUR', 'PROMOTION', 'Promotion Ingénieur', 'promotion-ingenieur.gif', 30, $tpl$❄️ **IceForge Industries**
🎖️ **Promotion au grade d'Ingénieur**

{pseudo},

C'est avec plaisir que nous vous annonçons votre accession au grade d'**Ingénieur**. 🎉

Nos Officiers ont reconnu la qualité de votre maîtrise technique. 🔧 Ce grade fait de vous un appui de référence en opération et un relais précieux du savoir-faire de la corporation auprès des membres moins expérimentés.

Toutes nos félicitations ! o7$tpl$),
('PROMOTION_SPECIALISTE_INDUSTRIE', 'PROMOTION', 'Nomination Spécialiste Industrie', 'promotion-specialiste-industrie.gif', 40, $tpl$❄️ **IceForge Industries**
🏅 **Nomination au grade de Spécialiste {pôle}**

{pseudo},

C'est avec une grande fierté que nous vous annonçons votre nomination au grade de **Spécialiste**, au sein du pôle **{pôle}**. 🎉

Cette nomination consacre une expertise reconnue par toute la corporation. 🌟 En tant que référent du pôle {pôle}, vous en animez désormais les activités et contribuez directement aux orientations d'IceForge Industries dans ce domaine.

Toutes nos félicitations ! o7$tpl$),
('PROMOTION_SPECIALISTE_LOGISTIQUE', 'PROMOTION', 'Nomination Spécialiste Logistique', 'promotion-specialiste-logistique.gif', 41, $tpl$❄️ **IceForge Industries**
🏅 **Nomination au grade de Spécialiste {pôle}**

{pseudo},

C'est avec une grande fierté que nous vous annonçons votre nomination au grade de **Spécialiste**, au sein du pôle **{pôle}**. 🎉

Cette nomination consacre une expertise reconnue par toute la corporation. 🌟 En tant que référent du pôle {pôle}, vous en animez désormais les activités et contribuez directement aux orientations d'IceForge Industries dans ce domaine.

Toutes nos félicitations ! o7$tpl$),
('PROMOTION_SPECIALISTE_MILITAIRE', 'PROMOTION', 'Nomination Spécialiste Militaire', 'promotion-specialiste-militaire.gif', 42, $tpl$❄️ **IceForge Industries**
🏅 **Nomination au grade de Spécialiste {pôle}**

{pseudo},

C'est avec une grande fierté que nous vous annonçons votre nomination au grade de **Spécialiste**, au sein du pôle **{pôle}**. 🎉

Cette nomination consacre une expertise reconnue par toute la corporation. 🌟 En tant que référent du pôle {pôle}, vous en animez désormais les activités et contribuez directement aux orientations d'IceForge Industries dans ce domaine.

Toutes nos félicitations ! o7$tpl$),
('PROMOTION_OFFICIER', 'PROMOTION', 'Nomination Officier', 'promotion-officier.gif', 50, $tpl$❄️ **IceForge Industries**
👑 **Nomination au grade d'Officier**

{pseudo},

C'est avec un immense honneur que nous vous annonçons votre nomination au grade d'**Officier**. 🎉

Vous rejoignez aujourd'hui l'encadrement d'IceForge Industries. 🛡️ Vous prendrez part à la conduite des grandes opérations, au recrutement des futurs membres et à la représentation de la corporation auprès de ses partenaires.

La Direction vous adresse ses plus chaleureuses félicitations et vous remercie pour votre engagement. o7$tpl$),
('NOMINATION_TRESORIER', 'PROMOTION', 'Nomination Trésorier', 'nomination-tresorier.gif', 60, $tpl$❄️ **IceForge Industries**
💰 **Nomination à la fonction de Trésorier**

{pseudo},

C'est avec plaisir que nous vous annonçons votre nomination à la fonction de **Trésorier** de la corporation. 🎉

Cette fonction, qui s'ajoute à votre grade actuel, témoigne de la confiance que la Direction vous accorde. 🏦 Vous avez désormais la charge de la banque d'IceForge Industries : vous enregistrez les dépôts et les mouvements de fonds, et veillez à la bonne tenue des comptes de chaque membre.

Toutes nos félicitations ! o7$tpl$);
