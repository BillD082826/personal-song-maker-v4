// Explicitly approved November 23: one fictional Spanish test song, no email/publication.
// This is never imported by the application. Existing test orders are never regenerated.
import pg from 'pg';import OpenAI,{toFile} from 'openai';
const mode=process.argv[2];if(!['--inspect','--generate'].includes(mode)||process.argv.length!==3)throw Error('Use --inspect or --generate.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const client=await pool.connect();
const email='spanish-language-test-20261123@example.invalid',name='LyriBop Spanish language test';
const local='http://127.0.0.1:'+(process.env.PORT||10000);let started=false;
try{
 const lock=(await client.query('SELECT pg_try_advisory_lock(823112026) AS locked')).rows[0];if(!lock.locked)throw Error('The Spanish check is already running.');
 const rows=(await client.query('SELECT id,preview_token,song_language,song_title,lyrics,music_data IS NOT NULL AS has_music FROM orders WHERE email=$1 AND customer_name=$2 ORDER BY created_at DESC',[email,name])).rows;
 if(rows.length){console.log(JSON.stringify({status:'existing_test_do_not_regenerate',order_id:rows[0].id,language:rows[0].song_language,has_music:rows[0].has_music}));}
 else if(mode==='--inspect'){console.log(JSON.stringify({status:'ready_for_approved_test',language:'es',song_seconds:150,preview_seconds:60,provider_requests:0}));}
 else{
  if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD)throw Error('Admin login is not configured.');
  const auth='Basic '+Buffer.from(process.env.ADMIN_USERNAME+':'+process.env.ADMIN_PASSWORD).toString('base64');
  started=true;
  const response=await fetch(local+'/api/admin/create-song',{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth,Origin:'https://admin.lyribop.com'},body:JSON.stringify({customerName:name,email,person:'María',occasion:'Anniversary',style:'Folk / Acoustic',mood:'Romantic',vocalGender:'Female',vocalStyle:'Warm and expressive',tempo:'Medium',duet:'No duet',instruments:'Acoustic guitar, Piano',story:'María and I met on a sunny afternoon beside the sea. We laughed when the wind stole our picnic napkins. Every anniversary we return to that beach and walk hand in hand. Her kindness makes ordinary days feel special.',message:'Gracias por caminar a mi lado, hoy y siempre.',songLength:150,songLanguage:'es'}),signal:AbortSignal.timeout(540000)});
  const result=await response.json();
  // Keep this fictional preview out of customer marketing and sales reporting, even on failure.
  await client.query('UPDATE orders SET is_test=TRUE WHERE email=$1 AND customer_name=$2',[email,name]);
  if(!response.ok||!result.orderId||!result.previewToken)throw Error('Spanish generation needs review; do not retry automatically.');
  const row=(await client.query('SELECT song_language,song_title,lyrics FROM orders WHERE id=$1',[result.orderId])).rows[0];if(row.song_language!=='es')throw Error('Saved language mismatch.');
  const preview=await fetch(local+'/api/order/preview/'+encodeURIComponent(result.previewToken),{signal:AbortSignal.timeout(120000)});if(!preview.ok)throw Error('Could not load the saved preview.');const bytes=Buffer.from(await preview.arrayBuffer());
  const report={status:'generated_one_test',order_id:result.orderId,is_test:true,song_language:row.song_language,title:row.song_title,lyrics:row.lyrics,preview_url:'https://admin.lyribop.com/api/order/preview/'+result.previewToken,preview_bytes:bytes.length,email_sent:false,published:false};
  try{const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});const transcript=await ai.audio.transcriptions.create({file:await toFile(bytes,'spanish-test-preview.mp3',{type:'audio/mpeg'}),model:'whisper-1',response_format:'verbose_json',timestamp_granularities:['segment']});report.transcription={language:transcript.language,text:transcript.text,segments:transcript.segments?.map(({start,end,text})=>({start,end,text}))};}catch{report.transcription={status:'not_available_listen_to_preview'};}
  console.log(JSON.stringify(report));
 }
}catch(error){if(started)await client.query('UPDATE orders SET is_test=TRUE WHERE email=$1 AND customer_name=$2',[email,name]).catch(()=>{});console.error(JSON.stringify({status:'needs_review_do_not_regenerate',message:error.message}));process.exitCode=1;}finally{await client.query('SELECT pg_advisory_unlock(823112026)').catch(()=>{});client.release();await pool.end();}
