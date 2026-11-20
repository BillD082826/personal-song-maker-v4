// Four-panel feed collections. Ordered hashes are part of each saved approval.
import {createHash} from 'node:crypto';
export const isCollection=s=>s?.format==='story_collection';
export const mediaHash=b=>createHash('sha256').update(b).digest('hex');
const png=Buffer.from([137,80,78,71,13,10,26,10]);
export function validateCollection(s){
 if(!isCollection(s)){if(s?.format!==undefined&&s.format!=='single_image'||s?.panels!==undefined)throw Error('Saved advertisement format needs review.');return null;}
 if(!Array.isArray(s.panels)||s.panels.length!==4||s.panels.some(p=>!p||typeof p.image!=='string'||!/^assets\/images\/[A-Za-z0-9_./ -]+\.png$/.test(p.image)||p.image.split('/').includes('..')||! /^[a-f0-9]{64}$/.test(p.image_sha256||''))||new Set(s.panels.map(p=>p.image_sha256)).size!==4||s.image!==s.panels[0].image||s.image_sha256!==s.panels[0].image_sha256)throw Error('A story collection needs four distinct saved panels in order.');
 return s.panels;
}
export function validatePanel(bytes,hash){if(!Buffer.isBuffer(bytes)||bytes.length<24||bytes.length>8*1024*1024||!bytes.subarray(0,8).equals(png)||mediaHash(bytes)!==hash||bytes.readUInt32BE(16)<1||bytes.readUInt32BE(20)<1)throw Error('A saved story panel is missing or changed.');}
export async function readCollectionArtwork(pool,s){
 const panels=validateCollection(s);if(!panels)return null;
 const images=[];for(const p of panels){const b=(await pool.query('SELECT image FROM ad_scheduler_media WHERE sha256=$1',[p.image_sha256])).rows[0]?.image;validatePanel(b,p.image_sha256);images.push(b);}
 const size=b=>`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;if(new Set(images.map(size)).size!==1)throw Error('Story panels must have matching dimensions.');
 return images;
}
export function collectionReviewFields(s){return isCollection(s)?{format:s.format,panels:validateCollection(s).map(p=>({image_sha256:p.image_sha256}))}:{};}
