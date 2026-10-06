import { RougeChain } from '@rougechain/sdk';
import { check, collectionId, symbol, verifyEnvelope, validCid, cid, hash, canonical } from './protocol.mjs';
export class Chain {
  constructor(api,chainId) {
    const u=new URL(api); check(u.protocol==='https:' || (u.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)),'RougeChain API requires HTTPS except on localhost');
    this.sdk=new RougeChain(api,{fetch:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(15000)})}); this.chainId=chainId;
  }
  async health() { const h=await this.sdk.getHealth(); check(h.chain_id===this.chainId,'RougeChain chain ID mismatch'); }
  async collection(key,id,missing=false) {
    await this.health(); const identifier=collectionId(key,id); let c;
    try { c=await this.sdk.nft.getCollection(identifier); } catch(e) { if(missing && /404/.test(e.message)) return null; throw e; }
    check(c.collection_id===identifier && c.creator===key && c.symbol===symbol(id) && c.description===`QPOSITORY_V1:${id}` && c.public_mint===false && Number.isSafeInteger(c.minted) && c.minted>=0,'Invalid RougeChain collection proof'); return c;
  }
  async history(key,id,owner,repository,storage,checkpoint=0) {
    const c=await this.collection(key,id,true); if(!c) { check(checkpoint===0,'RougeChain proof rollback'); return []; }
    check(c.minted>=checkpoint,'RougeChain proof rollback'); check(c.minted<=10000,'V0.1 history limit exceeded');
    const records=[]; let previous=null;
    for(let seq=1;seq<=c.minted;seq++) {
      const t=await this.sdk.nft.getToken(c.collection_id,seq);
      check(t.collection_id===c.collection_id && t.token_id===seq && t.creator===key && t.name==='QPOSITORY_V1','Invalid RougeChain token proof');
      const envelopeCid=validCid(t.metadata_uri); const bytes=await storage.get(envelopeCid); check(cid(bytes)===envelopeCid,'Manifest CID mismatch');
      const envelope=verifyEnvelope(bytes,key); const m=envelope.manifest;
      check(m.chain_id===this.chainId && m.repository_id===id && m.owner===owner && m.repository===repository && m.sequence===seq && m.previous===previous,'Replayed or incompatible repository proof');
      check(canonical(t.attributes).equals(canonical({protocol:'qpository',version:1,manifest_hash:hash(canonical(m)),repository_id:id})), 'RougeChain manifest hash binding mismatch');
      if(records.length) check(m.timestamp>=records.at(-1).envelope.manifest.timestamp,'Proof timestamp rollback');
      records.push({envelope,envelopeCid,proof:`${c.collection_id}:${seq}`}); previous=envelopeCid;
    }
    const again=await this.collection(key,id); check(again.minted===c.minted,'Chain changed during verification; retry'); return records;
  }
  async wait(fn) {
    const deadline=Date.now()+Number(process.env.QPO_CONFIRM_TIMEOUT_MS || 60000); let last;
    do { try { const result=await fn(); if(result) return result; } catch(e) { last=e; }
      await new Promise(r=>setTimeout(r,500));
    } while(Date.now()<deadline);
    throw new Error(`RougeChain confirmation timed out${last ? ': '+last.message : ''}; submission may still be pending`);
  }
  async anchor(wallet,id,envelopeCid,sequence,manifest) {
    let c=await this.collection(wallet.publicKey,id,true);
    if(!c) {
      check(sequence===1,'Missing previous RougeChain collection');
      const r=await this.sdk.nft.createCollection(wallet,{symbol:symbol(id),name:'QPository public provenance',description:`QPOSITORY_V1:${id}`,publicMint:false});
      check(r.success,`RougeChain collection rejected: ${r.error}`);
      c=await this.wait(()=>this.collection(wallet.publicKey,id));
    }
    check(!c.frozen && c.minted===sequence-1,'Concurrent push or incompatible sequence');
    const r=await this.sdk.nft.mint(wallet,{collectionId:c.collection_id,name:'QPOSITORY_V1',metadataUri:envelopeCid,attributes:{protocol:'qpository',version:1,manifest_hash:hash(canonical(manifest)),repository_id:id}});
    check(r.success,`RougeChain push rejected: ${r.error}`);
    await this.wait(async()=>{
      const t=await this.sdk.nft.getToken(c.collection_id,sequence);
      check(t.creator===wallet.publicKey && t.token_id===sequence && t.metadata_uri===envelopeCid && t.name==='QPOSITORY_V1','Conflicting RougeChain mint'); return t;
    });
    return `${c.collection_id}:${sequence}`;
  }
}
