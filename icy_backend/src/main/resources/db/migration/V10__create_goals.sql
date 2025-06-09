CREATE TABLE goals (
                       id BIGSERIAL PRIMARY KEY,
                       name VARCHAR(255) NOT NULL,
                       description TEXT,
                       target INT NOT NULL,
                       current INT NOT NULL DEFAULT 0,
                       pinned BOOLEAN NOT NULL DEFAULT FALSE,
                       completed BOOLEAN NOT NULL DEFAULT FALSE,
                       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       parent_id BIGINT,
                       CONSTRAINT fk_parent_goal FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE CASCADE
);
