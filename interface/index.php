<?php
// timetravellersguild.com/interface — prompt to noise, then DSP. Public.
// Credits are guarded server-side: restricted key, daily cap, pacing (see generate.php).
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>INTERFACE .;. prompt to noise</title>
<link rel="stylesheet" href="assets/interface.css?v=2">
</head>
<body>
<main class="deck">
  <header>
    <h1>INTERFACE</h1>
    <p class="sub">type it &#8258; hear it &#8258; bend it</p>
  </header>

  <section class="promptbox">
    <textarea id="prompt" rows="2" maxlength="500" placeholder="a brass band falling down a lift shaft"></textarea>
    <div class="row">
      <div class="modes" role="group" aria-label="kind of noise">
        <button type="button" id="mode-music" class="mode on">music</button>
        <button type="button" id="mode-sfx" class="mode">fx</button>
      </div>
      <select id="seconds" aria-label="length">
      </select>
      <button type="button" id="go" class="go">GENERATE</button>
    </div>
    <p id="status" class="status">&nbsp;</p>
    <p id="quota" class="quota">&nbsp;</p>
  </section>

  <section class="stage" id="stage" hidden>
    <div class="stagerow">
      <button type="button" id="play" class="play" aria-label="play">&#9654;</button>
      <div class="xywrap">
        <div id="xy" class="xy" role="slider" aria-label="filter and pitch pad" tabindex="0"><div id="xydot" class="xydot"></div></div>
        <p class="xylabel">x filter &nbsp;&#183;&nbsp; y pitch</p>
      </div>
    </div>
    <div class="knobs" id="knobs"></div>
    <p class="clipname" id="clipname">&nbsp;</p>
  </section>

  <section class="clips">
    <h2>made today &amp; before</h2>
    <ul id="cliplist"></ul>
  </section>
</main>
<script src="assets/interface.js?v=2"></script>
</body>
</html>