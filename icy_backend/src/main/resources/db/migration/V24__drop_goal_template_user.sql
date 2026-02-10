ALTER TABLE goals.goal_templates
    DROP CONSTRAINT IF EXISTS fk_goal_template_user;

ALTER TABLE goals.goal_templates
    DROP COLUMN IF EXISTS user_id;
