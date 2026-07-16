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

CREATE TABLE goals.goal_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id BIGINT NOT NULL REFERENCES goals.goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    delta INT NOT NULL,
    total_after INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE goals.goal_participations
    ADD CONSTRAINT uq_goal_participations_goal_user UNIQUE (goal_id, user_id);

CREATE INDEX idx_goal_participations_goal_id
    ON goals.goal_participations(goal_id);

CREATE INDEX idx_goal_participations_user_id
    ON goals.goal_participations(user_id);

CREATE INDEX idx_goal_participations_created_at
    ON goals.goal_participations(created_at DESC);
