-- La rotation supprime le prédécesseur du jeton présenté via replaced_by_token_hash.
CREATE INDEX idx_refresh_tokens_replaced_by
    ON core.refresh_tokens (replaced_by_token_hash);
