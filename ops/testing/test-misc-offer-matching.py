"""Read-only PostgreSQL regression checks for the actual source/effective matching SQL.
Run from any directory; requires a migrated local validation database and Docker.
"""
from pathlib import Path
import argparse
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--docker', default=shutil.which('docker') or 'C:/Users/floga/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe')
parser.add_argument('--container', default='iceforge_dev-db-1')
parser.add_argument('--database', default='qol_catalog_verify')
parser.add_argument('--user', default='iceforge')
args = parser.parse_args()
source = (ROOT / 'icy_backend/src/main/java/com/icy/icy_backend/service/catalog/CatalogEconomyMapper.java').read_text(encoding='utf-8')


def expression_at(text, start):
    """Extract a balanced COALESCE expression without depending on indentation."""
    depth = 0
    quoted = False
    index = start
    while index < len(text):
        char = text[index]
        if char == "'":
            if quoted and index + 1 < len(text) and text[index + 1] == "'":
                index += 2
                continue
            quoted = not quoted
        elif not quoted:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
                if depth == 0:
                    return text[start:index + 1], index + 1
        index += 1
    raise ValueError('Matching SQL expression is incomplete')


values_start = source.index(') VALUES (')
first_start = source.index('COALESCE(', values_start)
effective, after = expression_at(source, first_start)
source_match, _ = expression_at(source, source.index('COALESCE(', after))


def row(identifier, name, uuid='', maker='Musashi Industrial and Starflight Concern'):
    return f"({identifier},'STAR_CITIZEN_WIKI','{uuid}','{name}',TRUE,'SHIP','{maker}')"


cases = [
    ('uuid-priority', [row(1, 'Other', 'known'), row(2, 'MISC Prospector')], 'known', True, 1),
    ('exact-priority', [row(1, 'Prospector'), row(2, 'MISC Prospector')], None, True, 1),
    ('unique-alias', [row(2, 'MISC Prospector')], None, True, 2),
    ('ambiguous', [row(2, 'MISC Prospector'), row(3, 'MISC Prospector')], None, True, None),
    ('variant-preserved', [row(2, 'MISC Prospector Wikelo Work Special')], None, True, None),
    ('manufacturer-guard', [row(2, 'MISC Prospector', maker='Other')], None, True, None),
    ('item-guard', [row(2, 'MISC Prospector')], None, False, None),
]
queries = ['BEGIN READ ONLY;']
for field, expression in [('effective', effective), ('source', source_match)]:
    expression = expression.replace('catalog.entries', 'fixture_entries')
    for name, rows, uuid, vehicle, expected in cases:
        sql = expression.replace(':entityExternalId', 'NULL' if uuid is None else "'" + uuid + "'")
        sql = sql.replace(':entityName', "'Prospector'").replace(':vehicleOffer', 'TRUE' if vehicle else 'FALSE')
        queries.append('WITH fixture_entries(id,source,external_id,name,active,family,manufacturer) AS (VALUES '
                       + ','.join(rows) + ') ' + f"SELECT '{field}-{name}',({sql}) IS NOT DISTINCT FROM "
                       + ('NULL' if expected is None else str(expected)) + ';')

migration = (ROOT / 'icy_backend/src/main/resources/db/migration/V32__interface_catalogue_and_publication.sql').read_text(encoding='utf-8-sig')
match = re.search(r'WITH matches AS \([\s\S]*?\)\s*(?=UPDATE catalog\.offers o SET)', migration)
if not match:
    raise ValueError('MISC offer backfill CTE not found in consolidated V32')
queries.append(match.group(0) + "SELECT 'migration-candidates',count(*) FROM matches;")
queries.append('COMMIT;')
result = subprocess.run([args.docker, 'exec', '-i', args.container, 'psql', '-U', args.user,
                         '-d', args.database, '-At', '-v', 'ON_ERROR_STOP=1'],
                        input='\n'.join(queries), text=True, encoding='utf-8', capture_output=True, timeout=120)
print(result.stdout, end='')
if result.stderr:
    print(result.stderr, end='')
checks = [line for line in result.stdout.splitlines() if line.startswith(('effective-', 'source-'))]
if result.returncode or len(checks) != len(cases) * 2 or any(not line.endswith('|t') for line in checks):
    raise SystemExit(1)
print(f'{len(checks)} matching checks passed; consolidated V32 CTE parsed successfully.')
