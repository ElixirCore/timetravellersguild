<?php
declare(strict_types=1);
require_once __DIR__ . '/../people/inc/db.php';

$user = ttg_current_user();
if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode('/passport/map')));
    exit;
}

$reg = dirname(__DIR__, 3) . '/ttg-passport/citizens.json';
$citizen = null;
if (is_file($reg)) {
    $all = json_decode(@file_get_contents($reg), true);
    if (is_array($all)) {
        $needle = mb_strtolower(trim((string)($user['display_name'] ?? '')));
        foreach ($all as $c) {
            if (mb_strtolower(trim((string)($c['name'] ?? ''))) === $needle) {
                $citizen = $c; break;
            }
        }
    }
}

$allPlaces  = is_array($citizen['places'] ?? null) ? array_values($citizen['places']) : [];
$geoPlaces  = array_values(array_filter($allPlaces, fn($p) => isset($p['lat'], $p['lon'])));
$stubPlaces = array_values(array_filter($allPlaces, fn($p) => !isset($p['lat'])));

$placesJson = json_encode($geoPlaces,  JSON_UNESCAPED_UNICODE);
$stubsJson  = json_encode($stubPlaces, JSON_UNESCAPED_UNICODE);
$numJson    = json_encode((string)($citizen['number'] ?? ''));
$nameJson   = json_encode((string)($user['display_name'] ?? ''));
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Map · Time Travellers Guild</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#0e1a1f}
#mapCanvas{display:block;position:fixed;inset:0;width:100%;height:100%}
#ui{position:fixed;inset:0;pointer-events:none;font-family:"JetBrains Mono",ui-monospace,monospace}
/* header band */
#hdr{
  position:absolute;top:0;left:0;right:0;
  display:flex;justify-content:space-between;align-items:flex-start;
  padding:max(14px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));
  color:#e4ece7;
}
#hdr p{font-size:10px;letter-spacing:.12em;line-height:1.7;text-transform:uppercase;opacity:.65}
/* stub panel */
#stubs{
  position:absolute;
  bottom:max(14px,env(safe-area-inset-bottom,0px));
  left:max(14px,env(safe-area-inset-left,0px));
  right:max(14px,env(safe-area-inset-right,0px));
  display:flex;flex-wrap:wrap;gap:6px;
  pointer-events:none;
}
.stub{
  display:flex;align-items:center;gap:6px;
  background:rgba(14,26,31,.55);backdrop-filter:blur(4px);
  border:1px solid rgba(228,236,231,.15);
  padding:4px 8px 4px 4px;border-radius:3px;
  color:#e4ece7;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;
}
.stub-badge{
  width:20px;height:20px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:9px;font-weight:700;color:#fff;flex-shrink:0;
}
.stub-label{line-height:1.3}
.stub-label b{display:block;font-size:9px}
.stub-label span{opacity:.55;font-size:8px}
/* loader */
#loader{
  position:absolute;
  bottom:calc(max(14px,env(safe-area-inset-bottom,0px)) + 36px);
  left:50%;transform:translateX(-50%);
  color:#e4ece7;font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.55;
  transition:opacity .6s;white-space:nowrap;
}
#loader.done{opacity:0;pointer-events:none}
/* back link */
#back{
  position:absolute;
  top:max(14px,env(safe-area-inset-top,0px));
  right:max(14px,env(safe-area-inset-right,0px));
  pointer-events:all;
  color:#e4ece7;font-size:9px;letter-spacing:.1em;text-decoration:none;opacity:.5;
  text-transform:uppercase;
}
#back:hover{opacity:.9}
</style>
</head>
<body>
<canvas id="mapCanvas"></canvas>
<div id="ui">
  <div id="hdr">
    <div>
      <p>Time Travellers Guild</p>
      <p><?= ttg_h((string)($citizen['number'] ?? 'No passport')) ?></p>
    </div>
    <div style="text-align:right">
      <p><?= ttg_h((string)($user['display_name'] ?? '')) ?></p>
      <p><?= count($geoPlaces) ?> of <?= count($allPlaces) ?> place<?= count($allPlaces) !== 1 ? 's' : '' ?> located</p>
    </div>
  </div>
  <div id="stubs"><!-- filled by JS --></div>
  <p id="loader">Fetching territory data…</p>
  <a id="back" href="/passport/">← Passport</a>
