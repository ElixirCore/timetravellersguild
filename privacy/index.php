<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/people/inc/terms.php';
$pageTitle = 'Privacy and the grand narrative — Time Travellers Guild';
$updated = (new DateTimeImmutable(TTG_TERMS_VERSION))->format('j F Y');
$contact = TTG_TERMS_CONTACT;
require dirname(__DIR__) . '/people/inc/header.php';
?>
<main class="auth-wrap policy">
  <article class="slip policy-card">
    <p class="beat-label">THE GUILD · PRIVACY AND THE GRAND NARRATIVE</p>
    <h1>HOW THE GUILD HOLDS WHAT YOU GIVE IT</h1>
    <p class="policy-meta">Last updated <?= ttg_h($updated) ?>. Plain English first; nothing here is hidden in the lore.</p>

    <nav class="policy-toc" aria-label="On this page">
      <a href="#short">The short version</a> · <a href="#narrative">The grand narrative</a> · <a href="#collect">What we collect</a> ·
      <a href="#others">Who else sees it</a> · <a href="#why">Why</a> · <a href="#keep">How long</a> · <a href="#rights">Your rights</a> · <a href="#contact">Contact</a>
    </nav>

    <h2 id="short">The short version</h2>
    <ul>
      <li>You can read most of the Guild without an account. To take part you sign in with your email; there are no passwords.</li>
      <li>When you <b>submit work</b> (a ledger page, something lodged on the map, a case filing, a stamp or trail point) or set your <b>avatar</b>, you lend it to the Guild's grand narrative. You are asked to agree once, before your first submission.</li>
      <li>You keep owning your work. You can stop lending it at any time.</li>
      <li>Your email address, your private chats and what Jack remembers about you are <b>never</b> part of the narrative.</li>
      <li>We don't sell anything about you, and there is no advertising.</li>
    </ul>

    <h2 id="narrative">The grand narrative: what you agree to</h2>
    <p>The Time Travellers Guild is building one collective story out of what its travellers bring: places, objects, recollections, collages, cases and the figures who carry them. Your avatar and your work become part of it.</p>
    <p>When you agree, you give the Guild a <b>non-exclusive, worldwide, royalty-free licence</b> to use your <b>avatar</b>, your <b>display name</b> and the <b>work you submit</b> in the grand narrative. That means the Guild may:</p>
    <ul>
      <li>show it on timetravellersguild.com and in Guild works made from the narrative (pages, maps, books, exhibitions, recordings);</li>
      <li>combine it with other travellers' work, retell it, adapt it, crop, blend or rearrange it, and give it a place in the story;</li>
      <li>have Jack, the Guild's clerk (an AI system), read it, file it and draw on it when he tells the story.</li>
    </ul>
    <p>You keep ownership and every other right in your work. Non-exclusive means you can use it anywhere else you like.</p>
    <p>In return, you confirm that the work is yours to lend: you made it, or you have permission to submit it. Don't submit other people's personal details, photographs of identifiable people, or anything about a living person without their permission.</p>
    <p><b>Stopping.</b> You can withdraw your agreement or close your account at any time by writing to <a href="mailto:<?= ttg_h($contact) ?>"><?= ttg_h($contact) ?></a>. From then on nothing new of yours is used, and your account and personal details are deleted. Pieces already woven into the narrative stay in it, but <b>without your name or avatar</b> attached. Until then, you can also burn ledger pages and withdraw items yourself.</p>
    <p><b>Never part of the narrative:</b> your email address, your private chats with other travellers, your sign-in details, and Jack's personal memory of you.</p>

    <h2 id="collect">What we collect</h2>
    <dl class="policy-dl">
      <dt>Your account</dt>
      <dd>Your email address (to send sign-in links), your display name and its web address, and anything you add to your slip: bio, location, avatar. Profiles are public on the register unless you make yours private.</dd>
      <dt>Signing in</dt>
      <dd>Single-use sign-in links and a session cookie (<code>ttg_people_session</code>) that keeps you signed in, plus a site session cookie that protects forms against forgery. These are strictly necessary, so there's no cookie banner.</dd>
      <dt>Your work</dt>
      <dd>Ledger pages and the images on them, items and accounts you lodge on the Passport Map, case filings and corroborations, passport stamps and guide trail points, with the places, years and notes you give them.</dd>
      <dt>Talking to Jack</dt>
      <dd>What you type or say to Jack is used to answer you. If you're signed in, Jack keeps a short <b>personal memory</b> of you (notes he chooses to keep, and your recent exchanges) so he can carry on where you left off. Ask him what he remembers, or ask him to forget, at any time. He never keeps passwords, keys or card numbers. If you're not signed in, he keeps nothing about you between visits.</dd>
      <dt>Your story so far</dt>
      <dd>As you take part, the Guild keeps your story in short beats: what you submit, and turns Jack adds when a sitting moves it. You can read it on your slip, write what it is about in your own words, and take any beat out. Only you see it.</dd>
      <dt>Jack's mind display</dt>
      <dd>A public display (<a href="/jack/mind/">Jack's mind</a>) shows Jack's own state as he works: his mode, which of his memories surfaced, which tools he used and which sites he cited. It never shows what anyone said to him, who they are, or what he replied; at most it notes whether the person at the desk was signed in.</dd>
      <dt id="fieldoffice">Booking a Field Office session</dt>
      <dd>If you reserve a place at an <a href="/field-office/">If Thursday Fails</a> session, we keep your name, your email, your language and anything you choose to tell the host about what you need. We use your email only to send you that booking and any change to the session (confirmed, moved or cancelled). Only the Field Office staff (the producer and the session host) see your details; the host may print a list of names and needs for the door, which is kept with them and shredded after the session. Venue suppliers never see who has booked. A booking does not need an account, does not join you to the Guild, and does not ask for a story. Your confirmation email has a private link where you can cancel or delete your booking at any time.</dd>
      <dt>Chat</dt>
      <dd>Messages you send to other travellers are delivered to them and kept so the conversation stays readable. They are not used in the narrative.</dd>
      <dt>Visits</dt>
      <dd>A simple house counter records which page was visited and the page you came from. Our web host keeps standard server logs (IP address, time, page) for security.</dd>
      <dt>Your browser</dt>
      <dd>Some pages remember small preferences (such as a folded panel) in your browser's own storage. That stays on your device.</dd>
    </dl>

    <h2 id="others">Who else sees it</h2>
    <p>Other travellers see what you choose to share: your public slip and the work you punch into the ledger or share on the map. Beyond that, these services handle data for us:</p>
    <ul>
      <li><b>OpenAI</b> runs Jack's thinking and the map's live guide. What you say to Jack, and the records he looks up, are sent to OpenAI to produce his reply.</li>
      <li><b>ElevenLabs</b> gives Jack his voice. If you speak to him, your audio and the conversation pass through ElevenLabs.</li>
      <li><b>Namecheap</b> (web-hosting.com) hosts the site and sends the sign-in emails.</li>
      <li><b>ffilm.org</b>, a sister site, runs the house counter.</li>
      <li><b>Google Fonts</b> and public code libraries (jsDelivr, cdnjs, unpkg) serve type and scripts, and map tile and photo services (OpenStreetMap, OpenHistoricalMap, MapTiler, the National Library of Scotland, Flickr, Mapillary and others) serve the maps. Your browser contacts them directly, so they see your IP address.</li>
    </ul>
    <p>Some of these services are outside the UK, mainly in the USA, and they handle data under their own safeguards for international transfers.</p>

    <h2 id="why">Why we use it</h2>
    <ul>
      <li><b>To run the Guild for you</b> (your account, sign-in, your work, Jack's answers): because you asked us to.</li>
      <li><b>The grand narrative</b>: because you agreed to lend your avatar and work.</li>
      <li><b>Field Office bookings</b>: to give you the place you asked for and tell you if it changes.</li>
      <li><b>Jack's personal memory, the visit counter and server logs</b>: our legitimate interest in giving you continuity and keeping the site working and safe. You can ask Jack to forget, or ask us to switch his memory of you off.</li>
    </ul>

    <h2 id="keep">How long we keep it</h2>
    <ul>
      <li>Your account and slip: until you close your account.</li>
      <li>Sign-in links expire after twenty minutes; a sign-in lasts up to 30 days.</li>
      <li>Burnt ledger pages: 30 days in the ashes, then deleted for good.</li>
      <li>Jack's memory of you: until you ask him to forget, or you close your account.</li>
      <li>Work already woven into the narrative: kept as part of it, without your name once you withdraw.</li>
      <li>Field Office bookings: deleted 90 days after the session, or straight away if you delete your booking; cancelled bookings are deleted after 30 days.</li>
    </ul>

    <h2 id="rights">Your rights</h2>
    <p>Under UK data protection law you can ask to see the personal data we hold about you, have it corrected or deleted, restrict or object to how we use it, and get a copy to take elsewhere. Write to <a href="mailto:<?= ttg_h($contact) ?>"><?= ttg_h($contact) ?></a> and we will answer within a month. If you're unhappy with how we've handled your data, you can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" rel="noopener">ico.org.uk</a>.</p>
    <p>The Guild isn't meant for children under 13, and we don't knowingly hold their details.</p>

    <h2 id="contact">Contact</h2>
    <p>The Time Travellers Guild is looked after by the Keeper. Write to <a href="mailto:<?= ttg_h($contact) ?>"><?= ttg_h($contact) ?></a>.</p>
    <p>If these terms change in a way that affects what you've agreed to, we will ask you to agree again before your next submission.</p>
  </article>
</main>
<style>
.policy .policy-card{max-width:46rem;margin:0 auto;line-height:1.6}
.policy h2{margin:2rem 0 .6rem;font-size:1.05rem;letter-spacing:.06em;text-transform:uppercase}
.policy-meta{opacity:.75}
.policy-toc{font-size:.9rem;line-height:1.9;margin:1rem 0 .5rem}
.policy ul{padding-left:1.2rem}
.policy li{margin:.35rem 0}
.policy-dl dt{font-weight:700;margin-top:.9rem}
.policy-dl dd{margin:.2rem 0 0}
.policy code{font-size:.9em}
</style>
<?php require dirname(__DIR__) . '/people/inc/footer.php'; ?>
