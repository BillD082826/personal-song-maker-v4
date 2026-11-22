// Exact MP4 copies for the hosted Facebook planner. No provider writes.
import {createHash} from 'node:crypto';
export const isVideo=s=>s?.format==='video';
export const VIDEO_LIMIT=32*1024*1024;
export function validateVideo(s,bytes){
 if(!isVideo(s)||!['facebook','instagram','pinterest'].includes(s.platform)||typeof s.video!=='string'||!s.video.startsWith('assets/videos/')||s.video.split('/').includes('..')||!s.video.endsWith('.mp4')||s.panels!==undefined||!Number.isInteger(s.video_bytes)||s.video_bytes<32||s.video_bytes>VIDEO_LIMIT||! /^[a-f0-9]{64}$/.test(s.video_sha256||'')||s.image_sha256!==s.video_sha256)throw Error('Saved video needs review.');
 if(bytes!==undefined&&(!Buffer.isBuffer(bytes)||bytes.length!==s.video_bytes||bytes.subarray(4,8).toString()!=='ftyp'||createHash('sha256').update(bytes).digest('hex')!==s.video_sha256))throw Error('Saved video is missing or changed.');
 if(s.platform==='instagram'&&(s.publishing_media?.format!=='mp4'||s.publishing_media.sha256!==s.video_sha256||s.publishing_media.path!==`/social-scheduler-video/${s.video_sha256}.mp4`))throw Error('Prepared Instagram video needs review.');
 if(s.platform==='pinterest'&&s.video_cover_time!==1)throw Error('Saved Pinterest cover frame needs review.');
 return s.video_sha256;
}
export function videoReviewFields(s){if(!isVideo(s))return {};validateVideo(s);return {format:'video',video_sha256:s.video_sha256,video_bytes:s.video_bytes};}

export const facebookVideoEnabled=env=>env?.AD_SCHEDULER_FACEBOOK_VIDEO_ENABLED==='true';
export function validFacebookVideoLink(value,id){let u;try{u=new URL(value);}catch{return false;}return /^\d+$/.test(id||'')&&u.protocol==='https:'&&['www.facebook.com','facebook.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&[`/1271936012676830/videos/${id}/`,`/1271936012676830/videos/${id}`,`/reel/${id}/`,`/reel/${id}`].includes(u.pathname);}

export function facebookVideoPermalink(value,id){if(typeof value!=='string')return null;let link=value;if(value.startsWith('/')&&!value.startsWith('//'))link='https://www.facebook.com'+value;return validFacebookVideoLink(link,id)?link:null;}

export const instagramVideoEnabled=env=>env?.AD_SCHEDULER_INSTAGRAM_VIDEO_ENABLED==='true';
export function validInstagramLink(value,video=false){let u;try{u=new URL(value);}catch{return false;}return u.protocol==='https:'&&['www.instagram.com','instagram.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&(video?/^\/reel\/[A-Za-z0-9_-]+\/?$/:/^\/p\/[A-Za-z0-9_-]+\/?$/).test(u.pathname);}

export const pinterestVideoEnabled=env=>env?.AD_SCHEDULER_PINTEREST_VIDEO_ENABLED==='true';
