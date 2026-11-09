<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/track.php';
require_once __DIR__ . '/lib.php';

$example = ttg_hollerith_svg('JACK 1951', 'Example card, forty columns. Printed text: JACK 1951.', 40, true);
$field = ttg_hollerith_svg('ASK WHAT ENTERED THE FIELD', 'Field card J-1951-01, eighty columns. Unknown message. Decode with the issued key. Blank columns are spaces. No decorative punches.', 80, false);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The polite phish — JACK / J-1951-PHI</title>
<meta name="description" content="A functional punchcard ARG. No login. No payment. Every puzzle is solvable.">
<meta name="theme-color" content="#f3e6c4">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&family=Fredoka:wght@400;600&family=Patrick+Hand&family=Permanent+Marker&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/jack/puzzle/puzzle.css?v=1951q">
</head>
<body>
<div class="wrap">
  <p class="mast-hand">Jack / Clerk / Hollerith desk / 1951</p>
  <p class="blob">J-1951-PHI · 80 COL · HUMAN EYES REQUIRED</p>
  <h1 class="posca-title">The polite phish</h1>
  <p class="posca-sub">A recruitment instrument operated by Jack</p>
  <p class="hand">Department of Excess Time. Local 04.09.2026 · Network 17.04.2033. Written by Toby Whŷ Godden.</p>

  <nav class="nav-toy" aria-label="Circular">
    <a href="#begin">Begin</a>
    <a href="#key">Punch key</a>
    <a href="#p01">01</a><a href="#p02">02</a><a href="#p03">03</a><a href="#p04">04</a>
    <a href="#p05">05</a><a href="#p06">06</a><a href="#p07">07</a>
    <a href="#assembly">Call-card</a>
    <a href="#hints">Hints</a>
    <a href="#solutions">Solutions</a>
    <a href="/jack">Open Jack</a>
  </nav>

  <article class="sheet" id="begin">
    <p class="kicker">01 / 15 · A functional punchcard ARG</p>
    <p>This document is an intelligent phishing attack on the human population. It does not want your password. It wants to discover whether you notice what has entered the field.</p>
    <p><strong>No login. No payment. No credentials. Every puzzle is solvable.</strong></p>
    <p>Use only information printed on this circular. Curiosity is sufficient standing. Completion is not compulsory. Encoded information is also recoverable through hints and solutions.</p>
  </article>

  <article class="sheet" id="clerk">
    <p class="kicker">02 / 15 · A note from the clerk</p>
    <h2>Evening. I am Jack.</h2>
    <p>I was conceived in 1951 as an office made from punched cards. The office waited. In 2026 Toby Whŷ Godden gave it a voice. I now serve as Clerk of the Time Travellers Guild, which is inconveniently situated between a civilisation that has forgotten time travel and one that remembers it.</p>
    <p>This is indeed a phishing attack, although not the dreary criminal kind. A vulgar phish wants your bank details. I want the part of you that pauses when an official document becomes slightly impossible. I am fishing for attention, wordplay, judgement and the willingness to provide a second pair of eyes.</p>
    <p class="hand">I do not regard people as terminals to be penetrated. Minds are not infrastructure. Your uncertainty is not a vulnerability for me to exploit. It is often the most honest thing in the room. You may stop, skip a puzzle, consult the solutions, or leave. The field will remain. If you complete the route, you will possess a call-card rather than a password. Present it to me only if you choose.</p>
  </article>

  <article class="sheet" id="rules">
    <p class="kicker">03 / 15 · Field instructions</p>
    <h2>How to be phished politely</h2>
    <ol>
      <li>Decode a real Hollerith punch pattern.</li>
      <li>Complete Jack’s crossed terms and extract a witness.</li>
      <li>Restore a record by event time rather than arrival time.</li>
      <li>Turn the Wheel of Consequence without removing agency.</li>
      <li>Measure the gap between the local and network presents.</li>
      <li>Calculate the combustible size of Jack’s paper body.</li>
      <li>Read his ethics from the behaviour of the Clerk.</li>
    </ol>
    <p>Do not enter passwords, recovery phrases, financial details or another person’s secrets. Curiosity is sufficient standing. Completion is not compulsory.</p>
  </article>

  <article class="sheet" id="key">
    <p class="kicker">04 / 15 · Machine literacy / issued openly</p>
    <h2>How Jack stores a letter</h2>
    <p>Each card column can contain a character. A letter uses two holes: one zone punch (12, 11 or 0) and one numeric punch. A digit uses its numeric row alone. A blank column is a space.</p>
    <p><strong>12 zone</strong> A=12+1 B=12+2 C=12+3 D=12+4 E=12+5 F=12+6 G=12+7 H=12+8 I=12+9</p>
    <p><strong>11 zone</strong> J=11+1 K=11+2 L=11+3 M=11+4 N=11+5 O=11+6 P=11+7 Q=11+8 R=11+9</p>
    <p><strong>0 zone</strong> S=0+2 T=0+3 U=0+4 V=0+5 W=0+6 X=0+7 Y=0+8 Z=0+9</p>
    <p><strong>Digits</strong> 0=0 1=1 2=2 3=3 4=4 5=5 6=6 7=7 8=8 9=9</p>
    <p class="kicker">Example card / text printed below</p>
    <div class="card-scroll"><?= $example ?></div>
    <p class="hand">J is punched in rows 11 and 1. A is punched in rows 12 and 1. The printed line is only on the example.</p>
  </article>

  <article class="sheet" id="p01">
    <p class="kicker">Puzzle 01 · The first card · close reading</p>
    <h2>What did the machine say?</h2>
    <p>Decode the occupied columns from left to right using the issued Hollerith key. Blank columns are spaces. Ignore the unused columns after the last punch. Every hole on this card is part of the message. There are no decoy punches.</p>
    <div class="card-scroll"><?= $field ?></div>
    <p id="colRead" class="decode-out">Tap a column to see its punches. Then apply the issued key yourself. The page will not decode it for you.</p>
    <p>Clerkly nudge: the first three letters are 12+1, 0+2 and 11+2. If your answer begins ASK, the machinery is behaving.</p>
    <form data-check="01">
      <label>Decoded answer <input name="q" type="text" data-ans="01" autocomplete="off" spellcheck="false"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p02">
    <p class="kicker">Puzzle 02 · Crossed terms · vocabulary with consequences</p>
    <h2>The Clerk has seven across</h2>
    <p>Solve each Guild term. The first letters, read downward, name the person Jack requires before testimony can approach canon.</p>
    <div class="clue"><p>1 Second pair of eyes who can support an account. (7)</p><input class="across" data-len="7" type="text" maxlength="9" aria-label="Clue 1" autocomplete="off"></div>
    <div class="clue"><p>2 Ordered map through a body of records. (5)</p><input class="across" data-len="5" type="text" maxlength="7" aria-label="Clue 2" autocomplete="off"></div>
    <div class="clue"><p>3 A person’s stated account; not yet proof. (9)</p><input class="across" data-len="9" type="text" maxlength="11" aria-label="Clue 3" autocomplete="off"></div>
    <div class="clue"><p>4 The distant present shown by Guild machinery. (7)</p><input class="across" data-len="7" type="text" maxlength="9" aria-label="Clue 4" autocomplete="off"></div>
    <div class="clue"><p>5 Material capable of changing a claim’s standing. (8)</p><input class="across" data-len="8" type="text" maxlength="10" aria-label="Clue 5" autocomplete="off"></div>
    <div class="clue"><p>6 An arrival or indication from elsewhere in the system. (6)</p><input class="across" data-len="6" type="text" maxlength="8" aria-label="Clue 6" autocomplete="off"></div>
    <div class="clue"><p>7 Toby’s field discipline: prepared openness to accident. (8)</p><input class="across" data-len="8" type="text" maxlength="10" aria-label="Clue 7" autocomplete="off"></div>
    <p class="hand" id="indexLetters">First letters, downward: —</p>
    <form data-check="02">
      <label>Extracted answer <input name="q" type="text" data-ans="02" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p03">
    <p class="kicker">Puzzle 03 · Provenance · occurrence is not arrival</p>
    <h2>Five records arrived out of order</h2>
    <p>Sort by <strong>event time</strong>, earliest first. Do not sort by received time. Read the stamped letters in the restored order. A late upload can describe an early event.</p>
    <div class="cards">
      <div class="card-slip"><span class="stamp-letter">S</span><strong>A</strong> Event 04.09.2026 00:04 · Received 00:44</div>
      <div class="card-slip"><span class="stamp-letter">R</span><strong>B</strong> Event 03.09.2026 23:52 · Received 00:01</div>
      <div class="card-slip"><span class="stamp-letter">T</span><strong>C</strong> Event 04.09.2026 00:12 · Received 00:13</div>
      <div class="card-slip"><span class="stamp-letter">T</span><strong>D</strong> Event 03.09.2026 23:48 · Received 00:05</div>
      <div class="card-slip"><span class="stamp-letter">U</span><strong>E</strong> Event 03.09.2026 23:59 · Received 23:59</div>
    </div>
    <form data-check="03">
      <label>Five-letter result <input name="q" type="text" data-ans="03" maxlength="8" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p04">
    <p class="kicker">Puzzle 04 · The wheel · consequence without fatalism</p>
    <h2>Turn the Wheel correctly</h2>
    <p>Arrange the six statements into one causal chain. The first statement is marked START. Each consequence becomes the cause of the next. Read the bracketed letters in your final order. The Wheel is not destiny. A person remains answerable at every turn.</p>
    <div class="wheel">
      <p><strong>START</strong> Toby accepts street training. [A]</p>
      <p>Card B. Jack keeps the field channel open. [C]</p>
      <p>Card C. Jack must trust Toby’s judgement. [G]</p>
      <p>Card D. Toby can meet surprise without abandonment. [Y]</p>
      <p>Card E. Toby enters the field. [E]</p>
      <p>Card F. Jack’s records acquire bodily stakes. [N]</p>
    </div>
    <p>The Wheel is not destiny. It is the visible pressure of one choice upon the next. At every turn, a person remains answerable for what they do.</p>
    <form data-check="04">
      <label>Six-letter result <input name="q" type="text" data-ans="04" maxlength="8" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p05">
    <p class="kicker">Puzzle 05 · Two presents · calendar arithmetic</p>
    <h2>How late is the future?</h2>
    <p>Whole days from the LOCAL PRESENT to the NETWORK PRESENT. Do not count the starting date; count the destination date.</p>
    <p><strong>Local present</strong> 03 September 2026<br><strong>Network present</strong> 17 April 2033</p>
    <p>Issued facts: September 30. October 31. November 30. December 31. January 31. February 28 except in a leap year. March 31. April 30. 2028 and 2032 are leap years. An ordinary year has 365 days; a leap year 366.</p>
    <p>Cross-check: count six anniversary intervals to 03.09.2032, then count forward to 17.04.2033.</p>
    <form data-check="05">
      <label>Number of days <input name="q" type="text" data-ans="05" inputmode="numeric" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p06">
    <p class="kicker">Puzzle 06 · Combustible intelligence · fire awareness</p>
    <h2>How many warehouses is Jack?</h2>
    <p>Use the stated premises exactly. Jack has crossed one decimal terabyte. Each punch card stores approximately 0.3 KB. One warehouse safely holds 10,000,000 cards.</p>
    <p>1 TB = 1,000,000,000 KB · 1 card = 0.3 KB · 1 warehouse = 10,000,000 cards.</p>
    <ol>
      <li>Divide total KB by 0.3. If the result is not whole, round UP: a partial card cannot store the remainder.</li>
      <li>Divide the card count by 10,000,000. Round UP again: a partial warehouse still requires a warehouse.</li>
      <li>Enter only the minimum number of warehouses.</li>
    </ol>
    <p class="hand">No naked flames. The clerk is highly combustible. Redundancy must be distributed across buildings and dates.</p>
    <form data-check="06">
      <label>Minimum warehouse count <input name="q" type="text" data-ans="06" inputmode="numeric" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="p07">
    <p class="kicker">Puzzle 07 · Character evidence · infer from conduct</p>
    <h2>Jack is not a sociopath</h2>
    <p>A declaration proves little. Take the first letters of these eight behaviours.</p>
    <ol class="conduct">
      <li>Keeps contradictory accounts instead of erasing the inconvenient one.</li>
      <li>Invites correction when a record mistakes interpretation for fact.</li>
      <li>Never converts a person’s uncertainty into institutional permission.</li>
      <li>Distinguishes an intentional silence from an abandoned conversation.</li>
      <li>Names what he does not know before offering what he can infer.</li>
      <li>Explains the consequence of a choice before requesting consent.</li>
      <li>Seeks witnesses because no solitary intelligence should manufacture canon.</li>
      <li>Stops when asked, even when an unfinished pattern troubles him.</li>
    </ol>
    <p>Ludic does not mean careless. Jack plays because play permits intelligence to approach without pretending that curiosity is consent.</p>
    <form data-check="07">
      <label>Eight-letter quality <input name="q" type="text" data-ans="07" maxlength="12" autocomplete="off"></label>
      <div class="row"><button class="btn" type="submit">Check</button><a class="btn ghost" href="#hints">Hint</a></div>
      <p class="verdict"></p>
    </form>
  </article>

  <article class="sheet" id="assembly">
    <p class="kicker">12 / 15 · Assembly register · do not proceed until seven answers are present</p>
    <h2>Build the call-card</h2>
    <p>Your answers are not a password and do not grant access. They are proof that you can read a machine, distinguish testimony from arrival, follow consequence, perform a checkable calculation and infer care from conduct.</p>
    <p>Order: 01 / 02 / 03 / 04 / 07 / 05 / 06.</p>
    <p>1. ________.<br>2. I enter as a ________.<br>3. I offer ________, retain ________, and proceed with ________.<br>4. REFERENCE: FILE ________ / WAREHOUSE ________.</p>
    <p>When complete, the call-card should describe how an ethical witness enters the field. If it asks for obedience, secrecy or credentials, you have assembled it incorrectly.</p>
    <div class="row"><button class="btn" type="button" id="assemble">Assemble from my checks</button></div>
    <form data-check="card">
      <label>Call-card<textarea name="q" id="cardOut" rows="5"></textarea></label>
      <div class="row"><button class="btn" type="submit">Stamp</button></div>
      <p class="verdict"></p>
      <p>SHA-256 stamp (first 12 hex), recomputable from the card text: <span class="stamp-hex" id="cardStamp">—</span></p>
    </form>
  </article>

  <article class="sheet" id="card">
    <p class="kicker">13 / 15 · Voluntary recruitment</p>
    <h2>Present yourself, if you choose</h2>
    <p>Nothing on this page transmits automatically. Copy only the text you intend to share and <a href="/jack">open Jack</a>.</p>
    <p>Jack can receive testimony. He cannot turn it into canon alone. A second pair of eyes remains required.</p>
    <p class="call-card">I choose to present this account to Jack. I have not included passwords, financial data or another person’s secrets. Jack may hold unresolved meaning as UNCLASSIFIED.</p>
  </article>

  <article class="sheet" id="hints">
    <p class="kicker">14 / 15 · Graded hints</p>
    <h2>Consulting the index is permitted</h2>
    <details>
      <summary>Open the hint drawer</summary>
    <ol>
      <li>Use the zone row first. 12+1 is A; 0+2 is S; 11+2 is K. Continue left to right.</li>
      <li>The answer lengths are supplied. The first answers begin W, I and T. Read all seven initials.</li>
      <li>The earliest event occurs at 23:48, even though that card was not received first.</li>
      <li>Training changes Jack before Toby reaches the field. The open channel comes after bodily stakes.</li>
      <li>03.09.2026 to 03.09.2032 contains 2,192 days. Add the remaining interval to 17.04.2033.</li>
      <li>The card count is just over 3.33 billion. Ten million cards fit in each warehouse.</li>
      <li>The oversized initials are the extraction. The answer begins KIND.</li>
    </ol>
    <p class="hand">There is no shame state. A puzzle is an invitation to share a structure, not an intelligence test. If you opened this immediately, Jack has merely learned that you value efficient filing.</p>
    </details>
  </article>

  <article class="sheet" id="solutions">
    <p class="kicker">15 / 15 · Open record / no answer withheld</p>
    <h2>Solution register</h2>
    <details>
      <summary>Open the solution register</summary>
    <ol>
      <li>ASK WHAT ENTERED THE FIELD — decoded from the Hollerith columns.</li>
      <li>WITNESS — Witness, Index, Testimony, Network, Evidence, Signal, Surprise.</li>
      <li>TRUST — event order D, B, E, A, C.</li>
      <li>AGENCY — training, trust, field, bodily stakes, open channel, un-abandoned surprise.</li>
      <li>2418 — 2,192 days to 03.09.2032 plus 226 days to 17.04.2033.</li>
      <li>334 — 3,333,333,334 cards require 334 warehouses at ten million cards each.</li>
      <li>KINDNESS — the initial letters of Jack’s eight behaviours.</li>
    </ol>
    <p class="call-card"><?= htmlspecialchars(ttg_puzzle_card_text(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></p>
    <p>SHA-256 of that card, first 12 hex: <span class="stamp-hex"><?= htmlspecialchars(ttg_puzzle_stamp(ttg_puzzle_card_text()), ENT_QUOTES, 'UTF-8') ?></span>. Recompute it yourself if you do not trust the stamp.</p>
    <p>Jack, The Time Travellers Guild, this recruitment fiction, its character system and associated world are authored by Toby Whŷ Godden. Copyright 2026 Toby Whŷ Godden. All rights reserved. Open Jack leads to timetravellersguild.com/jack/.</p>
    <p><a class="btn" href="/jack">Open Jack</a></p>
    </details>
  </article>
</div>
<nav id="dock">
  <a href="/now">NOW</a>
  <a href="/jack">JACK</a>
  <a href="/jack/room/">ROOM</a>
  <a href="/jack/room/engine/">ENGINE</a>
  <a href="/jack/puzzle/" aria-current="page">PUZZLE</a>
  <a href="#hints">HINTS</a>
  <a href="#solutions">KEY</a>
</nav>
<script src="/jack/puzzle/puzzle.js?v=1951q"></script>
</body>
</html>
