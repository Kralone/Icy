SELECT md5(jsonb_build_object(
'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_schema,table_name,ordinal_position) FROM
(SELECT table_schema,table_name,column_name,data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale,is_nullable,column_default,ordinal_position
 FROM information_schema.columns WHERE (table_schema='public' AND table_name IN ('ore_locations','ore_location_ores'))
 OR (table_schema='utils' AND table_name='uex_dataset_cache')) c),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE
 (conrelid='catalog.entries'::regclass AND conname='chk_catalog_entry_family') OR
 (conrelid='catalog.sync_runs'::regclass AND conname='chk_catalog_sync_scope')),
'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='utils' AND tablename='uex_dataset_cache')
)::text) AS resources_schema_signature;