</div>
<script>
'use strict';
const PLACES  = <?= $placesJson ?>;
const STUBS   = <?= $stubsJson ?>;
const NUM     = <?= $numJson ?>;
const NAME    = <?= $nameJson ?>;
const GEO_URL = '/passport/map-geo.php';
const palette = ['#0e6f87','#2b56b6','#7b3ab0','#b5367f','#c0782c','#2c8f6a'];

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('mapCanvas');
const dpr    = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  canvas.width  = Math.round(window.innerWidth  * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (projFn && lastBounds) computeProj(PLACES);
  buildStatic();
  startAnim();
}
window.addEventListener('resize', resize);

// ── Stubs panel ───────────────────────────────────────────────────────────────
(function buildStubs() {
  const container = document.getElementById('stubs');
  const offset    = PLACES.length; // palette offset after geocoded places
  STUBS.forEach((p, i) => {
    const col = palette[(offset + i) % palette.length];
    const el  = document.createElement('div');
    el.className = 'stub';
    el.innerHTML =
      `<div class="stub-badge" style="background:${col}">${(p.name||'?').charAt(0).toUpperCase()}</div>` +
      `<div class="stub-label"><b>${p.name||'unknown'}</b><span>coordinates pending</span></div>`;
    container.appendChild(el);
  });
})();

// ── Mercator projection ───────────────────────────────────────────────────────
function mercY(lat) {
  const phi = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}
let projFn = null;

function computeProj(places) {
  if (!places.length) return;
  let minLat = places[0].lat, maxLat = minLat;
  let minLon = places[0].lon, maxLon = minLon;
  places.forEach(p => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
  });
  const dLat = maxLat - minLat || 0.08, dLon = maxLon - minLon || 0.08;
  minLat -= dLat * 0.38; maxLat += dLat * 0.38;
  minLon -= dLon * 0.38; maxLon += dLon * 0.38;
  const minMY = mercY(minLat), maxMY = mercY(maxLat), dMY = maxMY - minMY || .001;
  const W = canvas.width, H = canvas.height;
  const mg = 0.055;
  const L = W * mg, R = W * (1 - mg), T = H * mg, B = H * (1 - mg);
  projFn = (lat, lon) => [
    (lon - minLon) / (maxLon - minLon) * (R - L) + L,
    (1 - (mercY(lat) - minMY) / dMY) * (B - T) + T
  ];
  return { minLat, maxLat, minLon, maxLon };
}

// ── Feature store ─────────────────────────────────────────────────────────────
const features = []; // {tags, geo:[[lat,lon]], closed}

// ── Feature styling ───────────────────────────────────────────────────────────
function fStyle(tags) {
  const d = dpr;
  if (tags.natural === 'coastline')     return { size:5.5*d, color:'#2b56b6', alpha:.7,  fill:false, tx:'COAST · ' };
  if (tags.waterway === 'river')        return { size:5*d,   color:'#0e6f87', alpha:.65, fill:false, tx:null };
  if (tags.waterway === 'canal')        return { size:4.5*d, color:'#0e6f87', alpha:.6,  fill:false, tx:null };
  if (tags.waterway === 'stream'||tags.waterway==='drain') return { size:3.5*d, color:'#0e6f87', alpha:.42, fill:false, tx:'~ ' };
  if (tags.waterway)                    return { size:3*d,   color:'#0e6f87', alpha:.35, fill:false, tx:'~ ' };
  if (tags.railway === 'rail')          return { size:4*d,   color:'#7b3ab0', alpha:.55, fill:false, tx:'RAILWAY · ' };
  if (tags.highway==='motorway'||tags.highway==='trunk')   return { size:7*d,   color:'#0a1e26', alpha:.78, fill:false, tx:null };
  if (tags.highway === 'primary')       return { size:6*d,   color:'#12303a', alpha:.68, fill:false, tx:null };
  if (tags.highway === 'secondary')     return { size:5.5*d, color:'#12303a', alpha:.62, fill:false, tx:null };
  if (tags.highway === 'tertiary')      return { size:5*d,   color:'#1a3a45', alpha:.55, fill:false, tx:null };
  if (tags.highway==='residential'||tags.highway==='unclassified') return { size:4.5*d, color:'#1a3a45', alpha:.42, fill:false, tx:null };
  if (tags.highway === 'service')       return { size:3.5*d, color:'#2a4a55', alpha:.3,  fill:false, tx:null };
  if (tags.highway === 'track')         return { size:3*d,   color:'#2a4a55', alpha:.22, fill:false, tx:'· ' };
  if (tags.natural==='wood'||tags.landuse==='forest')      return { size:4*d,   color:'#2c8f6a', alpha:.18, fill:true,  tx:'♦ ' };
  if (tags.natural==='scrub'||tags.natural==='heath')      return { size:3.5*d, color:'#5a8a4a', alpha:.14, fill:true,  tx:'· ' };
  if (tags.natural==='grassland'||tags.natural==='wetland')return { size:3*d,   color:'#4a7a3a', alpha:.11, fill:true,  tx:'· ' };
  if (tags.natural==='water'||tags.landuse==='reservoir')  return { size:4*d,   color:'#0e6f87', alpha:.2,  fill:true,  tx:'~ ' };
  if (tags.natural==='sand')            return { size:3.5*d, color:'#b08a4a', alpha:.14, fill:true,  tx:'· ' };
  if (tags.landuse==='farmland'||tags.landuse==='meadow'||tags.landuse==='orchard') return { size:3*d, color:'#7a8a3a', alpha:.1, fill:true, tx:'· ' };
  if (tags.landuse==='residential')     return { size:2.5*d, color:'#3a4a55', alpha:.07, fill:true,  tx:'· ' };
  if (tags.landuse==='commercial'||tags.landuse==='industrial'||tags.landuse==='retail') return { size:2.5*d, color:'#2a3a4a', alpha:.09, fill:true, tx:'· ' };
  if (tags.landuse==='cemetery')        return { size:3*d,   color:'#4a4a5a', alpha:.12, fill:true,  tx:'† ' };
  if (tags.leisure==='park'||tags.leisure==='garden'||tags.leisure==='nature_reserve') return { size:3.5*d, color:'#2c8f6a', alpha:.14, fill:true, tx:'o ' };
  return null;
}

