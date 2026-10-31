import concurrent.futures
import functools
import http.client
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]/'marketing/advertising-dashboard'
sys.path.insert(0,str(ROOT))

class HTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        os.environ['LYRIBOP_SCHEDULER_DB']=cls.tmp.name+'/plans.sqlite3'
        spec=importlib.util.spec_from_file_location('dashboard_server',ROOT/'dashboard-server.py');cls.module=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.module)
        cls.server=cls.module.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(cls.module.DashboardHandler,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def request(self,method,path,data=None,extra=None):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port)
        headers={'Host':'127.0.0.1:'+str(self.server.server_port),'Content-Type':'application/json','X-LyriBop-Scheduler':'1','Origin':'http://127.0.0.1:'+str(self.server.server_port)}
        headers.update(extra or {})
        c.request(method,path,None if data is None else json.dumps(data),headers);r=c.getresponse();body=r.read();code=r.status;c.close();return code,body
    def test_63_records_and_protected_routes(self):
        code,body=self.request('GET','/api/scheduler');self.assertEqual(code,200);state=json.loads(body)
        now=datetime.now(ZoneInfo('America/New_York'));days=[(now.date()+timedelta(days=i)).isoformat() for i in range(7)]
        # If today is nearly over, use future minutes for today's three distinct slots.
        # Test deterministic volume with store's injectable time, then verify all records through HTTP.
        fixed=datetime(2026,10,31,12,tzinfo=timezone.utc)
        slots=[{'day':(fixed.astimezone(ZoneInfo('America/New_York')).date()+timedelta(days=i)).isoformat(),'time':t} for i in range(7) for t in ['09:00','13:00','18:00']]
        for platform in ['facebook','instagram','pinterest']:
            ad=next(a for a in state['catalog'] if a['platform']==platform and a['ready'])
            self.module.SCHEDULER.add({'ad_id':ad['id'],'platform':platform,'slots':slots},fixed)
        code,body=self.request('GET','/api/scheduler');state=json.loads(body)
        self.assertEqual(len(state['plans']),63);self.assertEqual(state['verified_posts'],[])
        self.assertFalse(state['publishing_enabled'])
        p=state['plans'][0];digest=p['snapshot']['image_sha256']
        code,image=self.request('GET','/api/scheduler/artwork/'+digest)
        self.assertEqual(code,200);self.assertTrue(image.startswith(b'\x89PNG'))
        self.assertEqual(self.request('POST','/api/scheduler/pause',{'paused':True})[0],200)
        self.assertTrue(json.loads(self.request('GET','/api/scheduler')[1])['paused'])
        self.assertEqual(self.request('POST','/api/scheduler/cancel',{'id':p['id']})[0],200)
        self.assertEqual(self.request('POST','/api/scheduler/pause',{'paused':False},{'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('POST','/api/scheduler/pause',{'paused':False},{'X-LyriBop-Scheduler':''})[0],403)
        self.assertEqual(self.request('GET','/api/scheduler',extra={'Host':'evil.example'})[0],403)
        self.assertEqual(self.request('GET','/.scheduler-data/plans.sqlite3')[0],403)
        self.assertEqual(self.request('GET','/%2escheduler-data/plans.sqlite3')[0],403)
        self.assertEqual(self.request('GET','/scheduler.html')[0],200)
        self.assertEqual(self.request('POST','/api/scheduler/pause',{'paused':'false'})[0],400)
        self.assertEqual(self.request('POST','/api/scheduler/publish',{})[0],404)

if __name__=='__main__':unittest.main()
