"""Exercise the actual inventory canonicalization against PostgreSQL, read-only."""
from pathlib import Path
import argparse
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--docker', default=shutil.which('docker') or 'C:/Users/floga/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe')
parser.add_argument('--container', default='iceforge_dev-db-1')
parser.add_argument('--database', default='qol_catalog_verify')
parser.add_argument('--user', default='iceforge')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
inventory = (root / 'ops/backups/postgres-inventory.sql').read_text(encoding='utf-8')
query = inventory[inventory.index('WITH RECURSIVE'):inventory.index('ORDER BY view_name;') + len('ORDER BY view_name;')]
base = "SELECT id FROM catalog.entries WHERE family = ANY (ARRAY['SHIP'::character varying, 'GROUND_VEHICLE'::character varying]::text[]) AND id > 0;"
restored = base.replace("ARRAY['SHIP'::character varying, 'GROUND_VEHICLE'::character varying]::text[]", "ARRAY['SHIP'::character varying::text, 'GROUND_VEHICLE'::character varying::text]")
fixtures = [('source',base), ('restored',restored), ('predicate_changed',restored.replace('id > 0','id >= 0')), ('variant_changed',restored.replace("'SHIP'", "'OTHER'")), ('literal_source',base.replace("'SHIP'", "'x::character varying'")), ('literal_restored',restored.replace("'SHIP'", "'x::character varying'")), ('literal_changed',restored.replace("'SHIP'", "'x::text'"))]
quote = lambda text: "'" + text.replace("'", "''") + "'"
values = ','.join('(' + quote(name) + ',' + quote(definition) + ')' for name,definition in fixtures)
start=query.index('view_definitions AS (')
end=query.index('),\narray_pattern AS (',start)
query=query[:start]+'view_definitions AS ( SELECT * FROM (VALUES '+values+') fixtures(view_name,definition)\n'+query[end:]
result=subprocess.run([args.docker,'exec','-i',args.container,'psql','-U',args.user,'-d',args.database,'-At','-v','ON_ERROR_STOP=1'],input='BEGIN READ ONLY;\n'+query+'\nCOMMIT;',text=True,encoding='utf-8',capture_output=True,timeout=30)
if result.returncode:
    print(result.stderr)
    raise SystemExit(result.returncode)
hashes={line.split('|')[1]:line.split('|')[2] for line in result.stdout.splitlines() if line.startswith('view|')}
assert len(hashes)==len(fixtures), hashes
assert hashes['source']==hashes['restored'], 'Equivalent array cast differs'
assert hashes['source']!=hashes['predicate_changed'], 'Real predicate change was hidden'
assert hashes['source']!=hashes['variant_changed'], 'Changed literal was hidden'
assert hashes['literal_source']==hashes['literal_restored'], 'Literal content was modified'
assert hashes['literal_restored']!=hashes['literal_changed'], 'Cast-like literal content was incorrectly normalized'
print('PASS: equivalent casts match; changed predicates and literal values remain detected (7 fixtures).')
