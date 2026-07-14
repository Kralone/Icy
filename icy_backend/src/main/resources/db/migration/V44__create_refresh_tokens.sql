CREATE TABLE core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash CHAR(64) NOT NULL,
    replaced_by_token_hash CHAR(64),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_active
    ON core.refresh_tokens (user_id, revoked_at);

CREATE INDEX idx_refresh_tokens_expires_at
    ON core.refresh_tokens (expires_at);
