# QPository website

The website is a public-source repository explorer alongside the V0.1 CLI. It browses published repository snapshots, file contents and commit history. Real browser-side ML-DSA-65 verification and SHA-256 object-root verification run before source browsing. The provenance action queries existing RougeChain APIs to confirm the current collection, manifest hash and full proof history. It shares the CLI trusted-node boundary; it is not a BFT light client.

## Publish a proven repository

Inside an initialized, pushed repository:

```sh
qpo push --web /absolute/path/QPository/website/dist
```

The exporter verifies the current state, then writes only public manifests/signatures, Git objects, a downloadable bundle and a catalogue entry. It never exports Git configuration, identity.json, private keys, hooks or storage credentials. This release limits snapshots to 32 MiB of uncompressed Git object content. It preserves other catalogue entries and rejects conflicting alias identities.

Then build and redeploy the website. Set QPO_WEB_DIST to export after each plain qpo push. Exports update local website assets; redeployment updates the hosted catalogue. Visitors can detect stale snapshots with the live provenance check. The current website includes the actual testnet qpository-demo state already validated by the CLI.

## Develop

```sh
cd website
npm ci
npm run build
npm run dev
```

Preview: http://127.0.0.1:4173. Website code is in src/, shipped assets and public snapshots in dist/. Root-level `npm test` includes browser cryptography checks and tamper/staleness rejection. Sites hosting metadata is in .openai/hosting.json; no privileged runtime secrets are required.

The current browser verifier supports the official HTTPS RougeChain API origins; custom node origins require an explicit allowlist update in src/verify.mjs. The catalogue pins the expected public identities through the trusted website publisher. Verify expected owner fingerprints out of band when stronger identity assurance is needed. A browser cannot read the publisher's local file CAS; use a shared HTTP CAS for qpo clone on another machine, or download the signed Git bundle shown on the website and validate with QPository.

No browser key entry, upload signing, private repositories, issues, pull requests or CI dashboard are implemented. Local CLI signing remains the publishing workflow.

## Clone from the deployed snapshot storage

Exports include a read-only `objects/` content-addressed directory with the signed envelopes and Git bundles for the published proof history. On another machine, set `QPO_STORAGE` to the deployed website's HTTPS origin, `QPO_OWNER_KEY` to the independently expected full public key, and the expected RougeChain API/network, then run `qpo clone rouge://owner/repository`. The website must be accessible to that machine; the current owner-private deployment requires access and is not a public storage endpoint. No write token or private key is needed by the verifier. The chain must still match the latest exported state; a stale deployment fails verification until redeployed. Publishers keep using writable file or HTTP CAS rather than the static site for push.
