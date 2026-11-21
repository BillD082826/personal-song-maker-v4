import express from 'express';
import {validateVideo} from './scheduled-videos.mjs';
export function instagramPublicVideoRouter({pool,enabled}){
 const router=express.Router();
 router.get('/:file',async(req,res)=>{
  if(!enabled||!pool||!/^[a-f0-9]{64}\.mp4$/.test(req.params.file))return res.sendStatus(404);
  try{
   const digest=req.params.file.slice(0,-4);
   const row=(await pool.query("SELECT m.image,p.snapshot FROM ad_scheduler_media m JOIN ad_scheduler_plans p ON p.snapshot->>'video_sha256'=m.sha256 WHERE m.sha256=$1 AND p.platform='instagram' AND p.snapshot->>'format'='video' LIMIT 1",[digest])).rows[0];
   if(!row)return res.sendStatus(404);validateVideo(row.snapshot,row.image);const bytes=row.image;
   res.type('mp4').set('X-Content-Type-Options','nosniff').set('Accept-Ranges','bytes');
   const range=req.get('Range');if(!range)return res.send(bytes);
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;
   if(m&&(m[1]||m[2])){if(!m[1]){start=Math.max(0,bytes.length-Number(m[2]));end=bytes.length-1;}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),bytes.length-1):bytes.length-1;}}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=bytes.length||end<start)return res.status(416).set('Content-Range','bytes */'+bytes.length).end();
   return res.status(206).set('Content-Range',`bytes ${start}-${end}/${bytes.length}`).send(bytes.subarray(start,end+1));
  }catch{return res.sendStatus(404);}
 });return router;
}
