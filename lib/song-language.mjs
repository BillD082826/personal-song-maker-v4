export const SONG_LANGUAGE_SCHEMA = "ALTER TABLE orders ADD COLUMN IF NOT EXISTS song_language TEXT NOT NULL DEFAULT 'en' CHECK (song_language IN ('en','es'))";
const labels=Object.freeze({en:'English',es:'Spanish (Español)'});
export function songLanguage(value){
 if(value===undefined||value===null||value==='')return 'en';
 if(typeof value!=='string'||!Object.hasOwn(labels,value)){const error=Error('Choose English or Spanish for the song language.');error.status=400;throw error;}
 return value;
}
export const songLanguageLabel=value=>labels[songLanguage(value)];
export async function savedSongLanguage(pool,id){
 if(!pool){const error=Error('Order database is not configured.');error.status=503;throw error;}
 const result=await pool.query('SELECT song_language FROM orders WHERE id=$1',[id]);
 if(!result.rows.length){const error=Error('Order not found.');error.status=404;throw error;}
 return songLanguage(result.rows[0].song_language);
}
export function lyricsLanguageInstruction(value,{revision=false}={}){
 const name=songLanguageLabel(value);
 const instruction = `SONG LANGUAGE: ${name}. Write the title and all sung lyrics in ${name}, using natural, idiomatic wording. The customer may describe their story in another language: convey its meaning in ${name}. Keep personal names unchanged. Adapt the special message into the selected language while preserving its meaning; keep a short dedication verbatim only when explicitly requested. Do not add an English translation or alternate-language verses. Put the recipient and a distinctive personal detail in the opening verse, and the special message in the opening verse or first chorus, within the first 45 seconds of singing.`;
 return revision?instruction.slice(0,instruction.indexOf(" Put the recipient"))+" Preserve the existing song structure and unchanged lines.":instruction;
}
export function musicLanguageInstruction(value){return `VOCAL LANGUAGE: ${songLanguageLabel(value)}. Sing the supplied lyrics in this language with natural pronunciation and phrasing. Preserve personal names and any explicitly requested verbatim dedication. Do not translate the lyrics into another language. Begin singing within the first 3–5 seconds and sing the supplied opening verse first.`;}
