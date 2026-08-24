\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT 'server_version_num|' || current_setting('server_version_num');
SELECT 'server_encoding|' || current_setting('server_encoding');
SELECT 'database_collation|' || datcollate || '|' || datctype
FROM pg_database
WHERE datname = current_database();

SELECT 'extension|' || extname || '|' || extversion
FROM pg_extension
ORDER BY extname;

SELECT 'schema|' || quote_ident(nspname)
FROM pg_namespace
WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
ORDER BY nspname;

SELECT 'view|' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || '|' || md5(pg_get_viewdef(c.oid, true))
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname !~ '^pg_'
  AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname;

SELECT format(
  'SELECT %L || count(*)::text FROM %I.%I;',
  'table|' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || '|',
  n.nspname,
  c.relname
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname !~ '^pg_'
  AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname
\gexec

SELECT 'sequence|' || quote_ident(n.nspname) || '.' || quote_ident(c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'S'
  AND n.nspname !~ '^pg_'
  AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname;

SELECT 'flyway|' || installed_rank::text || '|' || coalesce(version, '') || '|' ||
       script || '|' || coalesce(checksum::text, '') || '|' || success::text
FROM public.flyway_schema_history
ORDER BY installed_rank;
