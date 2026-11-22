import {validateVideo,pinterestVideoEnabled} from './scheduled-videos.mjs';
const fail=()=>{throw Error('Pinterest video needs review. Do not resend.');};
const numeric=x=>typeof x==='string'&&/^\d+$/.test(x);
// Exactly one registration, one byte upload, and one Pin creation, after a durable claim.
export async function createPinterestVideo({graph,snapshot,bytes,spec,env=process.env,rememberMedia,checkPublishing,fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 validateVideo(snapshot,bytes);
 if(!pinterestVideoEnabled(env)||typeof rememberMedia!=='function'||typeof checkPublishing!=='function')fail();
 await checkPublishing();const media=await graph.call('/media',{media_type:'video'});
 if(!numeric(media.media_id))fail();await rememberMedia(media.media_id);
 let url;try{url=new URL(media.upload_url);}catch{fail();}
 if(url.protocol!=='https:'||url.hostname!=='pinterest-media-upload.s3-accelerate.amazonaws.com'||url.pathname!=='/'||url.port||url.username||url.password||url.search||url.hash)fail();
 const params=media.upload_parameters;
 if(!params||typeof params!=='object'||Array.isArray(params)||Object.keys(params).length<1||Object.keys(params).length>32||Object.entries(params).some(([k,v])=>k.toLowerCase()==='file'||! /^[A-Za-z0-9_-]{1,80}$/.test(k)||typeof v!=='string'||v.length>16000))fail();
 const form=new FormData();for(const [key,value] of Object.entries(params))form.append(key,value);form.append('file',new Blob([bytes],{type:'video/mp4'}),'lyribop.mp4');
 await checkPublishing();const uploaded=await fetchImpl(url.href,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(60000)});if(uploaded.status!==204)fail();
 let ready=false;for(let n=0;n<30;n++){await checkPublishing();const result=await graph.call('/media/'+media.media_id);if(result.media_id!==media.media_id||result.media_type!=='video')fail();if(result.status==='succeeded'){ready=true;break;}if(!['registered','processed'].includes(result.status))fail();if(n<29)await wait(3000);}if(!ready)fail();
 if(!pinterestVideoEnabled(env))fail();await checkPublishing();
 const pin=await graph.call('/pins',{board_id:spec.board_id,title:spec.title,description:spec.description,link:spec.link,media_source:{source_type:'video_id',media_id:media.media_id,cover_image_key_frame_time:snapshot.video_cover_time}});
 if(!numeric(pin.id))fail();return pin.id;
}
