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
