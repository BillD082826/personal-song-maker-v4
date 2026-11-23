// Customer storefront origins are intentionally NOT administrator origins.
export function adminOriginPolicy(legacyBase,adminBase){
 const legacy=new URL(legacyBase).origin;
 const u=new URL(adminBase);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('Review the administrator address.');
 const allowed=new Set([legacy,u.origin]);
 return {primary:u.origin,allows:value=>typeof value==='string'&&allowed.has(value)};
}