function wayLabel(tags, style) {
  if (style.tx) return style.tx;
  const name = tags.name ? tags.name.toUpperCase() + ' · ' : null;
  if (name) return name;
  if (tags.ref)  return tags.ref.toUpperCase() + ' · ';
  const type = tags.highway || tags.waterway || '';
  return type ? type.replace(/_/g,' ').toUpperCase() + ' · ' : '· ';
}

// ── Text renderers ────────────────────────────────────────────────────────────
function drawTextPath(ctx, pts, label, fontSize, color, alpha) {
  if (pts.length < 2 || !label) return;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0]-pts[i-1][0], dy = pts[i][1]-pts[i-1][1];
    lens.push(lens[i-1] + Math.sqrt(dx*dx+dy*dy));
  }
  const total = lens[lens.length-1];
  const cw = fontSize * 0.6;
  if (total < cw * 2) return;

  ctx.save();
  ctx.font = '400 '+fontSize+'px "JetBrains Mono",monospace';
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  let pos = cw * 0.5, ci = 0;
  while (pos < total) {
    let si = 1;
    while (si < lens.length-1 && lens[si] < pos) si++;
    const prevL = lens[si-1], segL = lens[si]-prevL;
    const ft = segL > 0 ? (pos-prevL)/segL : 0;
    const x = pts[si-1][0] + ft*(pts[si][0]-pts[si-1][0]);
    const y = pts[si-1][1] + ft*(pts[si][1]-pts[si-1][1]);
    const ang = Math.atan2(pts[si][1]-pts[si-1][1], pts[si][0]-pts[si-1][0]);
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
    ctx.fillText(label[ci % label.length], 0, 0);
    ctx.restore();
    pos += cw; ci++;
  }
  ctx.restore();
}

function drawAreaFill(ctx, pts, label, fontSize, color, alpha) {
  if (pts.length < 3 || !label) return;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const [x,y] of pts){ minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); }
  if ((maxX-minX)*(maxY-minY) < 4) return;
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
  ctx.closePath(); ctx.clip();
  ctx.font = '400 '+fontSize+'px "JetBrains Mono",monospace';
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const cw = fontSize*0.62, lh = fontSize*1.65;
  for (let y=minY; y<=maxY; y+=lh)
    for (let x=minX; x<=maxX; x+=cw)
      ctx.fillText(label[Math.round((x-minX)/cw)%label.length], x, y);
  ctx.restore();
}

