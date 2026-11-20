import {resolve} from 'node:path';
// Keep missing API/admin routes and non-navigation requests with Express.
export function publicNotFound(req,res,next){
 if(!['GET','HEAD'].includes(req.method)||/^\/(?:api|admin)(?:\/|$)/.test(req.path)||!req.accepts('html'))return next();
 res.status(404).set('X-Robots-Tag','noindex').set('Cache-Control','no-store').sendFile(resolve('public/404.html'));
}
