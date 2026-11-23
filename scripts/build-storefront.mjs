// Public customer interface only. Orders, payments, audio and records stay in the existing service.
import {readdir,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const source=resolve('public'),out=resolve('storefront-dist');
const value=process.env.STOREFRONT_ORIGIN||process.env.RENDER_EXTERNAL_URL;
let url;try{url=new URL(value);}catch{throw Error('The assigned storefront URL is required.');}
if(url.protocol!=='https:'||!(url.hostname.endsWith('.onrender.com')||url.hostname==='lyribop.com')||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw Error('Review the assigned storefront URL.');
const origin=url.origin,old='https://personal-song-maker-v5-test.onrender.com';
const pages=new Set(['index.html','order.html','order-guided.html','anniversary-songs.html','privacy.html','delivery.html','giveaway.html','christmas-giveaway.html','404.html']);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});let count=0;
for(const f of await readdir(source,{withFileTypes:true})){
 if(f.isSymbolicLink())throw Error('Unexpected symbolic link in public files.');
 if(f.isDirectory()){if(f.name==='samples'){await cp(join(source,f.name),join(out,f.name),{recursive:true});count++;}continue;}
 if(pages.has(f.name)||(/\.(js|css)$/.test(f.name)&&!f.name.includes('admin'))||/^lyribop[^/]*\.png$/.test(f.name)||['apple-touch-icon.png','favicon.ico','manifest.webmanifest'].includes(f.name)){
  if(/\.(html|js|css|webmanifest)$/.test(f.name)){let body=await readFile(join(source,f.name),'utf8');if(/\.(html|webmanifest)$/.test(f.name))body=body.replaceAll(old,origin);await writeFile(join(out,f.name),body);}else await cp(join(source,f.name),join(out,f.name));count++;
 }
}
await writeFile(join(out,'robots.txt'),`User-agent: *\nDisallow: /api/\nDisallow: /delivery\nDisallow: /admin\nDisallow: /seller\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/order.html','/anniversary-songs.html','/privacy.html'].map(p=>`<url><loc>${origin}${p}</loc></url>`).join('')}</urlset>`);
console.log(JSON.stringify({mode:'public_storefront_build',origin,entries:count,backend_changed:false}));