// ── Graticule ─────────────────────────────────────────────────────────────────
function drawGraticule(ctx, bounds) {
  if (!projFn || !bounds) return;
  const { minLat, maxLat, minLon, maxLon } = bounds;
  function gIv(span) {
    for (const iv of [0.1,.25,.5,1,2,5,10,15,30]) { if (span/iv<=7) return iv; } return 30;
  }
  const latIv=gIv(maxLat-minLat), lonIv=gIv(maxLon-minLon);
  const fs = Math.max(9*dpr, Math.round(canvas.width*0.0085));
  ctx.save();
  ctx.font = '400 '+fs+'px "JetBrains Mono",monospace';
  ctx.strokeStyle='#5a8a9a'; ctx.lineWidth=0.5*dpr; ctx.globalAlpha=0.22; ctx.setLineDash([3*dpr,6*dpr]);
  for (let la=Math.ceil(minLat/latIv)*latIv; la<=maxLat; la+=latIv) {
    const [,y]=projFn(la,minLon); ctx.beginPath(); ctx.moveTo(canvas.width*0.055,y); ctx.lineTo(canvas.width*0.945,y); ctx.stroke();
  }
  for (let lo=Math.ceil(minLon/lonIv)*lonIv; lo<=maxLon; lo+=lonIv) {
    const [x]=projFn(minLat,lo); ctx.beginPath(); ctx.moveTo(x,canvas.height*0.055); ctx.lineTo(x,canvas.height*0.945); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha=0.4; ctx.fillStyle='#2d5060';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for (let la=Math.ceil(minLat/latIv)*latIv; la<=maxLat; la+=latIv) {
    const [,y]=projFn(la,minLon);
    ctx.fillText(Math.abs(la).toFixed(latIv<1?1:0)+'\xb0'+(la>=0?'N':'S'), canvas.width*0.052, y);
  }
  ctx.textAlign='center'; ctx.textBaseline='top';
  for (let lo=Math.ceil(minLon/lonIv)*lonIv; lo<=maxLon; lo+=lonIv) {
    const [x]=projFn(minLat,lo);
    ctx.fillText(Math.abs(lo).toFixed(lonIv<1?1:0)+'\xb0'+(lo>=0?'E':'W'), x, canvas.height*0.947);
  }
  ctx.restore();
}

// ── Markers ───────────────────────────────────────────────────────────────────
function drawMarkers(ctx) {
  if (!projFn) return;
  const TAU = Math.PI*2;
  const mR = Math.max(14, canvas.width * 0.012);
  const badgeFs = Math.max(11*dpr, mR*0.7);
  const labFs   = Math.max(9*dpr,  mR*0.52);

  PLACES.forEach((p, pi) => {
    const [x,y] = projFn(p.lat, p.lon);
    const col = palette[pi % palette.length];
    const init = (p.name||'?').charAt(0).toUpperCase();
    ctx.save();
    ctx.globalAlpha=.18; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,mR*2.6,0,TAU); ctx.fill();
    ctx.globalAlpha=1;   ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,mR,0,TAU); ctx.fill();
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 '+badgeFs+'px "JetBrains Mono",monospace'; ctx.fillText(init,x,y);
    const label = p.name+(p.inked?' · '+p.inked.slice(0,10):'');
    ctx.font='600 '+labFs+'px "JetBrains Mono",monospace';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    const lx=x+mR*1.65, tw=ctx.measureText(label).width;
    ctx.globalAlpha=.75; ctx.fillStyle='#e8eeea'; ctx.fillRect(lx-2,y-labFs*.6,tw+4,labFs*1.2);
    ctx.globalAlpha=.95; ctx.fillStyle=col; ctx.fillText(label,lx,y);
    ctx.restore();
  });
}

// ── Background micro-text ─────────────────────────────────────────────────────
function drawBackground(ctx) {
  const fs = 3 * dpr;
  const lh = fs * 1.9;
  const src = 'TIME TRAVELLERS GUILD · TERRITORIES · MAP · ';
  const reps = Math.ceil(canvas.width / (src.length * fs * 0.6)) + 2;
  const row = src.repeat(reps);
  ctx.save();
  ctx.font = '400 ' + fs + 'px "JetBrains Mono",monospace';
  ctx.fillStyle = '#12303a'; ctx.globalAlpha = 0.052;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let y = 0; y < canvas.height; y += lh) ctx.fillText(row, 0, y);
  ctx.restore();
}

