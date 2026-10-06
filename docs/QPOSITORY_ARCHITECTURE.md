# QPository V0.1 architecture

## Source audit before implementation

Inspected cyberdreadx/rougechain-node at c02e3fbe4c72aeee5e5d88a6b3e6700ff0b12b77 (2026-10-05), downloaded into .rougechain-reference. No RougeChain source or consensus changes are proposed.

* sdk/src/wallet.ts: Wallet.generateRandom and Wallet.fromKeys; ML-DSA-65 via @noble/post-quantum ~0.5.4. Raw lowercase hex public key (1952 bytes), secret key (4032 bytes), signature (3309 bytes). Keys and signing stay local.
* sdk/src/signer.ts: signTransaction/verifyTransaction and serializePayload use recursive lexicographic key sorting, compact JSON, UTF-8. Transactions contain from, timestamp, nonce, type-specific fields and optional account_nonce. NFT builders sign collection identity and metadataUri.
* sdk/src/client.ts: official RougeChain client; /health, /nft/collection/:id, /nft/token/:collection/:token and /v2/nft/collection/create, /v2/nft/mint. An accepted submission is only mempool acceptance. Wait for the exact resulting canonical state before reporting confirmation.
* core/daemon/src/nft_store.rs: collection ID col:<first 16 public-key hex characters>:<uppercase symbol>; sequential token IDs start at 1. Always compare the FULL creator key, never trust the truncated ID.
* core/daemon/src/node.rs: creator-only collections (public_mint=false); NFT metadata_uri stored on mint; burned tokens may disappear. Missing or incompatible history must fail closed.
* scripts/release/sign-manifest.mjs and core/cli/src/release.rs: signed releases cover exact manifest file bytes, pure ML-DSA with empty context, hex public key and strict base64 signature. Reuse the same cryptographic library, but domain-separate QPository bytes.
* core/p2p contains block, transaction and vote propagation. core/storage is node storage, not a public repository CAS service. No suitable existing arbitrary-object P2P store was identified. Do not conflate chain propagation with repository availability.

Sources: https://github.com/cyberdreadx/rougechain-node and https://docs.rougechain.io/running-a-node/releases ; https://docs.rougechain.io/advanced/sdk

## Smallest integration

Normal Git remains authoritative for commits and checkout. Package a complete Git bundle of the proven HEAD; omit remotes, hooks, working-tree files, credentials and QPository keys. Root is SHA-256 of a deterministic inventory of all reachable Git object IDs, types, lengths and SHA-256 content digests. This adds a SHA-256 content commitment independently of Git SHA-1 and covers history, file modes and names through tree objects. Bundle CID is separately signed because bundle transport bytes need not be deterministic.

Signed manifest includes protocol, version, repository ID, owner alias, repository name, full owner key, chain ID, HEAD, root, bundle CID, UTC timestamp, sequence, previous envelope CID. Repository ID = sha256(raw owner public key) + / + repository name. Public alias resolution REQUIRES an expected key supplied out of band or pinned during init. Alias alone is not an authenticated identity registry.

Canonical encoding permits plain objects, arrays, ASCII strings, safe integers, booleans and null only. Reject unsupported types, unknown fields, malformed keys/hashes/timestamps, duplicate keys or any envelope bytes that do not equal reserialization. Signed bytes = UTF-8 ROUGECHAIN_QPOSITORY_V1 followed by a NUL byte and canonical manifest bytes. Envelope contains manifest and lowercase-hex ML-DSA signature. CID = sha256:<64 lowercase hex> over exact stored bytes. V0.1 has no encryption and no private repositories.

Use existing NFT state as an application-level anchor: deterministic QPO-prefixed collection symbol derived from repository ID; collection description binds protocol and repository ID; each push mints a token named QPOSITORY_V1 with metadata_uri equal to the signed envelope CID and signed attributes explicitly containing the canonical manifest SHA-256 and repository ID. The CID commits to manifest hash, repository identity, signature and bundle CID. Validate creator-only collection, full creator, chain ID, monotonic sequence and complete previous-CID history. Concurrent conflicting pushes fail closed. This costs the existing SDK's 50 XRGE collection fee and 5 XRGE per mint; use a funded local/testnet wallet for demos. It is an anchoring adapter, not a new NFT product UI.

## Trust and confirmation limits

V0.1 authenticates content and authorization cryptographically offline, then checks anchoring and latest state through the configured RougeChain SDK/node. This is a trusted-node client, NOT a BFT light client: it does not independently verify validator certificates or state inclusion against a trusted genesis. An untrusted node can lie about state/latest history. Pin the expected chain ID and use a node you trust. The verification report states this boundary. A mocked node in automated tests is NEVER evidence of a live anchor. Real-node integration must be run against a funded RougeChain node before claiming the live milestone.

Existing NFT records can be transferred/burned or their collection recreated by an owner; QPository rejects gaps, incompatible history and rollback below its locally pinned checkpoint. It cannot prove freshness on first contact without trusting the node. No fabricated local blockchain fallback. Mint acceptance alone never prints confirmed.

## Storage and local state

StorageProvider exposes put(bytes)->CID, get(CID)->bytes, exists(CID)->boolean. File CAS is the simplest development backend. HTTP CAS allows independent machines to retrieve identical objects. Protocol contains only CIDs, not an IPFS dependency or privileged local paths. Every retrieval verifies SHA-256. HTTP service has an object-size cap and optional write bearer token; no keys are accepted or uploaded. Provider selection and credentials are local configuration. Public HTTP deployments should use TLS and authenticated writes.

QPO_HOME (default ~/.qpository) holds the identity and owner trust pins outside Git. Repository state lives inside .git; init requires a committed normal repository. Secret files use restrictive permissions; Windows generated identity directories additionally receive a private current-user SID ACL. V0.1 uses a local plaintext wallet protected by OS permissions, never a Git-tracked key. QPO_KEY_FILE can reference an existing SDK-format wallet. Clone requires no private key. Strict clean tracked worktree and index checks prevent claiming altered local content is proven. Untracked files are reported outside provenance scope; submodules and Git LFS pointers are rejected in V0.1 because their external content is not packaged.

## Verification and tests

Before cloning, validate envelope, signature, chain/history, bundle hash, Git fsck and deterministic object root in a temporary bare repository. Disable hooks, external filters and automatic submodule operations. Then reconstruct Git and checkout the proven commit with safe local config. Verify compares local HEAD, clean tracked files and recomputed root against the recorded envelope and the latest chain record.

Automated tests exercise the actual CLI, real ML-DSA and the official SDK against an HTTP fixture implementing the inspected NFT routes. Test init, deterministic vectors, tampered envelopes/objects/HEAD, push/clone/verify, corrupt CAS, invalid signer/chain/records, sequence and rollback rejection. A separate opt-in live-node workflow documents the funded-node requirements. Cross-platform CI runs Windows and Linux serialization and Git workflow tests.
