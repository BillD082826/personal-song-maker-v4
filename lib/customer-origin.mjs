// Exact, explicitly configured customer storefront origins. Admin/OAuth keep their own origin.
export function customerOriginPolicy(primaryBase,storefrontBase='',aliases=''){
 const primary=new URL(primaryBase).origin;
 function storefrontOrigin(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('Review the customer storefront address.');return u.origin;}
 const storefront=storefrontBase?storefrontOrigin(storefrontBase):'';
 const extra=aliases?aliases.split(',').map(value=>storefrontOrigin(value.trim())):[];
 const allowed=new Set([primary,...(storefront?[storefront]:[]),...extra]);
 return {customerBase:storefront||primary,allows:value=>typeof value==='string'&&allowed.has(value)};
}
