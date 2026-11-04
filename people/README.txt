TIME TRAVELLERS GUILD — PEOPLE / ZIPLOCK MAGIC LINK

DEPLOY
1. Upload and extract the ZIP directly into:
   public_html/timetravellersguild/people/
2. Ensure PHP can write to:
   public_html/timetravellersguild/people/data/
3. Edit inc/config.php:
   - replace app_secret with a long random secret
   - set mail_enabled to true after testing PHP mail()
   - verify mail_from
4. Open:
   https://timetravellersguild.com/people/

MAGIC LINKS
- One-time tokens are stored as SHA-256 hashes.
- Links expire after 20 minutes.
- Sessions use random opaque cookies, Secure + HttpOnly + SameSite=Lax.
- With mail_enabled=false, the test link is shown on screen.

CROSS-DOMAIN SIGN-IN
Browsers cannot share one cookie between:
- timetravellersguild.com
- chronometer.online
- faetime.space

Instead this package uses a short-lived signed handoff URL.
Each destination verifies the token and sets its own local cookie.

Install:
integrations/chronometer.online/guild-handoff.php
at:
chronometer.online/auth/guild-handoff.php

Install:
integrations/faetime.space/guild-handoff.php
at:
faetime.space/auth/guild-handoff.php

Both receivers must use the same shared secret as inc/config.php.

STRUCTURE
- index.php: public profile directory
- auth/: magic-link request, consume, logout
- profile/: signed-in profile editor
- inc/: config, database, mail and helpers
- data/people.sqlite: created automatically on first request
- integrations/: receiving endpoints for the other two domains

SECURITY NOTES
- Change the default secret before use.
- Keep /data blocked from public access.
- For a larger deployment, replace mail() with SMTP and make handoff nonces
  single-use in a shared database or API.
