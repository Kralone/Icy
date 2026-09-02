\set ON_ERROR_STOP on

-- IceForge disposable validation fixtures.
-- This file is intentionally outside Flyway and is safe to replay.
BEGIN;

INSERT INTO core.roles (name) VALUES ('USER'), ('OFFICIER'), ('ADMIN')
ON CONFLICT (name) DO NOTHING;

-- All three disposable accounts use the password "password". This deliberately
-- weak credential is acceptable only in the isolated iceforge_validation stack.
INSERT INTO core.users (id, username, discord_id, password, active, pwd_reset, description, status, last_seen_at)
VALUES
 ('10000000-0000-0000-0000-000000000001', 'validation_user', '990000000000000001', crypt('password', gen_salt('bf', 10)), true, false, 'Compte USER jetable', 'CONNECTE', NOW()),
 ('10000000-0000-0000-0000-000000000002', 'validation_officier', '990000000000000002', crypt('password', gen_salt('bf', 10)), true, false, 'Compte OFFICIER jetable', 'ABSENT', NOW() - INTERVAL '20 minutes'),
 ('10000000-0000-0000-0000-000000000003', 'validation_admin', '990000000000000003', crypt('password', gen_salt('bf', 10)), true, false, 'Compte ADMIN jetable', 'CONNECTE', NOW())
ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, discord_id=EXCLUDED.discord_id,
 password=EXCLUDED.password, active=true, pwd_reset=false, description=EXCLUDED.description,
 status=EXCLUDED.status, last_seen_at=EXCLUDED.last_seen_at;

