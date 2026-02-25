CREATE TABLE IF NOT EXISTS celestial_bodies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    body_type VARCHAR(20) NOT NULL,
    system_name VARCHAR(80) NOT NULL,
    parent_planet VARCHAR(120),
    wiki_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    game_version VARCHAR(20) NOT NULL DEFAULT '4.6',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_celestial_body_type CHECK (body_type IN ('PLANET', 'MOON'))
);

CREATE INDEX IF NOT EXISTS idx_celestial_bodies_system_type_sort
    ON celestial_bodies (system_name, body_type, sort_order, name);

INSERT INTO celestial_bodies (name, slug, body_type, system_name, parent_planet, wiki_url, image_url, game_version, sort_order)
VALUES
    ('Hurston', 'hurston', 'PLANET', 'Stanton', NULL, 'https://starcitizen.tools/Hurston', 'https://media.starcitizen.tools/8/89/Hurston-4.3.jpg', '4.6', 10),
    ('Crusader', 'crusader', 'PLANET', 'Stanton', NULL, 'https://starcitizen.tools/Crusader', 'https://media.starcitizen.tools/d/d4/Crusader-4.3.jpg', '4.6', 20),
    ('ArcCorp', 'arccorp', 'PLANET', 'Stanton', NULL, 'https://starcitizen.tools/ArcCorp_(planet)', 'https://media.starcitizen.tools/e/e9/ArcCorp-4.3.jpg', '4.6', 30),
    ('microTech', 'microtech', 'PLANET', 'Stanton', NULL, 'https://starcitizen.tools/MicroTech_(planet)', 'https://media.starcitizen.tools/e/e7/MicroTech-4.3.jpg', '4.6', 40),
    ('Pyro I', 'pyro-i', 'PLANET', 'Pyro', NULL, 'https://starcitizen.tools/Pyro_I', 'https://media.starcitizen.tools/e/e0/Pyro-PyroI-orbit-4.0PTU.jpg', '4.6', 110),
    ('Monox', 'monox', 'PLANET', 'Pyro', NULL, 'https://starcitizen.tools/Monox', 'https://media.starcitizen.tools/1/19/MonoxCitizenCon2024.png', '4.6', 120),
    ('Bloom', 'bloom', 'PLANET', 'Pyro', NULL, 'https://starcitizen.tools/Bloom', 'https://media.starcitizen.tools/b/b9/Pyro-bloom-orbit-4.0PTU_01.jpg', '4.6', 130),
    ('Pyro V', 'pyro-v', 'PLANET', 'Pyro', NULL, 'https://starcitizen.tools/Pyro_V', 'https://media.starcitizen.tools/8/81/Pyro-PyroV-orbit-4.0PTU.jpg', '4.6', 150),
    ('Terminus', 'terminus', 'PLANET', 'Pyro', NULL, 'https://starcitizen.tools/Terminus', 'https://media.starcitizen.tools/3/38/Pyro-Terminus-orbit-4.0PTU.jpg', '4.6', 160),
    ('Aberdeen', 'aberdeen', 'MOON', 'Stanton', 'Hurston', 'https://starcitizen.tools/Aberdeen', 'https://media.starcitizen.tools/4/47/Aberdeen-4.3.jpg', '4.6', 11),
    ('Arial', 'arial', 'MOON', 'Stanton', 'Hurston', 'https://starcitizen.tools/Arial', 'https://media.starcitizen.tools/f/f8/Stanton-hurston-arial-orbit-3.17.jpg', '4.6', 12),
    ('Ita', 'ita', 'MOON', 'Stanton', 'Hurston', 'https://starcitizen.tools/Ita', 'https://media.starcitizen.tools/3/3d/Stanton-hurston-ita-orbit-3.17.jpg', '4.6', 13),
    ('Magda', 'magda', 'MOON', 'Stanton', 'Hurston', 'https://starcitizen.tools/Magda', 'https://media.starcitizen.tools/1/13/Stanton-hurston-magda-orbit-3.17.jpg', '4.6', 14),
    ('Cellin', 'cellin', 'MOON', 'Stanton', 'Crusader', 'https://starcitizen.tools/Cellin', 'https://media.starcitizen.tools/5/5c/Stanton-crusader-cellin-orbit-3.8.0.jpg', '4.6', 21),
    ('Daymar', 'daymar', 'MOON', 'Stanton', 'Crusader', 'https://starcitizen.tools/Daymar', 'https://media.starcitizen.tools/5/52/Stanton-crusader-daymar-3.8.0.jpg', '4.6', 22),
    ('Yela', 'yela', 'MOON', 'Stanton', 'Crusader', 'https://starcitizen.tools/Yela', 'https://media.starcitizen.tools/8/8f/Stanton-crusader-yela-orbit-3.8.0.jpg', '4.6', 23),
    ('Lyria', 'lyria', 'MOON', 'Stanton', 'ArcCorp', 'https://starcitizen.tools/Lyria', 'https://media.starcitizen.tools/a/aa/Stanton-arccorp-lyria-orbit-3.12.jpg', '4.6', 31),
    ('Wala', 'wala', 'MOON', 'Stanton', 'ArcCorp', 'https://starcitizen.tools/Wala', 'https://media.starcitizen.tools/f/ff/Stanton-arccorp-wala-orbit-3.12.jpg', '4.6', 32),
    ('Calliope', 'calliope', 'MOON', 'Stanton', 'microTech', 'https://starcitizen.tools/Calliope', 'https://media.starcitizen.tools/9/9a/Calliope-orbit1.png', '4.6', 41),
    ('Clio', 'clio', 'MOON', 'Stanton', 'microTech', 'https://starcitizen.tools/Clio', 'https://media.starcitizen.tools/2/27/Clio-orbit.png', '4.6', 42),
    ('Euterpe', 'euterpe', 'MOON', 'Stanton', 'microTech', 'https://starcitizen.tools/Euterpe', 'https://media.starcitizen.tools/5/53/Euterpe-orbit1.png', '4.6', 43),
    ('Ignis', 'ignis', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Ignis', 'https://media.starcitizen.tools/2/2f/Ignis_and_Pyro_V.png', '4.6', 151),
    ('Vatra', 'vatra', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Vatra', 'https://media.starcitizen.tools/5/52/Pyro-PyroV-Vatra-orbit-4.0PTU.jpg', '4.6', 152),
    ('Vuur', 'vuur', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Vuur', 'https://media.starcitizen.tools/e/eb/Pyro-PyroV-Vuur-orbit-4.0PTU.jpg', '4.6', 153),
    ('Adir', 'adir', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Adir', 'https://media.starcitizen.tools/b/be/Adir%3B_moon_of_Pyro_V.png', '4.6', 154),
    ('Fairo', 'fairo', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Fairo', 'https://media.starcitizen.tools/6/6f/Pyro-PyroV-Fairo-orbit-4.0PTU.jpg', '4.6', 155),
    ('Fuego', 'fuego', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Fuego', 'https://media.starcitizen.tools/f/fb/Pyro-PyroV-Fuego-orbit-4.0PTU.jpg', '4.6', 156),
    ('Pyro IV', 'pyro-iv', 'MOON', 'Pyro', 'Pyro V', 'https://starcitizen.tools/Pyro_IV', 'https://media.starcitizen.tools/c/c4/Pyro-PyroIV-orbit-4.0PTU.jpg', '4.6', 157)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    body_type = EXCLUDED.body_type,
    system_name = EXCLUDED.system_name,
    parent_planet = EXCLUDED.parent_planet,
    wiki_url = EXCLUDED.wiki_url,
    image_url = EXCLUDED.image_url,
    game_version = EXCLUDED.game_version,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
