// Offline format conversion of Ready to Post ads. Never contacts Instagram.
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import ffmpeg from 'ffmpeg-static';
import {loadSchedulerCatalog} from '../lib/ad-scheduler.mjs';
import {jpegDimensions,validatePreparedInstagramMedia} from '../lib/instagram-scheduler-media.mjs';
const root=resolve('marketing/advertising-dashboard'),out=resolve('public/social-scheduler'),sha=x=>createHash('sha256').update(x).digest('hex');
const temp=await mkdtemp(join(tmpdir(),'lyribop-instagram-art-'));
try{
 const images=[];for(const ad of (await loadSchedulerCatalog(root)).filter(x=>x.platform==='instagram'&&x.ready)){
 const path=resolve(root,ad.image);if(!path.startsWith(root+'/assets/images/'))throw Error('Unexpected artwork path.');
 const source=await readFile(path);if(!source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||source.length>12*1024*1024)throw Error('Invalid PNG.');
 const width=source.readUInt32BE(16),height=source.readUInt32BE(20);if(width<320||height<1)throw Error('Artwork dimensions need review.');
 const portrait=width/height<0.8,landscape=width/height>1.91;
 const filter=portrait?"scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2:white":landscape?"scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:white":"scale='min(1080,iw)':-2";
 const target=join(temp,ad.id+'.jpg');
 if(process.platform==='darwin'){
  await promisify(execFile)('/usr/bin/sips',['-s','format','jpeg','-s','formatOptions','90','-Z',portrait?'1350':'1080',path,'--out',target],{timeout:30000});
  if(portrait||landscape)await promisify(execFile)('/usr/bin/sips',['-p',portrait?'1350':'1080','1080','--padColor','FFFFFF',target,'--out',target],{timeout:30000});
 }else await promisify(execFile)(ffmpeg,['-hide_banner','-loglevel','error','-i',path,'-frames:v','1','-vf',filter,'-q:v','2','-pix_fmt','yuvj420p',target],{timeout:30000});
 const jpeg=await readFile(target),hash=sha(jpeg),entry={ad_id:ad.id,layout:portrait||landscape?'fit-with-white-padding':'original-ratio',source_sha256:sha(source),jpeg_sha256:hash,path:`/social-scheduler/${hash}.jpg`,...jpegDimensions(jpeg)};
 try{validatePreparedInstagramMedia(entry,source,jpeg);}catch(e){throw Error(`Ad ${ad.id}: ${entry.width}x${entry.height}: ${e.message}`);}images.push({entry,jpeg});
 }
 await mkdir(out,{recursive:true});for(const {entry,jpeg} of images)await writeFile(join(out,entry.jpeg_sha256+'.jpg'),jpeg,{flag:'w'});
 await writeFile(join(out,'manifest.json'),JSON.stringify({version:1,images:images.map(x=>x.entry)},null,2)+'\n');
 console.log(JSON.stringify({prepared:images.length,provider_requests:0,posts_changed:0}));
}finally{await rm(temp,{recursive:true,force:true});}
