ALTER TABLE core.refresh_tokens
    ALTER COLUMN token_hash TYPE VARCHAR(64),
    ALTER COLUMN replaced_by_token_hash TYPE VARCHAR(64);
