import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
parser.add_argument('--apply', action='store_true')
parser.add_argument('--new-set')
parser.add_argument('--registry', type=Path, default=Path.home()/'.config/lyribop/backup-sets.json')
args = parser.parse_args()
pattern = re.compile(r'^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$')

def save(stamps):
    temp = args.registry.with_suffix('.tmp')
    temp.write_text(json.dumps({'version': 1, 'sets': sorted(stamps)}, indent=2)+'\n')
    os.chmod(temp, 0o600)
    temp.replace(args.registry)

def paths(stamp):
    return (args.directory/('LyriBop-database-'+stamp+'.dump'),
            args.directory/('LyriBop-source-'+stamp+'.tar.gz'))

try:
    # This list is initialized from Terminal; background runs never enumerate iCloud.
    with args.registry.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        registry = json.loads(args.registry.read_text())
        assert registry.get('version') == 1, 'Unsupported backup registry.'
        stamps = registry['sets']
        assert isinstance(stamps, list) and stamps, 'Backup registry is empty; refusing cleanup.'
        assert all(isinstance(s,str) and pattern.fullmatch(s) for s in stamps), 'Invalid backup names.'
        assert len(stamps) == len(set(stamps)), 'Duplicate registry entries.'
        stamps = set(stamps)
        if args.new_set:
            assert pattern.fullmatch(args.new_set), 'Invalid new backup timestamp.'
            stamps.add(args.new_set)
        for stamp in stamps:
            for p in paths(stamp):
                assert p.is_file() and p.stat().st_size > 0, 'Missing or empty backup: '+p.name
        ordered = sorted(stamps, reverse=True)
        print('Complete tracked backup sets:', len(ordered), flush=True)
        if args.apply:
            # Persist the new pair before attempting any cleanup.
            save(stamps)
        for stamp in ordered[12:]:
            if not args.apply:
                print('WOULD REMOVE PAIR:', stamp, flush=True)
                continue
            for p in paths(stamp):
                p.unlink()
                print('REMOVED:', p.name, flush=True)
            stamps.remove(stamp)
            save(stamps)
        print('Retained backup sets:', len(stamps), flush=True)
except (OSError, ValueError, KeyError, AssertionError) as error:
    print('ERROR: Backup retention failed: '+str(error), file=sys.stderr, flush=True)
    sys.exit(1)
