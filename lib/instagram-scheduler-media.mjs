// Prepared public advertising artwork only; no credentials or provider requests.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function jpegDimensions(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Prepared Instagram artwork must be JPEG.');
 let i=2;
 while(i+4<=bytes.length){if(bytes[i++]!==255)throw Error('Invalid JPEG marker.');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
 const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)throw Error('Invalid JPEG segment.');
 if([0xc0,0xc1,0xc2].includes(marker)){if(length<8)break;return {width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3)};}i+=length;
 }throw Error('JPEG dimensions unavailable.');
}
export function validatePreparedInstagramMedia(entry,source,jpeg){
 if(!entry||entry.source_sha256!==sha(source)||entry.jpeg_sha256!==sha(jpeg)||entry.path!==`/social-scheduler/${entry.jpeg_sha256}.jpg`||jpeg.length>8*1024*1024)throw Error('Prepared Instagram artwork changed.');
 const size=jpegDimensions(jpeg);if(size.width<320||size.width>1440||size.height<1||size.width/size.height<0.8||size.width/size.height>1.91||entry.width!==size.width||entry.height!==size.height)throw Error('Prepared Instagram artwork size needs review.');
 return {format:'jpeg',source_sha256:entry.source_sha256,sha256:entry.jpeg_sha256,path:entry.path,width:size.width,height:size.height};
}
export async function preparedInstagramMedia(publicRoot,source){
 let manifest;try{manifest=JSON.parse(await readFile(resolve(publicRoot,'social-scheduler/manifest.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 if(manifest.version!==1||!Array.isArray(manifest.images))throw Error('Instagram artwork manifest needs review.');
 const entries=manifest.images.filter(x=>x.source_sha256===sha(source));if(entries.length!==1)throw Error('Instagram artwork has not been prepared.');
 const entry=entries[0];if(!/^[a-f0-9]{64}$/.test(entry.jpeg_sha256||''))throw Error('Instagram artwork digest needs review.');
 const jpeg=await readFile(resolve(publicRoot,'social-scheduler',entry.jpeg_sha256+'.jpg'));
 return validatePreparedInstagramMedia(entry,source,jpeg);
}
