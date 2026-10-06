# QPository MVP launch

Today's scope: public repositories published with the local CLI, browsed and verified on the website. Signing stays on the publisher's machine. Chain confirmation uses the configured RougeChain node; this release is not a BFT light client.

## Publisher

1. Install Node 22+ and Git, run npm ci, and install the CLI with npm link.
2. Configure a funded RougeChain testnet identity, expected network and writable storage. Use file CAS for a single publisher, or HTTPS HTTP CAS for shared writes.
3. Inside a committed Git repository, run qpo init.
4. Run qpo push --web /absolute/path/QPository/website/dist.
5. Build and deploy the website. This remains a separate deployment step; the CLI does not possess hosting credentials.

## Independent verifier

1. Obtain the full expected owner public key through a trusted channel.
2. Set QPO_OWNER_KEY to that public key, QPO_STORAGE to the accessible deployed site's HTTPS origin, and QPO_API/QPO_CHAIN_ID to the expected network.
3. Run qpo clone rouge://owner/repository, enter the resulting directory and run qpo verify.
4. The exported objects directory serves signed proof history and bundles. It is read-only and never contains the wallet's private key. Re-export and redeploy after new pushes.

## Launch gates

- Automated CLI, cryptography, storage, tampering and browser tests pass.
- Site access must be approved before changing its owner-private audience.
- Export the latest live demo with the new objects directory and deploy it.
- Clone against that deployed endpoint from an independent environment. Existing tests use an SDK HTTP fixture; the earlier real testnet demo used shared file storage. Neither substitutes for this final hosted-endpoint check.

No browser-based repository publishing, accounts, issues, pull requests, private repositories or encryption are included in today's scope.

## Netlify validation — 2026-10-06

Production URL: https://qpository.netlify.app/ . Existing Netlify site c1d42413-383e-4827-9c79-4fe904b3d37c was deployed with the verified public demo objects. Root netlify.toml builds website/ and publishes dist/. GitHub source remains private.

A fresh local verifier directory, without the publisher wallet or shared file CAS, successfully cloned rouge://test/qpository-demo using QPO_STORAGE=https://qpository.netlify.app and the expected public owner key, then printed all three verification successes against the live RougeChain testnet. This validates the remote storage path from a fresh environment on the same Windows machine; a separate physical machine has not yet been tested. The homepage returned HTTP 200. Future snapshots require export and deployment; this milestone does not implement automatic hosting deployment from qpo push.
