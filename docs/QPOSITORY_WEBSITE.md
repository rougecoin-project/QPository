# QPository website delivery

Deployed website: https://qpository.eharouge.chatgpt.site

Initial audience: owner-private, using Sites' default access policy. No private repository functionality was introduced; all code snapshots are public-only protocol content.

Source: website/ . Hosted source commit: bf894b4a4b70bb9d6c3e6ead2951fb64611d0345. Deployment confirmed succeeded on 2026-10-06.

Features: searchable published repository catalogue, signed file views, real Git commit history, downloadable Git bundles, clone instructions, owner public-key copy, browser ML-DSA-65 and SHA-256 object-root verification, and a live RougeChain canonical-record check. Snapshot publishing uses qpo web-export after qpo push; redeploy after exporting a new state.

The demo is the actual previously anchored testnet qpository-demo, not invented repository data. Browser checks displayed all three verification successes against the live testnet. The site retains the documented trusted-node boundary and rejects stale snapshots rather than claiming current confirmation.

Browser navigation and the hello.txt content view were checked through the local preview. Root npm test covers CLI, protocol, storage and browser verification/tampering. No RougeChain consensus changes and no private key uploads.

Windows packaging required directly invoking the bundled Sites package-site.sh through Git Bash with /c paths after the main workflow's package helper failed. The main workflow had already pushed the exact source commit; the validated archive was created from unchanged source and the same commit was saved and deployed successfully.
