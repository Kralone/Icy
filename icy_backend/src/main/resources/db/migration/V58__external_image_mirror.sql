-- Copies locales des images venues d'autres sites (wiki, RSI, articles...).
-- Une image téléchargée une fois n'est plus jamais redemandée à son site d'origine.
CREATE TABLE IF NOT EXISTS media.external_image_mirror (
    source_url  TEXT PRIMARY KEY,
    image_name  TEXT,
    local_url   TEXT,
    bytes       BIGINT,
    mirrored_at TIMESTAMP,
    last_error  TEXT,
    failed_at   TIMESTAMP,
    CHECK ((local_url IS NULL) = (image_name IS NULL))
);
