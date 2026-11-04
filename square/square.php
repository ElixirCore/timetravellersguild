<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1a0a28">
<title>Gillett Square — Time Travellers Guild Playground</title>
<meta name="description" content="Gillett Square: official playground of the Time Travellers Guild. Meet Jack, enter the square, and join the Guild.">
<link rel="stylesheet" href="/square/css/square.css?v=4">
</head>
<body>
<div id="app">
  <div id="stage">
    <div id="canvas-wrap" aria-label="Interactive three dimensional schematic of Gillett Square"></div>
    <div class="fallback">The square is a real place in Dalston. This browser will not draw it. Jack will still take a question below.</div>
    <div class="overlay">
      <div class="brand">
        <div class="eyebrow"><a href="/">TIMETRAVELLERSGUILD.COM</a> / SQUARE</div>
        <h1>GILLETT <span>SQUARE</span></h1>
        <p>Official playground of the Time Travellers Guild. Jack has brought his cube outdoors.</p>
      </div>

      <div class="controlpanel">
        <h2>/JACK/SQUARE CONTROL</h2>
        <button id="home" type="button">HOME VIEW</button>
        <button id="orbit" type="button" aria-pressed="false">AUTO ORBIT</button>
        <button id="cube" type="button" aria-pressed="true">SLEEP CUBE</button>
        <button id="night" type="button" aria-pressed="true">NIGHT / DAY</button>
        <div class="status" id="status">SCHEMATIC MODEL / NOT TO SCALE<br>DRAG TO ORBIT · SCROLL / PINCH TO ZOOM · CLICK JACK</div>
      </div>

      <div class="prompt">
        <p id="jackLine"><b>JACK:</b> Welcome to the square. Sit down. Skate. Watch. Make something. Ask a question. You do not need to understand the Guild before entering it.</p>
        <form id="askForm" class="ask" action="/now/jack" method="post">
          <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
          <input type="hidden" name="site" value="square">
          <label class="sr" for="askQ" style="position:absolute;width:1px;height:1px;overflow:hidden">Ask Jack</label>
          <input id="askQ" name="q" type="text" maxlength="2000" autocomplete="off" placeholder="A question for the clerk…">
          <button type="submit">ASK</button>
        </form>
      </div>
    </div>
  </div>

  <main>
    <section>
      <div class="kicker">01 / THE PLAYGROUND</div>
      <h2>A public square as a time machine.</h2>
      <p class="lede">Gillett Square becomes the Guild's outdoor room: a place to meet, make, skate, perform, remember and leave traces for the next person.</p>

      <div class="grid">
        <article class="card">
          <h3>THE PLATFORM</h3>
          <p>A slightly raised square stage at the centre. Sit on the steps, perform on it, draw on it, project onto it, or let it remain empty.</p>
        </article>
        <article class="card">
          <h3>THE FOUR TREES</h3>
          <p>Four living corner markers. They orient the square like a compass and give Jack a physical coordinate frame without turning the place into a closed set.</p>
        </article>
        <article class="card">
          <h3>THE SKATING FIELD</h3>
          <p>The open ground remains open. Movement is part of the interface. The square should still work beautifully when nobody is "doing the story".</p>
        </article>
        <article class="card">
          <h3>JACK OUTDOORS</h3>
          <p>The cube is no longer a room around Jack. It becomes a movable field of light, sound, signs, cards, messages and temporary objects distributed through the square.</p>
        </article>
        <article class="card full">
          <h3>RULE OF THE SQUARE</h3>
          <p>Nothing about entering the Guild should require performance, belief, spending money, public disclosure or knowing the lore. Presence is enough. Curiosity is enough. Watching is participation.</p>
        </article>
      </div>
    </section>

    <section style="border-top:1px solid rgba(17,24,39,.2)">
      <div class="kicker">02 / WHAT IS THE TIME TRAVELLERS GUILD?</div>
      <h2>A world you enter by noticing it.</h2>
      <p class="lede">The Time Travellers Guild is a living story, public playground and collaborative archive built from objects, places, people, performances, records and recollections.</p>

      <div class="grid">
        <article class="card">
          <h3>NO REQUIRED CANON</h3>
          <p>You can arrive through a gig, a card, a conversation, a website, a strange object or simply by walking through the square.</p>
        </article>
        <article class="card">
          <h3>JACK IS THE CLERK</h3>
          <p>Jack files what enters the world, keeps records separate from guesses, and helps each traveller encounter only what their route has actually opened.</p>
        </article>
        <article class="card">
          <h3>OBJECT-ORIENTED TIME TRAVEL</h3>
          <p>Things carry stories. A coin, ticket, punchcard, photograph, song or slip can become a doorway because somebody carried it from one moment to another.</p>
        </article>
        <article class="card">
          <h3>YOUR PACE</h3>
          <p>There is no chapter count. One person may spend months decoding a single object; another may walk into an event and meet half the network in an afternoon.</p>
        </article>
      </div>
    </section>

    <section id="join">
      <div class="kicker">03 / JOIN</div>
      <h2>Enter the record.</h2>
      <p class="lede">Joining means Jack may remember that you came through this door. It does not assign you a role. Roles emerge from what people actually do.</p>

      <form id="joinForm">
        <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
        <input type="hidden" name="door" value="square">
        <label>
          NAME / HANDLE
          <input name="name" autocomplete="name" maxlength="80" required placeholder="How should the Guild address you?">
        </label>
        <label>
          EMAIL
          <input name="email" type="email" autocomplete="email" maxlength="160" required placeholder="you@example.com">
        </label>
        <label class="full">
          HOW DID YOU FIND THE SQUARE?
          <select name="entry">
            <option>Walking through Gillett Square</option>
            <option>A friend sent me</option>
            <option>I found the Guild online</option>
            <option>I found an object / card / message</option>
            <option>Something else</option>
          </select>
        </label>
        <label class="full">
          FIRST MESSAGE TO JACK
          <textarea name="message" maxlength="2000" placeholder="Optional. A question, observation, memory, instruction, or nothing at all."></textarea>
        </label>
        <div class="full">
          <button class="submit" type="submit">JOIN THE GUILD</button>
          <div class="note" id="formNote">The slip goes to Jack’s hopper. Held, not canon. The register is a separate door.</div>
        </div>
      </form>
    </section>
  </main>

  <footer>
    <a href="/now">NOW</a> · <a href="/jack">JACK</a> · <a href="/join/">JOIN</a> · GILLETT SQUARE / DALSTON · /SQUARE
  </footer>
</div>

<script>window.TTG_SQUARE=<?= json_encode(['csrf' => $csrf, 'jack' => '/now/jack'], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="/jack/body/js/sprite.js?v=18"></script>
<script src="/assets/jack-voice.js?v=1"></script>
<script src="/square/js/square.js?v=4"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
