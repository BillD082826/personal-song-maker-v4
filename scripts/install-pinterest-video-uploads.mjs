// Explicit additive installation only. Does not alter worker flags, approvals, plans or public posts.
import pg from 'pg';import {PinterestVideoUploads} from '../lib/pinterest-video-uploads.mjs';
if(process.argv.length!==3||process.argv[2]!=='--confirm')throw Error('Confirm additive Pinterest video upload storage.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{await new PinterestVideoUploads(pool).install();console.log(JSON.stringify({status:'installed',plans_changed:0,approvals_changed:0,provider_requests:0,publishing_enabled:false}));}finally{await pool.end();}
