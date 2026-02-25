ALTER TABLE fleet.user_ships
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE goals.goal_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    parent_id BIGINT,
    CONSTRAINT fk_parent_goal_template FOREIGN KEY (parent_id) REFERENCES goals.goal_templates(id) ON DELETE CASCADE
);

ALTER TABLE goals.goals
    ADD COLUMN user_id UUID,
    ADD CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE SET NULL;
