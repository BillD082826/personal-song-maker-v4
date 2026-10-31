"""No platform calls: verify durable planning, DST, atomicity and snapshots."""
import concurrent.futures
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'marketing/advertising-dashboard'))
from scheduler_store import SchedulerStore, PlanError

class Plans(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'image.png').write_bytes(b'original image')
        (self.root/'ads.json').write_text(json.dumps([{'id':1,'name':'Example Facebook','platform':'facebook','image':'image.png'},{'id':8,'name':'Draft Pinterest','platform':'pinterest','image':'image.png'}]))
        (self.root/'captions.json').write_text(json.dumps({'facebook':{'1':'Original caption'},'pinterest':{'8':{'title':'Pin','description':'Caption','link':'https://example.com'}}}))
        (self.root/'ad-status.json').write_text(json.dumps({'static-1':'Ready to Post'}))
        self.store=SchedulerStore(self.root,self.root/'private/plans.db')
        self.now=datetime(2026,10,31,12,tzinfo=timezone.utc)
    def tearDown(self):self.temp.cleanup()
    def data(self,time='09:00',day='2026-10-31'):
        return {'ad_id':1,'platform':'facebook','slots':[{'day':day,'time':time}]}
    def test_restart_snapshot_and_cancel(self):
        self.store.add(self.data(),self.now)
        again=SchedulerStore(self.root,self.root/'private/plans.db')
        p=again.state(self.now)['plans'][0]
        self.assertEqual(p['scheduled_at'],'2026-10-31T13:00:00+00:00')
        (self.root/'image.png').write_bytes(b'changed image')
        self.assertEqual(again.artwork(p['snapshot']['image_sha256']),b'original image')
        again.pause(True);self.assertTrue(self.store.state(self.now)['paused'])
        again.cancel(p['id']);self.assertEqual(self.store.state(self.now)['plans'][0]['status'],'canceled')
        self.assertEqual(self.store.state(self.now)['verified_posts'],[])
        self.assertFalse(self.store.state(self.now)['publishing_enabled'])
    def test_dst_and_horizon(self):
        with self.assertRaises(PlanError):self.store.add(self.data('01:30','2026-11-01'),self.now)
        self.store.add(self.data('09:00','2026-11-01'),self.now)
        self.assertEqual(self.store.state(self.now)['plans'][0]['scheduled_at'],'2026-11-01T14:00:00+00:00')
        with self.assertRaises(PlanError):self.store.add(self.data('07:00'),self.now)
        with self.assertRaises(PlanError):self.store.add(self.data('09:00','2026-11-07'),self.now)
        spring=datetime(2027,3,13,12,tzinfo=timezone.utc)
        with self.assertRaises(PlanError):self.store.add(self.data('02:30','2027-03-14'),spring)
    def test_atomic_conflict(self):
        self.store.add(self.data(),self.now)
        d=self.data('13:00');d['slots'].append({'day':'2026-10-31','time':'09:00'})
        with self.assertRaises(PlanError):self.store.add(d,self.now)
        self.assertEqual(len(self.store.state(self.now)['plans']),1)
    def test_concurrent_same_slot(self):
        def attempt(_):
            try:self.store.add(self.data(),self.now);return True
            except PlanError:return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            self.assertEqual(sum(ex.map(attempt,range(2))),1)
    def test_status_platform_and_batch_validation(self):
        d=self.data();d['ad_id']=8;d['platform']='pinterest'
        with self.assertRaises(PlanError):self.store.add(d,self.now)
        d=self.data();d['platform']='instagram'
        with self.assertRaises(PlanError):self.store.add(d,self.now)
        d=self.data();d['slots']*=22
        with self.assertRaises(PlanError):self.store.add(d,self.now)
        d=self.data();d['caption']='<img onerror=alert(1)>caption'
        self.store.add(d,self.now) # Stored as data; UI renders via textContent.
        state=self.store.state(datetime(2026,11,2,tzinfo=timezone.utc))
        self.assertIn('review required',state['plans'][0]['display_status'])

if __name__=='__main__':unittest.main()
