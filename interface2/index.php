<?php
// timetravellersguild.com/interface2 — multitrack prompt to noise. Public.
// Credits are guarded server-side: restricted key, daily cap, pacing (see generate.php).
require __DIR__.'/config.php';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>INTERFACE .;. many noises, one machine</title>
<link rel="stylesheet" href="assets/interface2.css?v=4">
</head>
<body>
<main class="deck">
  <header>
    <h1>INTERFACE</h1>
    <p class="sub">type it &#8258; hear it &#8258; layer it</p>
  </header>

  <section class="promptbox">
    <textarea id="prompt" rows="2" maxlength="500" placeholder="a brass band falling down a lift shaft"></textarea>
    <div class="makerow">
      <div class="modes" role="group" aria-label="kind of noise">
        <button type="button" id="mode-music" class="mode on">music</button>
        <button type="button" id="mode-sfx" class="mode">fx</button>
      </div>
      <select id="seconds" aria-label="length"></select>
      <button type="button" id="go" class="go">GENERATE</button>
    </div>
    <p id="status" class="status">&nbsp;</p>
    <p id="quota" class="quota">&nbsp;</p>
  </section>

  <div class="arc"></div>

  <section class="mixbar" aria-label="the mix">
    <div class="orbs">
      <button type="button" id="stopall" class="orb big"><span>stop<br>all</span></button>
      <button type="button" id="dlmix" class="orb big"><span>Export</span></button>
      <button type="button" id="savemix" class="orb big"><span>Save</span></button>
    </div>
    <div id="mixes" class="mixes"></div>
  </section>

  <div class="arc"></div>

  <section class="tracks" id="tracks" aria-label="tracks"></section>
  <p class="hint" id="emptyhint">no tracks yet &#8258; add noises from below</p>

  <div class="arc"></div>

  <section class="clips">
    <h2>the noises</h2>
    <ul id="cliplist"></ul>
  </section>
</main>
<script src="assets/interface2.js?v=4"></script>
</body>
</html>