<?php
declare(strict_types=1);
/*
 * /jack/mind/ — Jack's mind as a space you can fly through and question.
 * His life from 1951 to the network present is laid out along a thread; memories and their
 * evidence float where they belong; his live state moves the whole field. Ask him anything:
 * the answer comes from the desk (/now/jack, site "mind") and the camera flies to the memories it drew on.
 */
require_once dirname(__DIR__, 2) . '/inc/graph.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Jack's mind — Time Travellers Guild</title>
<meta name="description" content="Fly through Jack's mind: the clerk of the Time Travellers Guild, his life from 1951 laid out in space, live as he works. Ask him about any of it.">
<meta name="theme-color" content="#030207">
<style>
:root{--ground:#030207;--ink:#dfeee8;--dim:#7d9a94;--line:#29554d;--lamp:#d7b25d;--red:#e0604f;--panel:#060b14e0}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:var(--ground);color:var(--ink);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#scene{position:fixed;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
.ui{position:fixed;pointer-events:none;inset:0}
.ui>*{pointer-events:auto}
.panel{position:absolute;background:var(--panel);border:1px solid var(--line);padding:10px 12px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.title{left:16px;top:max(14px,env(safe-area-inset-top));background:none;border:0;padding:0;letter-spacing:.14em;font-size:11px;pointer-events:none}
.title b{display:block;font-size:15px;letter-spacing:.2em}
.title a{color:var(--dim);pointer-events:auto}
h2{margin:0 0 6px;font-size:10px;letter-spacing:.16em;color:#a8e1cb;font-weight:600}
.lamp{display:inline-block;width:9px;height:9px;border-radius:50%;background:#333;margin-right:6px;vertical-align:-1px}
.lamp.on{background:var(--lamp);box-shadow:0 0 10px var(--lamp)}
.monitor{right:14px;top:max(14px,env(safe-area-inset-top));width:250px}
.gauge{display:grid;grid-template-columns:86px 1fr 28px;align-items:center;gap:6px;margin:3px 0}
.gauge span{color:var(--dim);font-size:10px}
.bar{height:5px;background:#0e1b22;border:1px solid #1d3a39;position:relative;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#2f8f74,#a8e1cb);transition:width .9s}
.gauge em{font-style:normal;text-align:right;font-size:10px}
.eras{left:50%;transform:translateX(-50%);bottom:calc(max(12px,env(safe-area-inset-bottom)) + 64px);display:flex;gap:4px;padding:6px;flex-wrap:nowrap;overflow-x:auto;max-width:calc(100vw - 24px)}
.eras button{flex:0 0 auto}
.eras button,.tools button{background:#0b1419;color:var(--ink);border:1px solid #1d3a39;font:10px ui-monospace,Menlo,monospace;padding:6px 7px;cursor:pointer;min-height:30px}
.eras button.on{background:#3a2e12;border-color:var(--lamp);color:#fff}
.eras button:focus-visible,.tools button:focus-visible,.ask input:focus-visible,.ask button:focus-visible{outline:2px solid var(--lamp);outline-offset:1px}
.ask{left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));width:min(620px,calc(100vw - 24px));display:flex;gap:6px;padding:6px}
.ask input{flex:1;background:#0b1419;color:#fff;border:1px solid #1d3a39;font:13px Georgia,serif;padding:9px 10px;min-width:0}
.ask button{background:var(--lamp);color:#1b1a17;border:0;font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;padding:0 14px;cursor:pointer}
.ask button:disabled{opacity:.5}
.tools{left:16px;top:calc(max(14px,env(safe-area-inset-top)) + 48px);display:flex;flex-direction:column;gap:4px;background:none;border:0;padding:0}
.reader{left:16px;top:calc(max(14px,env(safe-area-inset-top)) + 196px);width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 360px);overflow:auto}
.reader[hidden]{display:none}
.reader .k{font-size:9px;letter-spacing:.16em;color:var(--red)}
.reader h3{margin:3px 0 6px;font:600 17px/1.25 Georgia,serif;color:#fff}
.reader p{margin:0 0 8px;font:14px/1.55 Georgia,serif;color:#d8e6e1}
.reader .ev{display:grid;grid-template-columns:72px 1fr;gap:8px;margin:8px 0;font-size:10px;color:var(--dim)}
.reader .ev img{width:72px;height:54px;object-fit:cover;background:#111}
.reader .ev a{color:inherit}
.reader .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.reader .acts button{background:#0b1419;color:var(--ink);border:1px solid var(--line);font:10px ui-monospace,Menlo,monospace;padding:6px 8px;cursor:pointer}
.reader .jack{border-left:2px solid var(--lamp);padding-left:10px}
.close{position:absolute;right:8px;top:6px;background:none;border:0;color:var(--dim);font:14px ui-monospace,monospace;cursor:pointer}
.hint{right:14px;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 120px);width:250px;font-size:10px;color:var(--dim);line-height:1.6}
.tip{position:fixed;pointer-events:none;background:#000c;border:1px solid var(--line);padding:4px 7px;font-size:11px;transform:translate(12px,12px);white-space:nowrap;display:none}
.fallback{position:fixed;inset:0;display:none;place-items:center;text-align:center;padding:24px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(max-width:760px){
 .monitor{width:auto;left:14px;right:14px;top:calc(max(14px,env(safe-area-inset-top)) + 44px);padding:6px 10px}
 .monitor h2{display:none}
 .gauge{grid-template-columns:76px 1fr 26px;margin:1px 0}
 .tools{top:auto;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 112px);flex-direction:row;flex-wrap:wrap}
 .hint{display:none}
 .reader{top:auto;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 150px);max-height:42vh;left:12px;right:12px;width:auto}
 .eras{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;width:calc(100vw - 24px);transform:none;left:12px;-webkit-overflow-scrolling:touch}
 .eras button{padding:5px 7px;font-size:9px;min-height:30px;flex:0 0 auto}
 .title{font-size:10px}.title b{font-size:13px}
}
</style>
</head>
<body>
<canvas id="scene" tabindex="0" aria-label="Jack's mind in 3D. Drag to look around, scroll or pinch to move closer, click a memory to read it. A list of every memory is available with the List button."></canvas>
<div class="tip" id="tip"></div>
<div class="ui">
  <div class="panel title"><b>JACK'S MIND</b>CLERK · CONCEIVED 1951 · <a href="/jack/memories/">MEMORIES</a> · <a href="/lodge/">DESK</a></div>
  <div class="panel tools" aria-label="Navigation">
    <button type="button" id="btnTour" aria-pressed="false">▶ Tour his life</button>
    <button type="button" id="btnHome">⌂ Whole mind</button>
    <button type="button" id="btnNow">◉ What he's thinking</button>
    <button type="button" id="btnList" aria-expanded="false" aria-controls="reader">☰ List</button>
  </div>
  <section class="panel monitor" aria-label="Jack's internal state">
    <h2>INTERNAL STATE</h2>
    <div><span class="lamp" id="lamp"></span><span id="mode">DORMANT</span> · <span id="idle">–</span></div>
    <div id="gauges"></div>
  </section>
  <section class="panel reader" id="reader" hidden aria-live="polite"><button class="close" type="button" id="readerClose" aria-label="Close">×</button><div id="readerBody"></div></section>
  <div class="panel eras" id="eras" aria-label="Fly to an era"></div>
  <form class="panel ask" id="ask" autocomplete="off">
    <label class="sr" for="q">Ask Jack about his mind</label>
    <input id="q" name="q" maxlength="600" placeholder="Ask Jack about anything you see…">
    <button type="submit" id="askBtn">ASK</button>
  </form>
  <div class="panel hint">Drag to look · right-drag or two fingers to move · scroll or pinch to approach · click a memory to read it · WASD / arrows to fly, Q E up and down · 1–9 jump to an era · Esc to close</div>
</div>
<div class="fallback" id="fallback"><p>This view needs WebGL. Read <a href="/jack/memories/" style="color:#d7b25d">Jack's memories</a> as a page instead.</p></div>
<script>window.TTG_MIND = <?= json_encode(['csrf' => $csrf, 'feed' => '/jack/mind.php', 'desk' => '/now/jack'], JSON_UNESCAPED_SLASHES) ?>;</script>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<script type="module" src="/jack/mind/mind.js?v=1"></script>
</body>
</html>