// ── Animated place rings and spiral contours ──────────────────────────────────
function drawPlaceRings(ctx, t) {
  if (!projFn || !PLACES.length) return;
  const TAU = Math.PI * 2;
  const ringStep = canvas.width * 0.013;
  const fontSize = Math.max(3.5 * dpr, canvas.width * 0.004);
  ctx.font = '400 ' + fontSize + 'px "JetBrains Mono",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  PLACES.forEach((p, pi) => {
    const [cx, cy] = projFn(p.lat, p.lon);
    const col = palette[pi % palette.length];
    const latStr = Math.abs(p.lat).toFixed(5) + (p.lat >= 0 ? '\xb0N' : '\xb0S');
    const lonStr = Math.abs(p.lon).toFixed(5) + (p.lon >= 0 ? '\xb0E' : '\xb0W');
    const src = (p.name + ' ' + latStr + ' ' + lonStr + ' · ').toUpperCase();

    // Archimedean spiral contours — unique density per place
    ctx.save();
    ctx.globalAlpha = 0.075; ctx.strokeStyle = col; ctx.lineWidth = 0.6 * dpr;
    const frac = ((Math.abs(p.lat) % 1) + (Math.abs(p.lon) % 1)) / 2;
    const turns = 10 + Math.round(frac * 6);
    const maxR = canvas.width * 0.22;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      const ap = arm * TAU / 3 + t * 0.12;
      const steps = turns * 120;
      for (let s = 0; s <= steps; s++) {
        const tv = s / steps * turns * TAU;
        const r  = tv / (turns * TAU) * maxR;
        const x  = cx + r * Math.cos(tv + ap), y = cy + r * Math.sin(tv + ap);
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Concentric text rings
    for (let ring = 0; ring < 20; ring++) {
      const r     = (ring + 1) * ringStep;
      const alpha = Math.max(0.03, 0.17 - ring * 0.0075);
      ctx.globalAlpha = alpha; ctx.fillStyle = col;
      const nChars = Math.max(1, Math.round(TAU * r / (fontSize * 1.18)));
      const step   = TAU / nChars;
      const rotDir = ring % 2 === 0 ? 1 : -1;
      const phase  = ring * 0.41 + pi * 1.73 + t * rotDir * (0.28 + ring * 0.035);
      for (let i = 0; i < nChars; i++) {
        const a = i * step + phase;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (x < -fontSize*2 || x > canvas.width+fontSize*2 ||
            y < -fontSize*2 || y > canvas.height+fontSize*2) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.fillText(src[i % src.length], 0, 0);
        ctx.restore();
      }
    }
  });
  ctx.globalAlpha = 1;
}

// ── Static canvas (background + OSM + chrome) ─────────────────────────────────
let lastBounds = null;
let staticCanvas = null;

function buildStatic() {
  staticCanvas = document.createElement('canvas');
  staticCanvas.width  = canvas.width;
  staticCanvas.height = canvas.height;
  const sc = staticCanvas.getContext('2d');

  sc.fillStyle = '#e8eeea'; sc.fillRect(0, 0, canvas.width, canvas.height);
  drawBackground(sc);
  if (lastBounds) drawGraticule(sc, lastBounds);

  for (const f of features) {
    const s = fStyle(f.tags); if (!s || !s.fill || !f.closed) continue;
    const pts = f.geo.map(([la, lo]) => projFn(la, lo));
    drawAreaFill(sc, pts, wayLabel(f.tags, s), s.size, s.color, s.alpha);
  }
  for (const f of features) {
    const s = fStyle(f.tags); if (!s || s.fill) continue;
    const pts = f.geo.map(([la, lo]) => projFn(la, lo));
    drawTextPath(sc, pts, wayLabel(f.tags, s), s.size, s.color, s.alpha);
  }

  if (PLACES.length > 1) {
    sc.save(); sc.strokeStyle = '#10232b'; sc.lineWidth = 1.2 * dpr;
    sc.setLineDash([4*dpr, 6*dpr]); sc.globalAlpha = .28;
    sc.beginPath();
    PLACES.forEach((p, i) => { const [x,y] = projFn(p.lat, p.lon); i===0 ? sc.moveTo(x,y) : sc.lineTo(x,y); });
    sc.stroke(); sc.restore();
  }

  // Vignette to frame the map
  const vg = sc.createRadialGradient(
    canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.28,
    canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.75
  );
  vg.addColorStop(0, 'rgba(14,26,31,0)');
  vg.addColorStop(1, 'rgba(14,26,31,0.2)');
  sc.fillStyle = vg; sc.fillRect(0, 0, canvas.width, canvas.height);

  // North arrow
  const ax = canvas.width*.908, ay = canvas.height*.08, ah = canvas.height*.04;
  sc.save(); sc.globalAlpha = .6; sc.fillStyle = '#10232b';
  sc.beginPath(); sc.moveTo(ax, ay-ah*.55); sc.lineTo(ax-ah*.28, ay+ah*.35);
  sc.lineTo(ax, ay+ah*.1); sc.lineTo(ax+ah*.28, ay+ah*.35); sc.closePath(); sc.fill();
  sc.font = '600 '+(ah*.45)+'px "JetBrains Mono",monospace';
  sc.textAlign = 'center'; sc.textBaseline = 'top'; sc.fillText('N', ax, ay+ah*.38); sc.restore();

  // Double border
  sc.save(); sc.strokeStyle = '#12303a';
  const bm = canvas.width * .012;
  sc.lineWidth = 4*dpr; sc.globalAlpha = .55;
  sc.strokeRect(bm, canvas.height*.012, canvas.width-2*bm, canvas.height-canvas.height*.024);
  sc.lineWidth = 1*dpr; sc.globalAlpha = .28;
  const bm2 = bm + 5*dpr;
  sc.strokeRect(bm2, canvas.height*.012+5*dpr, canvas.width-2*bm2, canvas.height-canvas.height*.024-10*dpr);
  sc.restore();
}

