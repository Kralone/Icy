-- Joueurs inscrits sur un objectif, indépendamment de leurs contributions chiffrées.
CREATE TABLE goals.goal_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id BIGINT NOT NULL REFERENCES goals.goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_goal_members_goal_user UNIQUE (goal_id, user_id)
);

CREATE INDEX idx_goal_members_user_id ON goals.goal_members(user_id);
