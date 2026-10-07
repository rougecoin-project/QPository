import {getStore} from '@netlify/blobs';
import {randomBytes,createHash} from 'node:crypto';
import {ml_dsa65} from '@noble/post-quantum/ml-dsa.js';
const random=()=>randomBytes(32).toString('hex'),hash=x=>createHash('sha256').update(x).digest('hex');
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export default async function(req){
 const store=getStore({name:'qpository-auth-v1',consistency:'strong'}),url=new URL(req.url),origin=process.env.URL||'https://qpository.netlify.app';
 const cookies=Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=')));
 const reply=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
 try{
 if(req.method==='GET'){
  const token=cookies.qpo_session;if(!/^[a-f0-9]{64}$/.test(token||''))return reply({user:null});
  const session=await store.get('session/'+hash(token),{type:'json'});return reply({user:session&&session.expires>Date.now()?{publicKey:session.publicKey,fingerprint:hash(Buffer.from(session.publicKey,'hex'))}:null});
 }
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(req.headers.get('origin')!==origin)return reply({error:'Origin rejected'},403);
 const text=await req.text();if(text.length>20000)return reply({error:'Request too large'},413);const input=JSON.parse(text);
 if(input.action==='logout'){if(/^[a-f0-9]{64}$/.test(cookies.qpo_session||''))await store.delete('session/'+hash(cookies.qpo_session));return reply({ok:true},200,{'Set-Cookie':cookie('qpo_session','',0)});}
 if(input.action==='challenge'){
  const id=random(),binding=random(),expires=Date.now()+300000,message=`ROUGECHAIN_QPOSITORY_LOGIN_V1\nOrigin: ${origin}\nNonce: ${id}\nExpires: ${expires}\nPurpose: Sign in to QPository. No transaction or repository authorization.`;
  await store.setJSON('challenge/'+id,{message,expires,binding:hash(binding)});
  return reply({version:1,origin,id,message,expires},200,{'Set-Cookie':cookie('qpo_challenge',binding,300)});
 }
 if(input.action!=='verify'||!/^[a-f0-9]{64}$/.test(input.id||'')||!/^[a-f0-9]{3904}$/.test(input.publicKey||'')||!/^[a-f0-9]{6618}$/.test(input.signature||''))return reply({error:'Malformed login proof'},400);
 const challenge=await store.get('challenge/'+input.id,{type:'json'});
 if(!challenge||challenge.expires<Date.now()||challenge.binding!==hash(cookies.qpo_challenge||''))return reply({error:'Challenge expired or browser mismatch'},401);
 if(!ml_dsa65.verify(Buffer.from(input.signature,'hex'),Buffer.from(challenge.message),Buffer.from(input.publicKey,'hex')))return reply({error:'Invalid ML-DSA signature'},401);
 const consumed=await store.set('used/'+input.id,'used',{onlyIfNew:true});if(!consumed.modified)return reply({error:'Challenge already used'},401);
 const token=random();await store.setJSON('session/'+hash(token),{publicKey:input.publicKey,expires:Date.now()+3600000});
 return reply({ok:true},200,{'Set-Cookie':cookie('qpo_session',token,3600)});
 }catch{return reply({error:'Login unavailable or invalid request'},400);}
}
