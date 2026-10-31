import sys,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ad_id=int(sys.argv[1]);source=Path(sys.argv[2])
m=json.loads((root/'free-album-cover-update.json').read_text());ad=next(a for a in m['static'] if a['id']==ad_id)
old=Path(ad['original_images'][-1] if ad['original_images'] else ad['original_image'])
rel=old.with_name(old.stem+'-Complete-Offer-v1.png');dest=root/rel
if dest.exists():raise SystemExit('Destination already exists: '+str(dest))
shutil.copy2(source,dest)
record={'id':ad_id,'path':str(rel),'generated_source':str(source),'status':'generated-awaiting-verification'}
(root/'reports/complete-offer-jobs'/f'{ad_id:03}.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
