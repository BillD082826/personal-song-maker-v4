import {validateVideo,facebookVideoPermalink} from './scheduled-videos.mjs';
const PAGE='1271936012676830';
const fail=()=>{throw Error('Facebook video needs review. Do not resend.');};
export async function uploadSavedFacebookVideo(page,snapshot,bytes){
 validateVideo(snapshot,bytes);
 const body=new FormData();body.set('source',new Blob([bytes],{type:'video/mp4'}),'lyribop-video.mp4');body.set('description',snapshot.caption);body.set('published','true');
 const response=await page.fetch('https://graph-video.facebook.com/v26.0/'+PAGE+'/videos',{method:'POST',headers:{Authorization:'Bearer '+page.token},body,redirect:'error',signal:AbortSignal.timeout(60000)});
 const result=await response.json();if(!response.ok||result.error||!/^\d+$/.test(result.id||''))fail();return result.id;
}
export async function verifySavedFacebookVideo(page,snapshot,id,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=12}={}){
 if(!/^\d+$/.test(id||'')||!Number.isInteger(attempts)||attempts<1||attempts>12)fail();
 for(let n=0;n<attempts;n++){
  const video=await page.call('/'+id+'?fields=id,from,description,published,status,permalink_url');
  if(video.id!==id||video.from?.id!==PAGE||video.description!==snapshot.caption)fail();
  const permalink=facebookVideoPermalink(video.permalink_url,id);
  if(video.published===true&&video.status?.video_status==='ready'&&permalink)return permalink;
  if(video.status?.video_status==='error')fail();
  if(n+1<attempts)await wait(5000);
 }
 fail();
}
