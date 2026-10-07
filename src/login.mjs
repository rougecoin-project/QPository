import {readFile} from 'node:fs/promises';
import {join} from 'node:path';import {homedir} from 'node:os';
import {ml_dsa65} from '@noble/post-quantum/ml-dsa.js';
export async function loginSign(path){
 const c=JSON.parse(await readFile(path,'utf8'));const now=Date.now();
 if(c.version!==1||c.origin!=='https://qpository.netlify.app'||!/^[a-f0-9]{64}$/.test(c.id)||!Number.isSafeInteger(c.expires)||c.expires<now||c.expires>now+300000)throw Error('Untrusted or expired login challenge');
 const message=`ROUGECHAIN_QPOSITORY_LOGIN_V1\nOrigin: ${c.origin}\nNonce: ${c.id}\nExpires: ${c.expires}\nPurpose: Sign in to QPository. No transaction or repository authorization.`;
 if(c.message!==message)throw Error('Malformed login challenge');
 const wallet=JSON.parse(await readFile(process.env.QPO_KEY_FILE||join(process.env.QPO_HOME||join(homedir(),'.qpository'),'identity.json'),'utf8'));
 const signature=ml_dsa65.sign(Buffer.from(message),Buffer.from(wallet.privateKey,'hex'));
 if(!ml_dsa65.verify(signature,Buffer.from(message),Buffer.from(wallet.publicKey,'hex')))throw Error('Invalid local identity');
 return {id:c.id,publicKey:wallet.publicKey,signature:Buffer.from(signature).toString('hex')};
}
