import {FacebookPilotApprovals} from './facebook-pilot-approvals.mjs';
import {readFacebookPilotReview} from './facebook-pilot-review.mjs';
import {readSchedulerDryRun} from './ad-scheduler-dry-run.mjs';
import {verifiedFacebookTests} from './facebook-test-post.mjs';
import {verifiedInstagramTests} from './instagram-test-post.mjs';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../marketing/advertising-dashboard/', import.meta.url));
const ZONE = 'America/New_York';
const eastern = new Intl.DateTimeFormat('en-CA', {timeZone:ZONE, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function parts(date) { return Object.fromEntries(eastern.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value])); }
export function easternDay(date) {const p=parts(date);return `${p.year}-${p.month}-${p.day}`;}
export function resolveScheduledTime(day, time, now=new Date()) {
  if(typeof day!=='string'||typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Choose a valid date and time.');
  const naive=new Date(`${day}T${time}:00Z`);
  if(!Number.isFinite(+naive)||naive.toISOString().slice(0,10)!==day)throw new Error('Choose a valid date.');
  const offsets=new Set();
  for(const shift of [-24,0,24]){
    const sample=new Date(+naive+shift*3600000),p=parts(sample);
    offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)-Math.floor(+sample/60000)*60000);
  }
  const candidates=[...offsets].map(offset=>new Date(+naive-offset)).filter(date=>{const p=parts(date);return easternDay(date)===day&&`${p.hour}:${p.minute}`===time;});
  if(candidates.length!==1)throw new Error('That Eastern time is skipped or repeated by daylight saving. Choose another time.');
  const last=new Date(easternDay(now)+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+6);
  if(day<easternDay(now)||day>last.toISOString().slice(0,10)||+candidates[0]<=+now)throw new Error('Choose a future time within the next seven Eastern calendar days.');
  return candidates[0].toISOString();
}
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS ad_scheduler_settings (id INTEGER PRIMARY KEY CHECK(id=1),paused BOOLEAN NOT NULL DEFAULT FALSE);
INSERT INTO ad_scheduler_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ad_scheduler_media (sha256 TEXT PRIMARY KEY,image BYTEA NOT NULL);
CREATE TABLE IF NOT EXISTS ad_scheduler_plans (
 id UUID PRIMARY KEY,platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','pinterest')),
 scheduled_at TIMESTAMPTZ NOT NULL,local_day TEXT NOT NULL,local_time TEXT NOT NULL,
 snapshot JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','canceled')),
 created_at TIMESTAMPTZ NOT NULL,canceled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ad_scheduler_active_slot ON ad_scheduler_plans(platform,scheduled_at) WHERE status='planned';
`;
export async function loadSchedulerCatalog(root=ROOT) {
  const [ads,captions,statuses]=await Promise.all(['ads.json','captions.json','ad-status.json'].map(async f=>JSON.parse(await readFile(resolve(root,f),'utf8'))));
  return ads.filter(a=>!a.images).map(a=>{
    const c=captions[a.platform]?.[String(a.id)]||'';
    return {...a,caption:typeof c==='string'?c:c.description||'',pin_title:typeof c==='object'?c.title||'':'',destination:typeof c==='object'?c.link||'':'',ready:statuses[`static-${a.id}`]==='Ready to Post'};
  });
}
export function validatePlan(data,catalog,now=new Date()) {
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid plan.');
  const ad=catalog.find(a=>Number.isInteger(data.ad_id)&&a.id===data.ad_id&&a.platform===data.platform&&a.ready);
  if(!ad)throw new Error('Choose an advertisement saved as Ready to Post for this platform.');
  if(!Array.isArray(data.slots)||!data.slots.length||data.slots.length>21)throw new Error('Choose between 1 and 21 times for one platform.');
  const caption=data.caption??ad.caption,title=data.pin_title??ad.pin_title,destination=data.destination??ad.destination;
  if(typeof caption!=='string'||!caption.trim()||caption.length>12000)throw new Error('Enter a caption of up to 12,000 characters.');
  if(typeof title!=='string'||title.length>100||typeof destination!=='string'||destination.length>2048)throw new Error('Check the Pinterest title and destination.');
  if(ad.platform==='pinterest'){
    let url;try{url=new URL(destination);}catch{}
    if(!title.trim()||!url||url.protocol!=='https:'||url.username||url.password)throw new Error('Pinterest needs a title and a valid HTTPS destination.');
  }
  const slots=data.slots.map(s=>{
    if(!s||typeof s!=='object')throw new Error('Invalid time slot.');
    return {day:s.day,time:s.time,instant:resolveScheduledTime(s.day,s.time,now)};
  });
  if(new Set(slots.map(s=>s.instant)).size!==slots.length)throw new Error('Choose different time slots.');
  return {ad,caption,title,destination,slots};
}
export class HostedScheduler {
  constructor(pool, {root=ROOT, clock=()=>new Date()}={}) {this.pool=pool;this.root=root;this.clock=clock;this.initializing=null;}
  async ready(){
    if(!this.pool)throw new Error('Scheduler database is not configured.');
    if(!this.initializing)this.initializing=this.pool.query(SCHEMA).catch(e=>{this.initializing=null;throw e;});
    await this.initializing;
  }
  async state(){
    await this.ready();
    const [settings,rows,catalog]=await Promise.all([this.pool.query('SELECT paused FROM ad_scheduler_settings WHERE id=1'),this.pool.query('SELECT * FROM ad_scheduler_plans ORDER BY scheduled_at,platform'),loadSchedulerCatalog(this.root)]);
    const paused=Boolean(settings.rows[0].paused),now=this.clock();
    const plans=rows.rows.map(p=>({...p,scheduled_at:new Date(p.scheduled_at).toISOString(),display_status:p.status==='canceled'?'Canceled':+new Date(p.scheduled_at)<=+now?'Past due — review required':paused?'Paused — publishing not connected':'Planned — publishing not connected'}));
    return {plans,catalog,paused,hosting_mode:'hosted',publishing_enabled:false,verified_posts:[...await verifiedInstagramTests(this.pool),...await verifiedFacebookTests(this.pool)],time_zone:ZONE,today:easternDay(now)};
  }
  async add(data){
    const now=this.clock(),plan=validatePlan(data,await loadSchedulerCatalog(this.root),now);
    const imagePath=resolve(this.root,plan.ad.image);
    if(!imagePath.startsWith(resolve(this.root,'assets/images')+'/')||extname(imagePath).toLowerCase()!=='.png')throw new Error('The selected advertisement image is unavailable.');
    const bytes=await readFile(imagePath);
    if(bytes.length>12*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('The selected image must be a PNG up to 12 MB.');
    const digest=createHash('sha256').update(bytes).digest('hex');
    const snapshot={ad_id:plan.ad.id,name:plan.ad.name,platform:plan.ad.platform,image:plan.ad.image,image_sha256:digest,caption:plan.caption,pin_title:plan.title,destination:plan.destination,time_zone:ZONE};
    await this.ready();const db=await this.pool.connect();
    try{
      await db.query('BEGIN');
      await db.query('INSERT INTO ad_scheduler_media(sha256,image) VALUES($1,$2) ON CONFLICT DO NOTHING',[digest,bytes]);
      for(const slot of plan.slots)await db.query('INSERT INTO ad_scheduler_plans(id,platform,scheduled_at,local_day,local_time,snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),plan.ad.platform,slot.instant,slot.day,slot.time,JSON.stringify(snapshot),now.toISOString()]);
      await db.query('COMMIT');return plan.slots.length;
    }catch(e){await db.query('ROLLBACK');if(e.code==='23505')throw new Error('This platform already has a plan at one of those times. No new plans were saved.');throw e;}
    finally{db.release();}
  }
  async approveFacebookPilot(input){return new FacebookPilotApprovals(this.pool,{clock:this.clock}).approve(input);}
  async revokeFacebookPilot(input){return new FacebookPilotApprovals(this.pool,{clock:this.clock}).revoke(input);}
  async facebookPilotReview(){return readFacebookPilotReview(this.pool,this.clock());}
  async dryRun(){return readSchedulerDryRun(this.pool,this.clock());}
  async pause(paused){if(typeof paused!=='boolean')throw new Error('Invalid pause setting.');await this.ready();await this.pool.query('UPDATE ad_scheduler_settings SET paused=$1 WHERE id=1',[paused]);}
  async cancel(id){
    if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid plan identifier.');
    await this.ready();const r=await this.pool.query("UPDATE ad_scheduler_plans SET status='canceled',canceled_at=$1 WHERE id=$2 AND status='planned'",[this.clock().toISOString(),id]);
    if(!r.rowCount)throw new Error('This plan is unavailable or already canceled.');
  }
  async artwork(digest){if(!/^[0-9a-f]{64}$/.test(digest))return null;await this.ready();return (await this.pool.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[digest])).rows[0]?.image||null;}
}
export function schedulerRouter({store,requireAdmin,enabled=false,publicOrigin,performance}){
  const router=express.Router();router.use(requireAdmin);router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!enabled)return res.status(503).json({error:'Hosted scheduler is not enabled. Local plans are unchanged.'});next();});
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const known=/^(Choose|Enter|Check|Pinterest|Invalid|That Eastern|This plan|This platform|The selected)/.test(e.message);res.status(known?400:503).json({error:known?e.message:'Scheduler is unavailable. Saved plans are retained.'});}};
  router.get('/',handle(async(_req,res)=>res.json(await store.state())));
  router.get('/performance',async(_req,res)=>{try{if(!performance)return res.status(503).json({error:'Performance reporting is unavailable.'});res.json(await performance());}catch{res.status(503).json({error:'Performance figures could not be read. No posts changed.'});}});
  router.get('/facebook-pilot-review',handle(async(_req,res)=>res.json(await store.facebookPilotReview())));
  router.get('/dry-run',handle(async(_req,res)=>res.json(await store.dryRun())));
  router.get('/artwork/:digest',handle(async(req,res)=>{const bytes=await store.artwork(req.params.digest);if(!bytes)return res.status(404).json({error:'Saved artwork not found.'});res.type('png').set('X-Content-Type-Options','nosniff').send(bytes);}));
  router.use((req,res,next)=>{if(req.get('X-LyriBop-Scheduler')!=='1'||!req.is('application/json')||req.get('Origin')!==publicOrigin)return res.status(403).json({error:'Use the scheduler inside your signed-in LyriBop page.'});next();});
  router.post('/facebook-pilot-approve',handle(async(req,res)=>res.json(await store.approveFacebookPilot(req.body))));
  router.post('/facebook-pilot-revoke',handle(async(req,res)=>res.json(await store.revokeFacebookPilot(req.body))));
  router.post('/plans',handle(async(req,res)=>res.status(201).json({saved:await store.add(req.body)})));
  router.post('/pause',handle(async(req,res)=>{await store.pause(req.body?.paused);res.json({saved:true});}));
  router.post('/cancel',handle(async(req,res)=>{await store.cancel(req.body?.id);res.json({saved:true});}));
  return router;
}
export function schedulerPages({requireAdmin,enabled=false}){
  const router=express.Router();router.use(requireAdmin);router.use((_req,res,next)=>{res.set('Cache-Control','no-store');if(!enabled)return res.status(503).send('Hosted scheduler is not enabled.');next();});
  router.get('/',(_req,res)=>res.sendFile(resolve(ROOT,'scheduler.html')));
  router.get('/index.html',(_req,res)=>res.redirect('http://127.0.0.1:8765/index.html'));
  for(const file of ['scheduler.js','scheduler.css'])router.get('/'+file,(_req,res)=>res.sendFile(resolve(ROOT,file)));
  // Serve only catalog-selected images, never the repository or local private data.
  router.get('/assets/images/*path',async(req,res)=>{try{const catalog=await loadSchedulerCatalog();const name=decodeURIComponent(req.path.slice(1));if(!catalog.some(a=>a.image===name))return res.sendStatus(404);res.sendFile(resolve(ROOT,name));}catch{res.sendStatus(503);}});
  return router;
}