// ── Animation loop ────────────────────────────────────────────────────────────
let raf = null, startT = null;

function animFrame(ts) {
  if (!startT) startT = ts;
  const t = (ts - startT) * 0.001;
  const ctx = canvas.getContext('2d');
  if (staticCanvas) {
    ctx.drawImage(staticCanvas, 0, 0);
  } else {
    ctx.fillStyle = '#e8eeea'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBackground(ctx);
  }
  drawPlaceRings(ctx, t);
  drawMarkers(ctx);
  raf = requestAnimationFrame(animFrame);
}

function startAnim() {
  if (!raf) { startT = null; raf = requestAnimationFrame(animFrame); }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  else startAnim();
});

// ── OSM processing ────────────────────────────────────────────────────────────
function processOSM(data) {
  if (!data.elements) return 0;
  const nodes = {};
  for (const el of data.elements)
    if (el.type==='node') nodes[el.id] = [el.lat, el.lon];

  let count = 0;
  for (const el of data.elements) {
    if (el.type!=='way' || !el.nodes || !el.tags) continue;
    if (!fStyle(el.tags)) continue;
    const geo = el.nodes.map(id => nodes[id]).filter(Boolean);
    if (geo.length < 2) continue;
    features.push({ tags:el.tags, geo, closed: el.nodes[0]===el.nodes[el.nodes.length-1] });
    count++;
  }
  return count;
}

// ── Load pipeline ─────────────────────────────────────────────────────────────
async function loadAll() {
  const loader = document.getElementById('loader');

  if (!PLACES.length) {
    loader.textContent = STUBS.length
      ? STUBS.length + ' place' + (STUBS.length>1?'s':'') + ' on record — coordinates not yet resolved'
      : 'No places on record yet';
    return;
  }

  lastBounds = computeProj(PLACES);
  buildStatic();

  const spread = (() => {
    if (PLACES.length < 2) return 0;
    let dLat = 0, dLon = 0;
    for (const p of PLACES) for (const q of PLACES) {
      dLat = Math.max(dLat, Math.abs(p.lat-q.lat));
      dLon = Math.max(dLon, Math.abs(p.lon-q.lon));
    }
    return Math.max(dLat, dLon) * 111;
  })();
  const r = Math.min(20, Math.max(2, spread < 2 ? 4 : spread * 0.07)).toFixed(1);

  let done = 0;
  await Promise.all(PLACES.map(async (p) => {
    try {
      const res = await fetch(`${GEO_URL}?lat=${p.lat}&lon=${p.lon}&r=${r}`);
      if (!res.ok) return;
      const data = await res.json();
      processOSM(data);
      done++;
      loader.textContent = 'Loading ' + done + ' / ' + PLACES.length + ' territories…';
      buildStatic();
    } catch(e) { console.warn('geo fetch failed', p.name, e); }
  }));

  loader.classList.add('done');
  buildStatic();
}

document.fonts.ready.then(() => { resize(); loadAll(); });
</script>
</body>
</html>
