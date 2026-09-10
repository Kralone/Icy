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

-- pg_dump/restore can move the varchar-to-text cast from a constant array
-- to its elements. Canonicalize ONLY these two equivalent literal-array forms;
-- all other SQL, literal values and predicates remain part of the view hash.
WITH RECURSIVE
view_definitions AS (
    SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS view_name,
           pg_get_viewdef(c.oid, true) AS definition
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND n.nspname !~ '^pg_'
      AND n.nspname <> 'information_schema'
),
array_pattern AS (
    SELECT $pattern$(ARRAY\['(?:[^']|'')*'::character varying(?:, '(?:[^']|'')*'::character varying)*\]::text\[\]|ARRAY\['(?:[^']|'')*'::character varying::text(?:, '(?:[^']|'')*'::character varying::text)*\])$pattern$ AS pattern
),
canonical_views AS (
    SELECT view_name, definition FROM view_definitions
    UNION ALL
    SELECT current.view_name,
           replace(current.definition, matched.parts[1],
               regexp_replace(
                   regexp_replace(matched.parts[1],
                       $literal$('(?:[^']|'')*')::character varying(?:::text)?$literal$,
                       E'\\1::text', 'g'),
                   $tail$\]::text\[\]$$tail$, ']', ''))
    FROM canonical_views current
    CROSS JOIN array_pattern patterns
    CROSS JOIN LATERAL (SELECT regexp_match(current.definition, patterns.pattern) AS parts) matched
    WHERE matched.parts IS NOT NULL
)
SELECT 'view|' || view_name || '|' || md5(definition)
FROM canonical_views
CROSS JOIN array_pattern patterns
WHERE regexp_match(definition, patterns.pattern) IS NULL
ORDER BY view_name;

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
