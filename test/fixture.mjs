import { createServer } from 'node:http';
import { verifyTransaction } from '@rougechain/sdk';
import { collectionId, repositoryId } from '../src/protocol.mjs';
// This is an SDK HTTP contract fixture, not a RougeChain blockchain or finality proof.
export function nodeFixture(chainId='qpo-test-chain') {
  const collections=new Map(),tokens=new Map(),requests=[];
  const server=createServer(async(req,res)=>{
    let status=200,result;
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(req.method==='POST') {
        const chunks=[]; for await(const c of req) chunks.push(c);
        const signed=JSON.parse(Buffer.concat(chunks)); requests.push(signed);
        if(!verifyTransaction(signed) || signed.payload.from!==signed.public_key) throw new Error('Invalid authorization');
        const p=signed.payload;
        if(path==='/api/v2/nft/collection/create') {
          const id=`col:${p.from.slice(0,16)}:${p.symbol.toUpperCase()}`;
          if(collections.has(id)) throw new Error('Collection exists');
          collections.set(id,{collection_id:id,symbol:p.symbol,name:p.name,creator:p.from,description:p.description,public_mint:p.publicMint,minted:0,frozen:false});
        } else if(path==='/api/v2/nft/mint') {
          const c=collections.get(p.collectionId); if(!c || c.creator!==p.from || c.public_mint) throw new Error('Unauthorized');
          const seq=++c.minted;
          tokens.set(`${c.collection_id}:${seq}`,{collection_id:c.collection_id,token_id:seq,owner:p.from,creator:p.from,name:p.name,metadata_uri:p.metadataUri,attributes:p.attributes});
        } else throw new Error('Unsupported fixture route');
        result={success:true,tx_id:`fixture-${requests.length}`};
      } else if(path==='/api/health') result={status:'ok',chain_id:chainId,height:1};
      else if(path.startsWith('/api/nft/collection/')) result=collections.get(decodeURIComponent(path.slice('/api/nft/collection/'.length)));
      else if(path.startsWith('/api/nft/token/')) { const tail=path.slice('/api/nft/token/'.length).split('/'); result=tokens.get(`${decodeURIComponent(tail[0])}:${tail[1]}`); }
      if(result===undefined) { status=404; result={error:'Not found'}; }
    } catch(e) { status=400; result={success:false,error:e.message}; }
    res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(result));
  });
  return {server,collections,tokens,requests};
}
