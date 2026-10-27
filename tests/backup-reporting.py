"""Exercise the real shell control flow with fake database/retention tools."""
import os
from pathlib import Path
import subprocess
import tempfile

source = (Path(__file__).resolve().parents[1] / 'backup/lyribop-backup.sh').read_text()
for case, retention_code, report_code, dump_code, expected in [
    ('success', 0, 0, 0, 0), ('cleanup-warning', 1, 0, 0, 2),
    ('report-failure', 0, 1, 0, 3), ('both-warnings', 1, 1, 0, 3),
    ('backup-failure', 0, 0, 1, 1),
]:
    with tempfile.TemporaryDirectory() as tmp:
        home = Path(tmp)
        (home / '.config/lyribop').mkdir(parents=True)
        (home / '.config/lyribop/backup.env').write_text('LYRIBOP_DB_URL=unused-test-only\n')
        (home / 'Projects/personal-song-maker-v4').mkdir(parents=True)
        (home / 'Projects/personal-song-maker-v4/source.txt').write_text('fixture')
        (home / 'bin').mkdir()
        log = home / 'events'
        (home / 'bin/lyribop-retention.py').write_text(
            'import os\nfrom pathlib import Path\n'
            'with Path(os.environ["EVENT_LOG"]).open("a") as f: f.write("retention\\n")\n'
            f'raise SystemExit({retention_code})\n')
        tools = {}
        for name, body in {
            'pg_dump': f'exit {dump_code}',
            'pg_restore': 'exit 0',
            'psql': 'echo "report:$*" >> "$EVENT_LOG"\ncat >> "$EVENT_LOG"\nexit '+str(report_code),
        }.items():
            tool = home / name
            tool.write_text('#!/bin/bash\n'+body+'\n')
            tool.chmod(0o700)
            tools[name] = tool
        script = source
        for name, path in tools.items():
            script = script.replace('/Library/PostgreSQL/18/bin/'+name, str(path))
        test_script = home / 'backup.sh'
        test_script.write_text(script)
        result = subprocess.run(['/bin/bash', str(test_script)], env={**os.environ, 'HOME': tmp, 'EVENT_LOG': str(log)}, capture_output=True, text=True)
        assert result.returncode == expected, (case, result.stderr)
        events = log.read_text() if log.exists() else ''
        if dump_code:
            assert not events, events
        else:
            assert events.index('retention') < events.index('report:'), events
            status = 'success_retention_warning' if retention_code else 'success'
            assert 'backup_status='+status in events, events
            assert ":'database_backup'" in events  # psql quotes paths as literals.
        if retention_code or report_code:
            assert 'completed successfully' not in result.stdout
            assert 'artifacts validated; follow-up required' in result.stderr
        print(case+': PASS')
