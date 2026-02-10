ALTER TABLE goals.goal_templates
    ADD COLUMN user_id UUID,
    ADD CONSTRAINT fk_goal_template_user FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE SET NULL;
