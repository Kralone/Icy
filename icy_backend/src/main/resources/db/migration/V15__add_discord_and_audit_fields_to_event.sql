-- Ajout des colonnes de synchronisation Discord et audit sur event

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS discord_channel_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS discord_message_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id);
