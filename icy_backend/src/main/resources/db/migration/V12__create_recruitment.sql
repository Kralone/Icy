CREATE TABLE recruitment (
                             id BIGSERIAL PRIMARY KEY,
                             username VARCHAR(128) NOT NULL,
                             discord_tag VARCHAR(256) NOT NULL,
                             motivation VARCHAR(256) NOT NULL,
                             referral VARCHAR(256),
                             experience VARCHAR(256),
                             preferred_gameplay VARCHAR(256),
                             accept BOOLEAN NOT NULL DEFAULT FALSE,
                             status VARCHAR(256) NOT NULL DEFAULT 'PENDING',
                             comment VARCHAR(256),
                             created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_recruitment_status ON recruitment(status);
CREATE INDEX ix_recruitment_accept ON recruitment(accept);
CREATE INDEX ix_recruitment_created_at ON recruitment(created_at);
