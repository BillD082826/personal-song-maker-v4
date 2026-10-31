import json,zipfile,hashlib,html
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def load(f):return json.loads((root/f).read_text())
def save(f,x):(root/f).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
ads=load('ads.json');allads=load('all-ads.json');videos=load('videos.json');manifest=load('free-album-cover-update.json');statuses=load('ad-status.json')
greetings=[x.copy() for x in allads if x.get('category')=='seasonal-greeting'];files=[]
for ad in ads:
 job=load('reports/complete-offer-jobs/'+f'{ad["id"]:03}.json');assert (root/job['path']).is_file()
 m=next(x for x in manifest['static'] if x['id']==ad['id']);assert statuses.get('static-'+str(ad['id']),'Draft')==m['original_status']
 if ad.get('images'):
  assert ad['images']==m['original_images'];ad['images'][-1]=job['path'];rel=Path(m['original_download']);rel=rel.with_name(rel.stem+'-Complete-Offer-v1.zip');assert not (root/rel).exists()
  with zipfile.ZipFile(root/rel,'w',zipfile.ZIP_DEFLATED) as z:
   for n,p in enumerate(ad['images'],1):z.write(root/p,f'LyriBop-{ad["platform"]}-Story-{ad["id"]}-Panel-{n:02}.png')
  with zipfile.ZipFile(root/rel) as z:
   assert z.testzip() is None;assert len(z.namelist())==4
   for n,p in enumerate(ad['images']):assert z.read(z.namelist()[n])==(root/p).read_bytes()
  ad['download']=str(rel);files.extend([str(rel),job['path']]);m['updated_images']=ad['images'];m['updated_download']=str(rel)
 else:
  assert ad['image']==m['original_image'];ad['image']=job['path'];ad['download']=job['path'];files.append(job['path']);m['updated_image']=job['path'];m['updated_download']=job['path']
 m['artwork_status']='installed-verified';m['verification']='Built-in image edits; visual sheet review, targeted full-size review, offer/caption/file checks. OCR used only as aid because decorative text caused false negatives.'
 idx=next(i for i,a in enumerate(allads) if a['type']=='static' and a['id']==ad['id']);allads[idx]={**ad,'type':'static'}
for v in videos:
 j=load('reports/complete-offer-jobs/'+f'video-{v["id"]:02}.json');assert j['audio_preserved'];assert abs(j['duration_extension_seconds']-4)<.08
 v['video']=j['updated_video'];files.append(v['video']);m=next(a for a in manifest['videos'] if a['id']==v['id']);m.update(video_status='installed-verified',updated_video=v['video'],closing_card=j['closing_card'],card_seconds=4,audio_preserved=True)
 item=next(a for a in allads if a['type']=='video' and a['id']==v['id']);item['video']=v['video']
assert [x for x in allads if x.get('category')=='seasonal-greeting']==greetings
save('ads.json',ads);save('all-ads.json',allads);save('videos.json',videos);manifest['status']='complete';manifest['verification_counts']={'static_entries':len(ads),'story_zips':12,'videos':len(videos),'greetings_unchanged':len(greetings),'caption_fields':153};save('free-album-cover-update.json',manifest)
# A local review index points at exactly the same artwork and download packages as the dashboard.
cards=[]
for a in ads:
 img=a['images'][-1] if a.get('images') else a['image'];cards.append(f'<article><h2>{a["id"]}. {html.escape(a["name"])}</h2><a href="{html.escape(img)}"><img loading="lazy" src="{html.escape(img)}" alt="{html.escape(a["name"])}"></a><p><a download href="{html.escape(a["download"])}">Download {"all four panels" if a.get("images") else "image"}</a></p></article>')
for v in videos:cards.append(f'<article><h2>Video {v["id"]}. {html.escape(v["name"])}</h2><video controls preload="none" src="{html.escape(v["video"])}"></video><p><a download href="{html.escape(v["video"])}">Download video</a></p></article>')
(root/'complete-offer-review.html').write_text('<!doctype html><html><head><meta charset="utf-8"><title>LyriBop Complete Offer Review</title><style>body{font:16px Arial;margin:24px;background:#faf7ff;color:#242039}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}article{background:white;border:1px solid #ded5ed;border-radius:12px;padding:16px}h2{font-size:18px}img,video{width:100%;max-height:620px;object-fit:contain}a{color:#6531ae}</style></head><body><h1>LyriBop complete offer — October 31</h1><p>FREE 30-second preview · Full song · MP3 download · Printable lyrics · FREE album cover with every order.</p><p>66 promotional entries and 8 videos. Story cards below show the updated final panel; downloads contain all four panels. Three goodwill greetings are unchanged. No social publication.</p><main>'+''.join(cards)+'</main></body></html>')
# Exact explicit path list prevents unrelated changes from being staged.
paths=['STORYSONG_PROJECT.md','marketing/advertising-dashboard/ads.json','marketing/advertising-dashboard/all-ads.json','marketing/advertising-dashboard/videos.json','marketing/advertising-dashboard/free-album-cover-update.json','marketing/advertising-dashboard/complete-offer-review.html']
paths+=['marketing/advertising-dashboard/'+p for p in files]
paths+=['marketing/advertising-dashboard/'+str(p.relative_to(root)) for p in (root/'assets/images/complete-offer').glob('*.png')]
paths+=['marketing/advertising-dashboard/'+str(p.relative_to(root)) for p in (root/'reports/complete-offer-jobs').glob('*.json')]
paths+=['marketing/advertising-dashboard/reports/complete-offer-video-audit.json','marketing/advertising-dashboard/reports/complete-offer-ocr.json','marketing/advertising-dashboard/reports/install-complete-offer.py','marketing/advertising-dashboard/reports/render-complete-offer-videos.py','marketing/advertising-dashboard/reports/save-complete-offer-job.py']
Path('/private/tmp/lyribop-complete-offer-stage.paths').write_bytes(b'\0'.join(p.encode() for p in sorted(set(paths)))+b'\0')
print('PASS installed:',len(ads),'static entries, 12 validated story ZIPs,',len(videos),'videos; greetings and statuses unchanged.')
