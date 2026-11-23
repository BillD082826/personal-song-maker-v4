// Budget allocations from paid sales, NOT a tax-return or sales-tax calculation.
export const INCOME_TAX_SCHEMA = `
CREATE TABLE IF NOT EXISTS income_tax_reserve_settings (
 tax_year INTEGER PRIMARY KEY CHECK(tax_year BETWEEN 2000 AND 2100),
 state_percent NUMERIC(6,3) CHECK(state_percent BETWEEN 0 AND 100),
 federal_percent NUMERIC(6,3) CHECK(federal_percent BETWEEN 0 AND 100),
 state_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(state_paid>=0),
 federal_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(federal_paid>=0),
 version INTEGER NOT NULL DEFAULT 0,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(COALESCE(state_percent,0)+COALESCE(federal_percent,0)<=100)
);
CREATE TABLE IF NOT EXISTS income_tax_reserve_changes (
 id BIGSERIAL PRIMARY KEY, tax_year INTEGER NOT NULL REFERENCES income_tax_reserve_settings(tax_year),
 previous_values JSONB NOT NULL, next_values JSONB NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function taxYear(value){const year=Number(value);if(!Number.isInteger(year)||year<2000||year>2100)throw fail('Choose a valid tax year.');return year;}
export function reserveInput(body){
 const percent=value=>{if(value===null||value===undefined||value==='')return null;const s=String(value);if(!/^\d{1,3}(\.\d{1,3})?$/.test(s)||Number(s)>100)throw fail('Reserve percentages must be between 0 and 100, with at most 3 decimal places.');return Number(s);};
 const money=value=>{const s=String(value??'0');if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw fail('Recorded payments must be non-negative dollar amounts with at most 2 decimal places.');return Number(s);};
 const statePercent=percent(body.statePercent),federalPercent=percent(body.federalPercent);
 if((statePercent||0)+(federalPercent||0)>100)throw fail('Combined reserve percentages cannot exceed 100%.');
 const version=Number(body.version);if(!Number.isSafeInteger(version)||version<0)throw fail('Refresh the tax reserves before saving.');
 return {year:taxYear(body.year),statePercent,federalPercent,statePaid:money(body.statePaid),federalPaid:money(body.federalPaid),version};
}
export function reserveSummary(sales,settings={}){
 // Integer cents and thousandths of a percent avoid binary-float money rounding.
 const cents=BigInt(Math.round(Number(sales||0)*100));
 const amount=rate=>rate===null||rate===undefined?null:Number((cents*BigInt(Math.round(Number(rate)*1000))+50000n)/100000n)/100;
 const stateReserve=amount(settings.state_percent),federalReserve=amount(settings.federal_percent);
 const statePaid=Number(settings.state_paid||0),federalPaid=Number(settings.federal_paid||0);
 return {sales:Number(sales||0),stateReserve,federalReserve,statePaid,federalPaid,
 stateRemaining:stateReserve===null?null:Math.max(0,Math.round((stateReserve-statePaid)*100)/100),
 federalRemaining:federalReserve===null?null:Math.max(0,Math.round((federalReserve-federalPaid)*100)/100),
 salesAfterReserves:stateReserve===null||federalReserve===null?null:Math.round((Number(sales||0)-stateReserve-federalReserve)*100)/100};
}
export async function saveReserveSettings(pool,input){
 const v=reserveInput(input),client=await pool.connect();
 try{
 await client.query('BEGIN');
 await client.query('INSERT INTO income_tax_reserve_settings(tax_year) VALUES($1) ON CONFLICT DO NOTHING',[v.year]);
 const previous=(await client.query('SELECT * FROM income_tax_reserve_settings WHERE tax_year=$1 FOR UPDATE',[v.year])).rows[0];
 if(previous.version!==v.version)throw fail('These reserves changed in another window. Refresh before saving.',409);
 const next=(await client.query(`UPDATE income_tax_reserve_settings SET state_percent=$2,federal_percent=$3,state_paid=$4,federal_paid=$5,version=version+1,updated_at=NOW() WHERE tax_year=$1 RETURNING *`,[v.year,v.statePercent,v.federalPercent,v.statePaid,v.federalPaid])).rows[0];
 await client.query('INSERT INTO income_tax_reserve_changes(tax_year,previous_values,next_values) VALUES($1,$2,$3)',[v.year,JSON.stringify(previous),JSON.stringify(next)]);
 await client.query('COMMIT');return next;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export function installIncomeTaxRoutes(app,{pool,requireAdmin,adminOrigin}){
 app.get('/api/admin/income-tax-reserves',requireAdmin,async(req,res)=>{
  try{
   const currentYear=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric'}).format(new Date()));
   const year=taxYear(req.query.year||currentYear);
   const settings=(await pool.query('SELECT * FROM income_tax_reserve_settings WHERE tax_year=$1',[year])).rows[0]||{tax_year:year,state_percent:null,federal_percent:null,state_paid:0,federal_paid:0,version:0};
   const sales=(await pool.query(`SELECT COALESCE(SUM(price_amount),0)::numeric AS sales FROM orders WHERE paid_at IS NOT NULL AND is_test=FALSE AND EXTRACT(YEAR FROM paid_at AT TIME ZONE 'America/New_York')=$1 AND paid_at<=NOW()`,[year])).rows[0].sales;
   res.set('Cache-Control','private, no-store');res.json({year,settings,summary:reserveSummary(sales,settings)});
  }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Could not load income-tax reserves.'});}
 });
 app.patch('/api/admin/income-tax-reserves',requireAdmin,async(req,res)=>{
  if(req.headers.origin!==adminOrigin)return res.status(403).json({error:'Open this page in LyriBop Admin.'});
  try{res.json({settings:await saveReserveSettings(pool,req.body)});}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Could not save income-tax reserves.'});}
 });
}
