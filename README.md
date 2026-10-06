# QPository V0.1

Public Git source-code provenance using local ML-DSA-65 authorization, SHA-256 content-addressed Git bundles and existing RougeChain NFT records. No RougeChain consensus changes. No private repositories or encryption. A repository browsing website is now included; see [website setup](website/README.md).

**Trust boundary:** signatures and content are verified locally; chain anchoring and latest state are confirmed through the configured RougeChain node. This is a trusted-node proof-of-concept, not an independently verified BFT light client. Owner aliases require an out-of-band full public key or a local trust pin. Automated fixture tests do not establish a live blockchain anchor.

## Install and test

Requires Node.js 22+ and Git on PATH.

```sh
npm ci
npm link
npm test
```

`npm link` installs the `qpo` and `qpo-storage` commands. Alternatively run `node /absolute/path/QPository/bin/qpo.mjs <command>` without linking. Windows and Linux CI are configured; local validation was performed on Windows.

## Real testnet milestone

```sh
node scripts/live-demo.mjs
```

This opt-in script creates a committed demo repository and locally generated wallet in a printed temporary directory, requests testnet faucet funds using the official SDK, performs a REAL push, and clones/verifies using a second identity directory with only the public trust key. It preserves the artifacts and a public `live-result.json` if successful. It uses file CAS shared between the two directories; use HTTP CAS below for machines without shared storage. It never prints or uploads the private key. It does not run as part of `npm test`.

The existing SDK charges 50 XRGE for a creator-only collection and 5 XRGE per push. The public testnet API is `https://testnet.rougechain.io/api`; its chain ID was checked as `rougechain-devnet-1` on 2026-10-05. To use another node, set `QPO_API` and the independently expected `QPO_CHAIN_ID`. A funded wallet is required; `QPO_KEY_FILE` can point to an existing local SDK-format JSON wallet with `publicKey` and `privateKey`.

## Manual workflow

Configure a funded identity first, or fund the generated identity after init. `qpo status` prints its PUBLIC key. Default owner alias is `test`; default repository name is the lowercase directory name.

```sh
mkdir qpository-demo
cd qpository-demo
git init
echo "hello qpository" > hello.txt
git add .
git commit -m "initial commit"
qpo init
qpo push
```

From another directory on the same machine and using the same QPO_HOME:

```sh
qpo clone rouge://test/qpository-demo
cd qpository-demo
qpo verify
qpo status
```

Successful verification prints:

```text
✓ Repository content verified
✓ ML-DSA-65 signature valid
✓ RougeChain proof confirmed
Proof: col:...:1
Chain confirmation: configured node canonical state (trusted-node mode)
```

Clone checks out the proven commit detached; create a branch with ordinary Git to continue development. Existing destination directories are rejected. A second push of identical proven content is idempotent. Verify requires the latest published proof and the matching local HEAD; older clones must clone the latest state into a new directory.

## Independent machines and HTTP CAS

Run `qpo-storage` on a storage host. Its default is loopback port 8787 and `.qpo-storage`. Set `QPO_STORAGE_DIR` for persistent storage and `QPO_STORAGE_TOKEN` to require a bearer token for writes. Public reads need no token. Put the service behind HTTPS; set `QPO_STORAGE_HOST` only when intentionally exposing it through a proxy. Objects have a 128 MiB V0.1 cap.

On the publisher, set `QPO_STORAGE=https://your-cas.example` and the write token. On another machine, install QPository and set the same `QPO_STORAGE`, expected `QPO_CHAIN_ID` and `QPO_API`, and set `QPO_OWNER_KEY` to the full PUBLIC ML-DSA key obtained through a trusted channel. Then run clone and verify. Never transfer the identity.json private key to a verifier. A successful clone pins the supplied public key locally.

Environment variables (PowerShell uses `$env:QPO_STORAGE = 'value'`; shells use `export QPO_STORAGE=value`):

| Variable | Purpose |
| --- | --- |
| QPO_HOME | Private local identity/trust directory; default ~/.qpository |
| QPO_KEY_FILE | Existing SDK-format local wallet; no key transmitted |
| QPO_OWNER / QPO_REPO | Init owner alias/repository name |
| QPO_OWNER_KEY | Expected full owner public key, checked against existing pin |
| QPO_API | Official SDK API base including /api |
| QPO_CHAIN_ID | Independently expected network identifier |
| QPO_STORAGE | File CAS directory or HTTPS CAS service URL |
| QPO_STORAGE_TOKEN | HTTP CAS write token, never stored in manifest or Git |
| QPO_CONFIRM_TIMEOUT_MS | Push confirmation timeout; default 60000 |

Init persists public repository settings inside Git metadata (`.git/qpository.json`); private identity is outside Git. Unix key files/directories use 0600/0700. On Windows, generated identity directories disable inherited permissions and grant the current user access using their SID. Existing imported wallets retain their existing OS protection; protect them yourself. The local V0.1 wallet is plaintext at rest.

## Scope and failures

Proven content is the committed HEAD and all reachable history, including modes, trees and blobs. Untracked files, ignored files, other refs, Git configuration and hooks are not published. Dirty tracked files/index, hidden tracked changes, shallow/partial repositories, submodules and Git LFS are unsupported and rejected. No automatic submodule fetching or external global Git filters are used during clone. Git object serialization is independent of worktree line endings.

Every fetched object is SHA-256 checked. Envelopes have strict schemas, canonical bytes, protocol/network binding and domain-separated signatures. Each on-chain sequence must link to the previous signed envelope. Burned/missing records, unknown signers, wrong roots/HEADs, incompatible sequences and rollback below the locally pinned checkpoint fail closed. First-contact freshness still depends on the configured node. Storage availability is separate from blockchain availability.

A timed-out push can still mine later. The repository retains a `pending` envelope CID and blocks blind resubmission. After the matching record is mined, rerun push with the original HEAD to recover the local checkpoint. If a node conclusively rejected the submission, inspect its mempool/canonical records before manually clearing `pending` in `.git/qpository.json`; never clear it merely because a request timed out. A leftover `.git/qpository.json.lock` from a terminated process may be removed after confirming no qpo push process is running. Concurrent pushes from different copies can conflict; V0.1 fails closed rather than electing an application fork.

See [the architecture and source audit](docs/QPOSITORY_ARCHITECTURE.md) for exact integration points, serialization, root algorithm and trust limits.

## Export to the website on push

```sh
qpo push --web /absolute/path/QPository/website/dist
```

This confirms the RougeChain proof, then verifies and exports the public snapshot in one command. Set `QPO_WEB_DIST` to use the same destination on subsequent plain `qpo push` calls. The explicit flag takes precedence. Build and deploy the website separately to update the hosted site. An export failure returns a nonzero status but preserves the successful chain proof; retry `qpo web-export <website-dist>` or the same push without creating a duplicate anchor.
