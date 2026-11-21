// Exact MP4 copies for the hosted Facebook planner. No provider writes.
import {createHash} from 'node:crypto';
export const isVideo=s=>s?.format==='video';
export const VIDEO_LIMIT=32*1024*1024;
export function validateVideo(s,bytes){
 if(!isVideo(s)||s.platform!=='facebook'||typeof s.video!=='string'||!s.video.startsWith('assets/videos/')||s.video.split('/').includes('..')||!s.video.endsWith('.mp4')||s.panels!==undefined||!Number.isInteger(s.video_bytes)||s.video_bytes<32||s.video_bytes>VIDEO_LIMIT||! /^[a-f0-9]{64}$/.test(s.video_sha256||'')||s.image_sha256!==s.video_sha256)throw Error('Saved video needs review.');
 if(bytes!==undefined&&(!Buffer.isBuffer(bytes)||bytes.length!==s.video_bytes||bytes.subarray(4,8).toString()!=='ftyp'||createHash('sha256').update(bytes).digest('hex')!==s.video_sha256))throw Error('Saved video is missing or changed.');
 return s.video_sha256;
}
export function videoReviewFields(s){if(!isVideo(s))return {};validateVideo(s);return {format:'video',video_sha256:s.video_sha256,video_bytes:s.video_bytes};}

export const facebookVideoEnabled=env=>env?.AD_SCHEDULER_FACEBOOK_VIDEO_ENABLED==='true';
export function validFacebookVideoLink(value,id){let u;try{u=new URL(value);}catch{return false;}return /^\d+$/.test(id||'')&&u.protocol==='https:'&&['www.facebook.com','facebook.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&[`/1271936012676830/videos/${id}/`,`/1271936012676830/videos/${id}`,`/reel/${id}/`,`/reel/${id}`].includes(u.pathname);}
