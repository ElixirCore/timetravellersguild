TIME TRAVELLERS GUILD — MODULAR PHP HUB 2033

DEPLOY
Upload and extract the contents directly into:
public_html/timetravellersguild/hub/

Then visit:
https://timetravellersguild.com/hub/

STRUCTURE
index.php                 main clockwork interface
assets/css/hub.css        visual system and animation
assets/js/hub.js          touch gestures, inertia, sound and data loading
data/stations.json        station content and orbital geometry
api/stations.php          JSON station endpoint
station/index.php         reusable nested station renderer
inc/config.php            site configuration
inc/functions.php         shared PHP helpers
inc/header.php            shared document head
inc/footer.php            shared scripts and close
.htaccess                 pretty station routes and canonical host rules

ADD A STATION
Add an object to data/stations.json with:
slug, title, kicker, r, a, copy, coord, access, status, href, signal

It will appear automatically in the hub and receive:
/hub/station/{slug}/

REQUIREMENTS
PHP 7.4+
Apache mod_rewrite
Standard PHP JSON extension

PATCH 2
Asset, API and station URLs are root-relative under /hub/, so nested pretty routes retain the full interface styling.
