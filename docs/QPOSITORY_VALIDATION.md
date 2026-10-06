# V0.1 validation

Validated on Windows on 2026-10-05 with Node 25.4.0 and the pinned RougeChain SDK 1.12.0. Cross-platform CI is configured for Node 22 on Windows and Linux; those hosted CI runs have not been executed here.

## Real RougeChain testnet milestone: PASSED

* API: https://testnet.rougechain.io/api
* Expected and observed chain ID: rougechain-devnet-1
* On-chain proof: col:c64c8abcd4fa5204:QPO36E3A07150786DA97BCCF7F1:1
* Signed envelope CID: sha256:1e2732120c864032682aed512024a2b2678f52d108cecf968f63ceaf1f96f3fc
* Generated a local ML-DSA identity, requested funds through the official SDK's locally signed faucet request, committed hello.txt, initialized QPository, pushed a bundle and signed envelope, and waited for the exact mint record.
* Cloned and verified with a separate QPO_HOME containing only the expected public trust key; no private key copied to verifier.
* The CLI printed all three requested verification lines against actual RougeChain state.

Public identity and proof details are in [live-testnet-result.json](live-testnet-result.json). The private key remains outside this workspace in the demo owner's protected local identity directory. No private key is included in these artifacts.

This run used two isolated directories on one Windows host and shared file CAS. Automated CLI tests separately exercise HTTP CAS with independent client identity directories. A physically separate machine and hosted public CAS were not deployed in this session. Both clients trust the configured RougeChain node for canonical state; validator certificate and state-inclusion verification are outside V0.1.

## Automated validation

Run `npm test`. Tests use real ML-DSA and the real SDK against an explicitly labeled NFT API fixture, plus file/HTTP content-addressed storage. Coverage includes init, duplicate init, canonical fixed vector/SDK equivalence, signing, domain separation, invalid signature/signer/schema, duplicate JSON keys, push, idempotent push, independent clone, verify, wrong HEAD, changed tracked content, altered signed manifest, corrupt bundle/envelope, lying storage provider, invalid chain token/CID/manifest hash, wrong signed root, missing owner trust, incompatible previous-proof link, rollback, uncertain-push resubmission blocking, and CAS write authentication.

The fixture is not a blockchain and does not establish real finality; the real testnet run above is separate evidence. No RougeChain core source was modified.
