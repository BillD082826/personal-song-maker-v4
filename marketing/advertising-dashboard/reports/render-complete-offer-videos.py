import json,subprocess,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parents[1];ff='/private/tmp/lyribop-ffmpeg-arm64'
audit=json.loads((root/'reports/complete-offer-video-audit.json').read_text())
def digest(file):
 z=subprocess.run([ff,'-v','error','-i',str(file),'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],capture_output=True,text=True,check=True)
 return z.stdout.strip()
def render(v):
 w,h=v['dimensions'];old=root/v['video'];rel=Path(v['video']).with_name(Path(v['video']).stem+'__COMPLETE_OFFER_v1.mp4');dest=root/rel
 card=root/'assets/images/complete-offer'/('LyriBop-Complete-Offer-Landscape.png' if w>h else 'LyriBop-Complete-Offer-Portrait.png')
 assert '__COMPLETE_OFFER_v1' in dest.stem
 duration=sum(float(x)*s for x,s in zip(v['duration'].split(':'),[3600,60,1]))
 filt=f'[0:v]fps=30,tpad=stop_mode=clone:stop_duration=2,trim=duration={duration},setpts=PTS-STARTPTS,format=yuv420p,setsar=1[v0];[1:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[v]'
 subprocess.run([ff,'-y','-v','error','-filter_complex_threads','1','-i',str(old),'-loop','1','-t','4','-i',str(card),'-filter_complex',filt,'-map','[v]','-map','0:a?','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
 before=digest(old);after=digest(dest);assert before==after,'Original audio packet data changed'
 record={**v,'updated_video':str(rel),'closing_card':str(card.relative_to(root)),'card_seconds':4,'audio_packet_sha256_before':before,'audio_packet_sha256_after':after,'audio_preserved':True}
 (root/'reports/complete-offer-jobs'/f'video-{v["id"]:02}.json').write_text(json.dumps(record,indent=2)+'\n')
 print('PASS video',v['id'],v['name'],'— four-second offer card, original audio preserved',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(render,audit))
