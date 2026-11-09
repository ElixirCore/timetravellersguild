PASSPORT MAP — timetravellersguild.com/passport/map

Files (upload into /passport/map/):
  index.html     the map
  proxy.php      same-origin relay for BGS geology, Cadw heritage and place lookups (PHP with curl)
  timepods.json  the red phonebox network — starts empty
The relay creates /passport/map/cache/ on first use (with an .htaccess that denies direct access).
The web server user needs write access to /passport/map/ for that, or create cache/ yourself.

Sign-in: this page is plain HTML. If the current /passport/map is gated by the people/auth
check, keep that gate: rename this to index.php and put your existing auth include at the top,
or let your existing router serve it. I couldn't see how the current page is gated.

Record: the map reads ../record.json (the same record the passport book uses):
  { "name": "...", "number": "TTG-...", "places": [ { "name": "Abercrave", "line": "Arrived", "inked": "2026-11-04" } ] }
Places are drawn in inked-date order and joined with time-lines. A place with "lng"/"lat" is
placed exactly. A place without them is looked up by name (OpenStreetMap, GB only, cached forever)
and its card says the position was looked up. To point at a member endpoint instead:
  <script>window.TTG_MAP = { record: '/people/me/record.php' };</script>   (before the main script)

TimePods: add stations to timepods.json as
  [ { "name": "Pod name", "lng": -3.70, "lat": 51.80, "note": "optional" } ]
Use real coordinates; nothing is placed until you list it.

ASK THE MAP (OpenAI agent)
  agent.php                 relay to the OpenAI Responses API. Holds no key itself.
  agent_auth.example.php    copy to agent_auth.php and make it return true for a signed-in citizen.
                            Until agent_auth.php exists the agent refuses everyone (AGENT_ALLOW_ANON=1 in the
                            server environment opens it, for testing only).
  Settings (secret_agent.php, then secrets.php — beside agent.php, one or two folders up, or /workbench under
  the web root — then the server environment; a returned array or define()d constants both work):
    OPENAI_API_KEY        required
    OPENAI_MODEL          required, your choice of model id
    OPENAI_BASE_URL       optional
    OPENAI_MAP_PERSONA    optional voice, e.g. your OMNI lines. Facts still have to come from the tools.
    OPENAI_MAP_REASONING  optional low | medium | high, only for models that accept it
  The tool list and instructions are fixed in agent.php; the browser can only send a question and tool results.
  Tools the agent can use (they run in the viewer's browser, through proxy.php):
    get_view, find_place, geology_at, elevation_at, terrain_profile, heritage_near, my_stamps,
    fly_to, set_layers, set_camera
  What goes to OpenAI: the map view, the last tapped point, tool results, and — only when the agent calls
  my_stamps — the stamp places, lines and dates. Not the holder's name, number or email.
  Limits: same-origin only, 60 calls an hour per address, up to 9 tool rounds per question, answers not streamed.

Layers and sources:
  3D terrain, hillshade, contours  AWS/Mapzen Terrain Tiles (terrarium), contours drawn in the browser
                                   with maplibre-contour. Metres.
  Basemap                          OpenStreetMap standard tiles (light use, attribution shown)
  Geology                          BGS 1:625k bedrock lithostratigraphy (GBR_BGS_625k_BLS), bedrock age
                                   (GBR_BGS_625k_BA), superficial lithology (GBR_BGS_625k_SLT).
                                   Tap the map with geology on to identify the unit (WMS GetFeatureInfo).
                                   1:625k is regional; it is not for site-level geology.
  Scheduled monuments              Cadw, inspire-wg:Cadw_SAM via DataMapWales WFS. Zoom 10+. Extruded red.
  Listed buildings                 Cadw, inspire-wg:Cadw_ListedBuildings. Zoom 12+. Off by default.
Heritage loads in 0.1-degree squares so each square is fetched once and cached for 7 days.

Licences to honour: OSM (ODbL, attribution), BGS 625k (check the BGS terms for your use),
Cadw data under OGL v3 with the attribution line shown in the panel footer.

Libraries: MapLibre GL JS 5.24.0 and maplibre-contour 0.1.1 from unpkg. Labels use the MapLibre
demo font server (demotiles.maplibre.org); if that ever goes, only the text labels disappear.
