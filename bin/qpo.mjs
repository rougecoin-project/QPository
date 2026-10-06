#!/usr/bin/env node
import { init, push, clone, verify, status } from '../src/qpo.mjs';
import { webExport } from '../src/web-export.mjs';
const [command,...args]=process.argv.slice(2);
try {
  if(command==='init' && !args.length) { const c=await init(); console.log(`Initialized rouge://${c.owner}/${c.repository}\nLocal ML-DSA-65 identity stored outside Git`); }
  else if(command==='push' && (!args.length || (args.length===2 && args[0]==='--web' && args[1]))) {
    const c=await push(); console.log(`RougeChain proof: ${c.proof}\nEnvelope: ${c.envelopeCid}`);
    const destination=args[1] || process.env.QPO_WEB_DIST;
    if(destination) {
      try { const result=await webExport(destination); console.log(`Website snapshot ready: ${result.uri} in ${result.destination}\nDeploy the website to publish this snapshot online.`); }
      catch(e) { console.error(`QPository: Chain push succeeded, but website export failed: ${e.message}\nRetry qpo web-export with your website directory; the confirmed proof is preserved.`); process.exitCode=1; }
    }
  }
  else if(command==='clone' && args.length>=1 && args.length<=2) { console.log(`Cloned ${await clone(args[0],process.cwd(),args[1])}`); }
  else if(command==='verify' && !args.length) { const report=await verify(); console.log(`✓ Repository content verified\n✓ ML-DSA-65 signature valid\n✓ RougeChain proof confirmed\nProof: ${report.proof}\nChain confirmation: configured node canonical state (trusted-node mode)`); }
  else if(command==='web-export' && args.length===1) { const result=await webExport(args[0]); console.log('Published snapshot exported: '+result.uri+' to '+result.destination); }
  else if(command==='status' && !args.length) console.log(JSON.stringify(await status(),null,2));
  else { console.log('Usage: qpo init | push [--web <website-dist>] | clone rouge://owner/repository [directory] | verify | status | web-export <website-dist>'); process.exitCode=command ? 1 : 0; }
} catch(e) { console.error(`QPository: ${e.message}`); process.exitCode=1; }