INSERT INTO core.user_roles (id, user_id, role_id)
SELECT v.id, v.user_id, r.id FROM (VALUES
 ('11000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'USER'),
 ('11000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'OFFICIER'),
 ('11000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'ADMIN')
) v(id,user_id,role_name) JOIN core.roles r ON r.name=v.role_name
ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, role_id=EXCLUDED.role_id;

INSERT INTO core.user_params (user_id, notif_global, notif_events, notif_fleet, notif_goals, notif_discord)
SELECT id, true, true, true, true, false FROM core.users WHERE username LIKE 'validation_%'
ON CONFLICT (user_id) DO UPDATE SET notif_global=true, notif_events=true, notif_fleet=true, notif_goals=true;

INSERT INTO fleet.brand (id, name, image_url) OVERRIDING SYSTEM VALUE
VALUES (900001, 'Validation Aerospace', '/assets/images/home/iceforgeLogo.png')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, image_url=EXCLUDED.image_url;

INSERT INTO fleet.ships (id, name, focus, scu, size, crew, flight_ready, image_url, brand_id, notes) OVERRIDING SYSTEM VALUE
VALUES
 (900001, 'Fixture Scout', 'Exploration', 8, 'S2', '1', true, '/assets/images/home/carousel/img1.jpg', 900001, 'Fixture UI'),
 (900002, 'Fixture Hauler', 'Transport', 64, 'S3', '2-3', true, '/assets/images/home/carousel/img2.jpg', 900001, 'Fixture UI')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, focus=EXCLUDED.focus, scu=EXCLUDED.scu,
 size=EXCLUDED.size, crew=EXCLUDED.crew, flight_ready=EXCLUDED.flight_ready,
 image_url=EXCLUDED.image_url, brand_id=EXCLUDED.brand_id, notes=EXCLUDED.notes;

UPDATE core.users SET favorite_ship_id=900001 WHERE username='validation_user';
INSERT INTO fleet.user_ships (id,user_id,ship_id,acquired_at,in_game_purchase,loaner,created_at,reward_in_game)
VALUES
 ('12000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',900001,NOW()-INTERVAL '30 days',true,false,NOW()-INTERVAL '30 days',false),
 ('12000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',900002,NOW()-INTERVAL '10 days',false,true,NOW()-INTERVAL '10 days',true)
ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, ship_id=EXCLUDED.ship_id,
 in_game_purchase=EXCLUDED.in_game_purchase, loaner=EXCLUDED.loaner, reward_in_game=EXCLUDED.reward_in_game;

INSERT INTO fleet.ship_sale_points (id,ship_id,location,price) OVERRIDING SYSTEM VALUE
VALUES (900001,900001,'Area18 - Fixture terminal',1250000.00)
ON CONFLICT (id) DO UPDATE SET ship_id=EXCLUDED.ship_id,location=EXCLUDED.location,price=EXCLUDED.price;
INSERT INTO fleet.ship_cargo_grids (id,ship_id,size_x,size_y,size_z) OVERRIDING SYSTEM VALUE
VALUES (900001,900002,8,4,2)
ON CONFLICT (id) DO UPDATE SET ship_id=EXCLUDED.ship_id,size_x=EXCLUDED.size_x,size_y=EXCLUDED.size_y,size_z=EXCLUDED.size_z;

INSERT INTO fleet.item_categories (id,name) OVERRIDING SYSTEM VALUE VALUES (900001,'Validation Components')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name;
INSERT INTO fleet.items (id,name,manufacturer,image_url,description,stats,category_id) OVERRIDING SYSTEM VALUE
VALUES (900001,'Fixture Mining Laser','Validation Dynamics','/assets/images/home/activities/mining.jpg','Objet de validation UI','{"power": 42}',900001)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,manufacturer=EXCLUDED.manufacturer,image_url=EXCLUDED.image_url,
 description=EXCLUDED.description,stats=EXCLUDED.stats,category_id=EXCLUDED.category_id;

INSERT INTO goals.goal_templates (id,name,description,target) OVERRIDING SYSTEM VALUE
VALUES (900001,'Objectif modèle validation','Modèle racine pour les tests UI',100)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,target=EXCLUDED.target;
INSERT INTO goals.goals (id,name,description,target,current,pinned,completed,created_at,user_id) OVERRIDING SYSTEM VALUE
VALUES (900001,'Récolte de validation','Objectif collectif jetable',100,35,true,false,NOW()-INTERVAL '2 days','10000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,target=EXCLUDED.target,
 current=EXCLUDED.current,pinned=EXCLUDED.pinned,completed=EXCLUDED.completed,user_id=EXCLUDED.user_id;
INSERT INTO goals.goal_participations (id,goal_id,user_id,delta,total_after)
VALUES ('13000000-0000-0000-0000-000000000001',900001,'10000000-0000-0000-0000-000000000001',35,35)
ON CONFLICT (id) DO UPDATE SET goal_id=EXCLUDED.goal_id,user_id=EXCLUDED.user_id,delta=EXCLUDED.delta,total_after=EXCLUDED.total_after;

INSERT INTO events.event_types (name,text_color,image_url,background_color)
VALUES ('VALIDATION','#ffffff','/assets/images/home/activities/space-combat.jpg','#123456')
ON CONFLICT (name) DO UPDATE SET text_color=EXCLUDED.text_color,image_url=EXCLUDED.image_url,background_color=EXCLUDED.background_color;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('14000000-0000-0000-0000-000000000001','VALIDATION','Événement de validation','Parcours calendrier et participation',NOW()+INTERVAL '1 day',NOW()+INTERVAL '3 hours 1 day',false,'VALIDATION','10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,start_date_time=EXCLUDED.start_date_time,
 end_date_time=EXCLUDED.end_date_time,finished=false,event_type=EXCLUDED.event_type,creator_id=EXCLUDED.creator_id;
INSERT INTO events.event_participation (id,event_id,user_id,status)
VALUES ('15000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1)
ON CONFLICT (id) DO UPDATE SET event_id=EXCLUDED.event_id,user_id=EXCLUDED.user_id,status=EXCLUDED.status;

INSERT INTO scworld.sc_world_event_type (name,text_color,image_url,score_schema)
VALUES ('VALIDATION','#ffffff','/assets/images/home/hero-background.webp','{"version":1,"fields":[{"key":"cargo","label":"Cargo livré (SCU)","min":0,"max":1000,"milestones":[{"at":100,"label":"Premier palier","imageUrl":"","reward":"Badge validation"}]}],"total":{"mode":"sum","keys":["cargo"],"milestones":[{"at":500,"label":"Objectif collectif","imageUrl":"","reward":"Récompense validation"}]}}')
ON CONFLICT (name) DO UPDATE SET text_color=EXCLUDED.text_color,image_url=EXCLUDED.image_url,score_schema=EXCLUDED.score_schema;
INSERT INTO scworld.sc_world_event (id,title,description,start_at,end_at,type_name,banner_image_url,gallery,score_schema_snapshot)
VALUES ('16000000-0000-0000-0000-000000000001','World event validation','Classement et points jetables',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '2 days','VALIDATION','/assets/images/home/hero-background.webp','[]','{"version":1,"fields":[{"key":"cargo","label":"Cargo livré (SCU)","min":0,"max":1000,"milestones":[{"at":100,"label":"Premier palier","imageUrl":"","reward":"Badge validation"}]}],"total":{"mode":"sum","keys":["cargo"],"milestones":[{"at":500,"label":"Objectif collectif","imageUrl":"","reward":"Récompense validation"}]}}')
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,start_at=EXCLUDED.start_at,
 end_at=EXCLUDED.end_at,type_name=EXCLUDED.type_name,banner_image_url=EXCLUDED.banner_image_url,
 gallery=EXCLUDED.gallery,score_schema_snapshot=EXCLUDED.score_schema_snapshot;
INSERT INTO scworld.sc_world_event_participation (id,scwe_id,user_id,status,points,total)
VALUES ('17000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'{"cargo": 25}',25)
ON CONFLICT (id) DO UPDATE SET scwe_id=EXCLUDED.scwe_id,user_id=EXCLUDED.user_id,status=EXCLUDED.status,points=EXCLUDED.points,total=EXCLUDED.total,updated_at=NOW();

INSERT INTO news.news_type (id,name,color,image_url) OVERRIDING SYSTEM VALUE
VALUES (900001,'Validation','#336699','/assets/images/home/space-journey.webp')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,image_url=EXCLUDED.image_url;
INSERT INTO news.news (id,title,content,image_url,type_id,author,created_at) OVERRIDING SYSTEM VALUE
VALUES (900001,'Actualité de validation','Contenu jetable pour vérifier listes et détail.','/assets/images/home/space-journey.webp',900001,'validation_admin',NOW())
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,image_url=EXCLUDED.image_url,type_id=EXCLUDED.type_id,author=EXCLUDED.author;

INSERT INTO collections.template (id,name,archetype,axis_x,axis_y,defaults) OVERRIDING SYSTEM VALUE
VALUES (900001,'Collection validation','GRID','["Alpha","Beta"]','["Un","Deux"]','{"checked": []}')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,archetype=EXCLUDED.archetype,axis_x=EXCLUDED.axis_x,axis_y=EXCLUDED.axis_y,defaults=EXCLUDED.defaults;
INSERT INTO collections.user_collection (id,user_id,template_id,name,checked) OVERRIDING SYSTEM VALUE
VALUES (900001,'10000000-0000-0000-0000-000000000001',900001,'Ma collection de validation','["Alpha:Un"]')
ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,template_id=EXCLUDED.template_id,name=EXCLUDED.name,checked=EXCLUDED.checked,updated_at=NOW();

COMMIT;
