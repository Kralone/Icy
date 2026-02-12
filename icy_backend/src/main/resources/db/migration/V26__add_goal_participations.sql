CREATE TABLE IF NOT EXISTS goals.goal_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id BIGINT NOT NULL REFERENCES goals.goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    delta INT NOT NULL,
    total_after INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE goals.goal_participations
    ADD CONSTRAINT uq_goal_participations_goal_user UNIQUE (goal_id, user_id);

CREATE INDEX IF NOT EXISTS idx_goal_participations_goal_id
    ON goals.goal_participations(goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_participations_user_id
    ON goals.goal_participations(user_id);

CREATE INDEX IF NOT EXISTS idx_goal_participations_created_at
    ON goals.goal_participations(created_at DESC);
