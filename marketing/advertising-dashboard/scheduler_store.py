"""Durable local plans. Deliberately contains no publishing client or timed sender."""
import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo('America/New_York')
PLATFORMS = ('facebook', 'instagram', 'pinterest')

class PlanError(ValueError):
    pass

class SchedulerStore:
    def __init__(self, root, database):
        self.root = Path(root)
        self.database = Path(database)
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS scheduler_media (sha256 TEXT PRIMARY KEY, image BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS scheduler_settings (id INTEGER PRIMARY KEY CHECK(id=1), paused INTEGER NOT NULL DEFAULT 0);
            INSERT OR IGNORE INTO scheduler_settings(id) VALUES(1);
            CREATE TABLE IF NOT EXISTS scheduler_plans (
              id TEXT PRIMARY KEY, platform TEXT NOT NULL, scheduled_at TEXT NOT NULL,
              local_day TEXT NOT NULL, local_time TEXT NOT NULL, snapshot TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'planned', created_at TEXT NOT NULL, canceled_at TEXT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS scheduler_active_slot ON scheduler_plans(platform, scheduled_at) WHERE status='planned';
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.database, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def artwork(self, digest):
        with self.connect() as db:
            row = db.execute('SELECT image FROM scheduler_media WHERE sha256=?',(digest,)).fetchone()
        return bytes(row[0]) if row else None

    def catalog(self):
        ads = json.loads((self.root/'ads.json').read_text())
        captions = json.loads((self.root/'captions.json').read_text())
        statuses = json.loads((self.root/'ad-status.json').read_text())
        result = []
        for a in ads:
            if a.get('images'):
                continue
            a = dict(a)
            c = captions.get(a['platform'], {}).get(str(a['id']), '')
            a['caption'] = c.get('description', '') if isinstance(c, dict) else c
            a['pin_title'] = c.get('title', '') if isinstance(c, dict) else ''
            a['destination'] = c.get('link', '') if isinstance(c, dict) else ''
            a['ready'] = statuses.get('static-'+str(a['id']), 'Draft') == 'Ready to Post'
            result.append(a)
        return result

    def state(self, now=None):
        now = now or datetime.now(timezone.utc)
        with self.connect() as db:
            paused = bool(db.execute('SELECT paused FROM scheduler_settings WHERE id=1').fetchone()[0])
            rows = db.execute('SELECT * FROM scheduler_plans ORDER BY scheduled_at,platform').fetchall()
        plans = []
        for row in rows:
            p = dict(row)
            p['snapshot'] = json.loads(p['snapshot'])
            p['display_status'] = ('Canceled' if p['status']=='canceled' else
                'Past due — review required' if p['scheduled_at'] <= now.isoformat(timespec='seconds') else
                'Paused — publishing not connected' if paused else 'Planned — publishing not connected')
            plans.append(p)
        return {'plans': plans, 'paused': paused, 'publishing_enabled': False,
                'time_zone': 'America/New_York', 'today': now.astimezone(EASTERN).date().isoformat(),
                'verified_posts': [], 'catalog': self.catalog()}

    def add(self, data, now=None):
        now = now or datetime.now(timezone.utc)
        ad = next((a for a in self.catalog() if a['id']==data.get('ad_id') and a['platform']==data.get('platform')), None)
        if not ad or not ad['ready']:
            raise PlanError('Choose an advertisement saved as Ready to Post for this platform.')
        slots = data.get('slots')
        if not isinstance(slots,list) or not 1 <= len(slots) <= 21:
            raise PlanError('Choose between 1 and 21 times for one platform.')
        caption = data.get('caption', ad['caption'])
        title = data.get('pin_title', ad['pin_title'])
        destination = data.get('destination', ad['destination'])
        if not isinstance(caption,str) or not caption.strip() or len(caption)>12000:
            raise PlanError('Enter a caption of up to 12,000 characters.')
        if not isinstance(title,str) or len(title)>100 or not isinstance(destination,str) or len(destination)>2048:
            raise PlanError('Check the Pinterest title and destination.')
        if ad['platform']=='pinterest':
            from urllib.parse import urlsplit
            u=urlsplit(destination)
            if not title.strip() or u.scheme!='https' or not u.netloc or u.username or u.password:
                raise PlanError('Pinterest needs a title and a valid HTTPS destination.')
        image = (self.root/ad['image']).resolve()
        if self.root.resolve() not in image.parents or not image.is_file():
            raise PlanError('The selected advertisement image is unavailable.')
        image_bytes = image.read_bytes()
        snapshot = {'ad_id':ad['id'], 'name':ad['name'], 'platform':ad['platform'], 'image':ad['image'],
                    'image_sha256':hashlib.sha256(image_bytes).hexdigest(), 'caption':caption,
                    'pin_title':title, 'destination':destination, 'time_zone':'America/New_York'}
        entries = []
        for slot in slots:
            if not isinstance(slot,dict):
                raise PlanError('Invalid date or time.')
            try:
                wall = datetime.strptime(slot['day']+' '+slot['time'], '%Y-%m-%d %H:%M')
            except (ValueError,KeyError,TypeError):
                raise PlanError('Choose a valid date and time.')
            valid = set()
            for fold in (0,1):
                utc=wall.replace(tzinfo=EASTERN,fold=fold).astimezone(timezone.utc)
                if utc.astimezone(EASTERN).replace(tzinfo=None)==wall:
                    valid.add(utc)
            if len(valid)!=1:
                raise PlanError('That Eastern time is skipped or repeated by daylight saving. Choose another time.')
            instant=valid.pop()
            today=now.astimezone(EASTERN).date()
            if not today <= wall.date() < today+timedelta(days=7) or instant<=now:
                raise PlanError('Choose a future time within the next seven Eastern calendar days.')
            entries.append((str(uuid.uuid4()),ad['platform'],instant.isoformat(timespec='seconds'),wall.date().isoformat(),wall.strftime('%H:%M'),json.dumps(snapshot),now.isoformat(timespec='seconds')))
        try:
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                db.execute('INSERT OR IGNORE INTO scheduler_media(sha256,image) VALUES(?,?)',(snapshot['image_sha256'],image_bytes))
                db.executemany('INSERT INTO scheduler_plans(id,platform,scheduled_at,local_day,local_time,snapshot,created_at) VALUES(?,?,?,?,?,?,?)',entries)
        except sqlite3.IntegrityError:
            raise PlanError('This platform already has a plan at one of those times. No new plans were saved.')
        return len(entries)

    def pause(self, paused):
        if type(paused) is not bool:
            raise PlanError('Invalid pause setting.')
        with self.connect() as db:
            db.execute('UPDATE scheduler_settings SET paused=? WHERE id=1',(int(paused),))

    def cancel(self, plan_id):
        with self.connect() as db:
            n=db.execute("UPDATE scheduler_plans SET status='canceled',canceled_at=? WHERE id=? AND status='planned'",(datetime.now(timezone.utc).isoformat(timespec='seconds'),plan_id)).rowcount
        if not n:
            raise PlanError('This plan is unavailable or already canceled.')
