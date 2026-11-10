import nodemailer from 'nodemailer';
import {transactionalEmailConfiguration} from '../lib/transactional-email.mjs';
const args=process.argv.slice(2);
if(args.length!==1||!['--check','--verify'].includes(args[0])){console.error('Use --check (configuration only) or --verify (Google authentication, no email).');process.exitCode=1;}
else{
 let transport;
 try{const config=transactionalEmailConfiguration();if(config.provider!=='gmail')throw Error();
 if(args[0]==='--verify'){transport=nodemailer.createTransport(config.options);await transport.verify();}
 console.log(JSON.stringify({provider:'gmail',account:'lyribop@gmail.com',configuration_valid:true,authentication_verified:args[0]==='--verify',emails_sent:0}));
 }catch{console.error('Gmail connection is not ready. Check the selected provider, LyriBop account, Google app password and network access. No email sent.');process.exitCode=1;}finally{transport?.close();}
}
