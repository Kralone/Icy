INSERT INTO icelink.icelink_block (name, icon, content, description, headline)
SELECT 'Nouveaux membres', '🆕', 'Auto', NULL, '## 🆕 Nouveaux membres'
WHERE NOT EXISTS (
    SELECT 1 FROM icelink.icelink_block WHERE name = 'Nouveaux membres'
);

INSERT INTO icelink.icelink_block (name, icon, content, description, headline)
SELECT 'Nouveaux vaisseaux', '🚀', 'Auto', NULL, '## 🚀 Nouveaux vaisseaux'
WHERE NOT EXISTS (
    SELECT 1 FROM icelink.icelink_block WHERE name = 'Nouveaux vaisseaux'
);

ALTER TABLE goals.goal_templates
    ADD COLUMN user_id UUID,
    ADD CONSTRAINT fk_goal_template_user FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE SET NULL;
