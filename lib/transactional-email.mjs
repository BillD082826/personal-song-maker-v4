import nodemailer from 'nodemailer';
export const GMAIL_SENDER='lyribop@gmail.com';
export function transactionalEmailConfiguration(env=process.env){
 const provider=env.TRANSACTIONAL_EMAIL_PROVIDER||'resend';
 if(provider==='resend')return {provider,configured:!!env.RESEND_API_KEY};
 if(provider!=='gmail')throw Error('Choose a supported transactional email provider.');
 const pass=String(env.GMAIL_APP_PASSWORD||'').replace(/ /g,'');
 if(env.GMAIL_USER!==GMAIL_SENDER||!/^[a-zA-Z]{16}$/.test(pass))throw Error('Gmail requires the LyriBop address and a valid Google app password.');
 return {provider,configured:true,options:{host:'smtp.gmail.com',port:465,secure:true,auth:{user:GMAIL_SENDER,pass},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false}};
}
export function transactionalEmailReady(env=process.env){try{return transactionalEmailConfiguration(env).configured;}catch{return false;}}
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
export function createTransactionalEmailFetch({env=process.env,fetchImpl=fetch,createTransport=nodemailer.createTransport}={}){
 return async function send(url,options){
  const config=transactionalEmailConfiguration(env);
  if(config.provider==='resend')return fetchImpl(url,options);
  if(url!=='https://api.resend.com/emails'||options?.method!=='POST')throw Error('Unsupported email request.');
  let email;try{email=JSON.parse(options.body);}catch{throw Error('Invalid email content.');}
  const to=email.to;
  if(!Array.isArray(to)||to.length!==1||typeof to[0]!=='string'||to[0].length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(to[0])||/[\r\n<>,;:\[\]\"\s]/.test(to[0])||typeof email.subject!=='string'||/[\r\n]/.test(email.subject)||(!email.text&&!email.html))throw Error('Invalid transactional email.');
  const transport=createTransport(config.options);
  try{
   const result=await transport.sendMail({from:{name:'LyriBop',address:GMAIL_SENDER},to:{address:to[0]},subject:email.subject,text:email.text,html:email.html,disableFileAccess:true,disableUrlAccess:true});
   if(!result.messageId||result.accepted?.length!==1||result.rejected?.length)return response(409,{message:'Email acceptance is uncertain. Check Gmail Sent before trying again.'});
   return response(200,{id:result.messageId});
  }catch(e){
   // Never expose SMTP responses, account credentials or message contents.
   if(e.code==='EAUTH'||(['MAIL FROM','RCPT TO'].includes(e.command)&&e.responseCode>=500))return response(422,{message:'Gmail rejected this email. Check account setup and recipient.'});
   return response(409,{message:'Email outcome is uncertain. Check Gmail Sent before trying again.'});
  }finally{transport.close();}
 };
}
