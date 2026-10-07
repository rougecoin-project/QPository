# Wallet login MVP

Open https://qpository.netlify.app/#login, download a challenge, run qpo login-sign /path/to/qpository-login.json with an existing local identity, then paste only the returned public proof. No private key or transaction is sent to the site. The extension currently lacks a general message-signing API; this release uses CLI signing.

Netlify Functions verify ML-DSA-65 signatures. Challenges bind the production origin, random nonce, five-minute expiry and browser cookie. A conditional atomic Blob write claims each challenge once. Sessions use random opaque tokens, hashed storage keys, one-hour expiry, HttpOnly/Secure/SameSite=Strict cookies, and server-side logout. POST requests require the exact production Origin. Signing uses a separate login domain, never the repository or transaction domain.

My repositories filters the public catalogue by authenticated public-key fingerprint. Login does not yet grant repository upload or hosted publishing. Public browsing and verification require no session. Hosting abuse controls and periodic expired challenge/session cleanup remain follow-up hardening work; expired data cannot authorize login.
