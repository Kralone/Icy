\set ON_ERROR_STOP on
-- Donnees de demonstration QOL, uniquement pour iceforge_dev. Rejouable sans ecraser les essais.
BEGIN;
DO $$ BEGIN
 IF (SELECT count(*) FROM core.users WHERE username IN ('validation_user','validation_officier','validation_admin')) <> 3
 THEN RAISE EXCEPTION 'Les trois comptes de developpement sont requis'; END IF;
END $$;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('26091000-0000-0000-e001-000000000001','VALIDATION','DÉMO · Minage en équipage — ce soir','Données de démonstration locales. Venez tester le calendrier, le détail, les réponses et la flotte mobilisée.',(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '2 hours',((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '2 hours') + interval '3 hours',false,'VALIDATION','10000000-0000-0000-0000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000011','26091000-0000-0000-e001-000000000001','10000000-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000012','26091000-0000-0000-e001-000000000001','10000000-0000-0000-0000-000000000002',0) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000013','26091000-0000-0000-e001-000000000001','10000000-0000-0000-0000-000000000003',-1) ON CONFLICT DO NOTHING;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('26091000-0000-0000-e001-000000000002','VALIDATION','DÉMO · Escorte du convoi de raffinage','Données de démonstration locales. Venez tester le calendrier, le détail, les réponses et la flotte mobilisée.',date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '1 days 20 hours',(date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '1 days 20 hours') + interval '3 hours',false,'VALIDATION','10000000-0000-0000-0000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000021','26091000-0000-0000-e001-000000000002','10000000-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000022','26091000-0000-0000-e001-000000000002','10000000-0000-0000-0000-000000000002',0) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000023','26091000-0000-0000-e001-000000000002','10000000-0000-0000-0000-000000000003',-1) ON CONFLICT DO NOTHING;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('26091000-0000-0000-e001-000000000003','VALIDATION','DÉMO · Exploration et reconnaissance','Données de démonstration locales. Venez tester le calendrier, le détail, les réponses et la flotte mobilisée.',date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '3 days 20 hours',(date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '3 days 20 hours') + interval '3 hours',false,'VALIDATION','10000000-0000-0000-0000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000031','26091000-0000-0000-e001-000000000003','10000000-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000032','26091000-0000-0000-e001-000000000003','10000000-0000-0000-0000-000000000002',0) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000033','26091000-0000-0000-e001-000000000003','10000000-0000-0000-0000-000000000003',-1) ON CONFLICT DO NOTHING;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('26091000-0000-0000-e001-000000000004','VALIDATION','DÉMO · Grande sortie industrielle','Données de démonstration locales. Venez tester le calendrier, le détail, les réponses et la flotte mobilisée.',date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '7 days 20 hours',(date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '7 days 20 hours') + interval '3 hours',false,'VALIDATION','10000000-0000-0000-0000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000041','26091000-0000-0000-e001-000000000004','10000000-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000042','26091000-0000-0000-e001-000000000004','10000000-0000-0000-0000-000000000002',0) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000043','26091000-0000-0000-e001-000000000004','10000000-0000-0000-0000-000000000003',-1) ON CONFLICT DO NOTHING;
INSERT INTO events.events (id,type,title,description,start_date_time,end_date_time,finished,event_type,creator_id)
VALUES ('26091000-0000-0000-e001-000000000005','VALIDATION','DÉMO · Débrief de la dernière opération','Données de démonstration locales. Venez tester le calendrier, le détail, les réponses et la flotte mobilisée.',date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '-2 days 20 hours',(date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris') + interval '-2 days 20 hours') + interval '3 hours',true,'VALIDATION','10000000-0000-0000-0000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000051','26091000-0000-0000-e001-000000000005','10000000-0000-0000-0000-000000000001',1) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000052','26091000-0000-0000-e001-000000000005','10000000-0000-0000-0000-000000000002',0) ON CONFLICT DO NOTHING;
INSERT INTO events.event_participation(id,event_id,user_id,status) VALUES('26091000-0000-0000-e002-000000000053','26091000-0000-0000-e001-000000000005','10000000-0000-0000-0000-000000000003',-1) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheets(id,sheet_name,operation_date,refinery_location,sale_location,status,created_by_user_id)
VALUES('26091000-0000-0000-a001-000000000001','DÉMO · 1 — Vente et remboursement des avances',CURRENT_DATE,'ARC-L1 Wide Forest Station',NULL,'OPEN','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000011','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000011','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000001','REFINERY','Dinyx Solventation',360,0,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '-1 hour','DÉMO : mêmes quantités par membre pour une répartition des ventes à parts égales') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000011','26091000-0000-0000-a003-000000000011','Quantanium',2000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000013','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000013','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000003','REFINERY','Dinyx Solventation',360,0,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '-1 hour','DÉMO : mêmes quantités par membre pour une répartition des ventes à parts égales') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000013','26091000-0000-0000-a003-000000000013','Quantanium',2000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,cost_auec,notes)
VALUES('26091000-0000-0000-a005-000000000001','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000003','MATERIAL',100000,'DÉMO : frais avancés par validation_admin, à compenser dans le bilan final.') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_sales(id,sheet_id,declared_by_user_id,credit_auec)
VALUES('26091000-0000-0000-a006-000000000001','26091000-0000-0000-a001-000000000001','10000000-0000-0000-0000-000000000003',1000000) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheets(id,sheet_name,operation_date,refinery_location,sale_location,status,created_by_user_id)
VALUES('26091000-0000-0000-a001-000000000002','DÉMO · 2 — Raffinage en cours, sans vente',CURRENT_DATE,'ARC-L1 Wide Forest Station',NULL,'OPEN','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000021','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000021','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000001','REFINERY','Dinyx Solventation',360,10000,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '4 hours','DÉMO : raffinage en cours, estimation selon le catalogue local') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000021','26091000-0000-0000-a003-000000000021','Quantanium',1000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000022','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000022','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000002','REFINERY','Dinyx Solventation',360,20000,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '4 hours','DÉMO : raffinage en cours, estimation selon le catalogue local') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000022','26091000-0000-0000-a003-000000000022','Quantanium',2000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000023','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000023','26091000-0000-0000-a001-000000000002','10000000-0000-0000-0000-000000000003','REFINERY','Dinyx Solventation',360,30000,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '4 hours','DÉMO : raffinage en cours, estimation selon le catalogue local') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000023','26091000-0000-0000-a003-000000000023','Quantanium',3000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheets(id,sheet_name,operation_date,refinery_location,sale_location,status,created_by_user_id)
VALUES('26091000-0000-0000-a001-000000000003','DÉMO · 3 — Session déficitaire',CURRENT_DATE,'ARC-L1 Wide Forest Station',NULL,'OPEN','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000031','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000031','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000001','REFINERY','Dinyx Solventation',360,0,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '-1 hour','DÉMO : mêmes quantités par membre pour une répartition des ventes à parts égales') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000031','26091000-0000-0000-a003-000000000031','Quantanium',2000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_members(id,sheet_id,user_id) VALUES('26091000-0000-0000-a002-000000000033','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,refinery_method,duration_minutes,cost_auec,published_at,finish_at,notes)
VALUES('26091000-0000-0000-a003-000000000033','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000003','REFINERY','Dinyx Solventation',360,0,CURRENT_TIMESTAMP - interval '2 hours',CURRENT_TIMESTAMP + interval '-1 hour','DÉMO : mêmes quantités par membre pour une répartition des ventes à parts égales') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale)
VALUES('26091000-0000-0000-a004-000000000033','26091000-0000-0000-a003-000000000033','Quantanium',2000,true) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_jobs(id,sheet_id,owner_user_id,type,cost_auec,notes)
VALUES('26091000-0000-0000-a005-000000000003','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000003','REPAIR',150000,'DÉMO : frais avancés par validation_admin, à compenser dans le bilan final.') ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_sales(id,sheet_id,declared_by_user_id,credit_auec)
VALUES('26091000-0000-0000-a006-000000000003','26091000-0000-0000-a001-000000000003','10000000-0000-0000-0000-000000000003',50000) ON CONFLICT DO NOTHING;
INSERT INTO mining.mining_sheet_job_ores(id,job_id,ore_name,quantity_cscu,include_in_sale) VALUES('26091000-0000-0000-a004-000000000099','26091000-0000-0000-a003-000000000021','Bexalite',500,false) ON CONFLICT DO NOTHING;
INSERT INTO events.event_types(name,text_color,image_url,background_color) VALUES
('DÉMO MINAGE','#d1fae5','/assets/images/home/activities/mining.jpg','#047857'),
('DÉMO ESCORTE','#fef3c7','/assets/images/home/activities/space-combat.jpg','#b45309'),
('DÉMO EXPLORATION','#ede9fe','/assets/images/home/space-journey.webp','#7c3aed'),
('DÉMO CONVOI','#cffafe','/assets/images/home/activities/cargo.jpg','#0e7490')
ON CONFLICT(name) DO NOTHING;
UPDATE events.events SET type=CASE right(id::text,1) WHEN '1' THEN 'DÉMO MINAGE' WHEN '2' THEN 'DÉMO ESCORTE' WHEN '3' THEN 'DÉMO EXPLORATION' ELSE 'DÉMO CONVOI' END,
event_type=CASE right(id::text,1) WHEN '1' THEN 'DÉMO MINAGE' WHEN '2' THEN 'DÉMO ESCORTE' WHEN '3' THEN 'DÉMO EXPLORATION' ELSE 'DÉMO CONVOI' END
WHERE id::text LIKE '26091000-0000-0000-e001-%' AND type='VALIDATION';
COMMIT;
SELECT sheet_name FROM mining.mining_sheets WHERE id::text LIKE '26091000-%';
SELECT title,start_date_time FROM events.events WHERE id::text LIKE '26091000-%' ORDER BY start_date_time;
