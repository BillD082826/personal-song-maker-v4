import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySavedFacebookVideo} from '../lib/facebook-scheduled-video.mjs';
import {facebookCaptionsMatch} from '../lib/facebook-caption.mjs';
test('video blank-line normalization verifies existing ready video without a provider write',async()=>{
 const caption='Your story.\n\n\nYour song.\n\nhttps://lyribop.com/';
 const video={id:'99',from:{id:'1271936012676830'},description:caption.replace('\n\n\n','\n\n'),published:true,status:{video_status:'ready'},permalink_url:'/reel/99/'};
 const page={call:async(path,body)=>{assert.equal(body,undefined);assert.equal(path,'/99?fields=id,from,description,published,status,permalink_url');return video;},fetch:()=>assert.fail('No upload')};
 assert.equal(await verifySavedFacebookVideo(page,{caption},'99',{attempts:1}),'https://www.facebook.com/reel/99/');
 for(const change of [{description:video.description.replace('song','gift')},{description:video.description.replace('lyribop.com','evil.test')},{description:undefined},{from:{id:'wrong'}},{id:'100'},{published:false},{status:{video_status:'processing'}},{permalink_url:'/reel/100/'}])await assert.rejects(verifySavedFacebookVideo({call:async()=>({...video,...change})},{caption},'99',{attempts:1}));
});
test('shared Facebook comparison preserves meaningful line breaks and all other text',()=>{
 assert(facebookCaptionsMatch('a\n\nb','a\n\n\nb'));
 for(const actual of ['a\nb','a b','a\n\n b',undefined,null])assert.equal(facebookCaptionsMatch(actual,'a\n\nb'),false);
});
