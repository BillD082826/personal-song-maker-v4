// Exact, explicitly configured customer storefront origins. Admin/OAuth keep their own origin.
export function customerOriginPolicy(primaryBase,storefrontBase=''){
 const primary=new URL(primaryBase).origin;
 let storefront='';
 if(storefrontBase){const u=new URL(storefrontBase);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('Review the customer storefront address.');storefront=u.origin;}
 const allowed=new Set([primary,...(storefront?[storefront]:[])]);
 return {customerBase:storefront||primary,allows:value=>typeof value==='string'&&allowed.has(value)};
}
