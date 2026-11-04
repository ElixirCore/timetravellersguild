<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

ttg_graph_boot_session();
$csrf = ttg_graph_csrf();

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

/* -------------------------------------------------------
   DISCOVER /square/images/
------------------------------------------------------- */

$imageDir = __DIR__ . '/images';
$images = [];

if (is_dir($imageDir)) {
    foreach (scandir($imageDir) ?: [] as $file) {
        if ($file === '.' || $file === '..') continue;

        if (!preg_match('/\.(jpe?g|png|webp|gif|avif)$/i', $file)) {
            continue;
        }

        $images[] = '/square/images/' . rawurlencode($file);
    }
}

sort($images, SORT_NATURAL | SORT_FLAG_CASE);

$config = [
    'csrf'   => $csrf,
    'jack'   => '/now/jack',
    'images' => $images,
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"
>

<meta name="theme-color" content="#c9c4b7">

<title>Gillett Square — Time Travellers Guild</title>

<meta
  name="description"
  content="Gillett Square, Dalston. Same coordinates. Different square."
>

<style>
:root {
    --ink:#161514;
    --paper:#d3cec0;
    --cream:#e5dfd0;

    --rx:0deg;
    --ry:0deg;
    --tz:0px;

    --time:0;
}

* {
    box-sizing:border-box;
}

html,
body {
    width:100%;
    height:100%;
    margin:0;
    overflow:hidden;

    background:#c8c5ba;
    color:var(--ink);

    font-family:
        "Courier New",
        Courier,
        monospace;

    overscroll-behavior:none;
}

body {
    touch-action:none;
}


/* =======================================================
   FIELD
======================================================= */

#field {
    position:fixed;
    inset:0;

    overflow:hidden;

    perspective:1100px;

    background:
        radial-gradient(
            circle at 48% 36%,
            #e4e0d5 0%,
            #cbc8bd 55%,
            #a8aaa6 100%
        );
}


/* main world */

#world {
    position:absolute;
    inset:-15%;

    transform-style:preserve-3d;

    transform:
        rotateX(var(--rx))
        rotateY(var(--ry))
        translateZ(var(--tz));

    transition:transform .06s linear;
}


/* =======================================================
   PHOTOGRAPHIC PLANES
======================================================= */

.layer {
    position:absolute;
    inset:0;

    transform-style:preserve-3d;

    pointer-events:none;
}


/* distant environs */

#far {
    transform:
        translateZ(-500px)
        scale(1.48);

    opacity:.72;
}


/* architectural ring */

#architecture {
    transform:
        translateZ(-180px)
        scale(1.14);
}


/* square itself */

#squarePlane {
    transform:
        translateZ(0);
}


/* nearer bodies / debris / temporary things */

#near {
    transform:
        translateZ(230px)
        scale(.82);
}


/* =======================================================
   SLASHES
======================================================= */

.slash {
    position:absolute;

    background-image:var(--img);
    background-size:cover;
    background-position:var(--bx, 50%) var(--by, 50%);

    transform-origin:center;

    opacity:var(--alpha, .85);

    filter:
        contrast(var(--contrast, 1.08))
        saturate(var(--sat, .92))
        brightness(var(--bright, .96));

    mix-blend-mode:var(--blend, normal);

    will-change:
        transform,
        opacity,
        filter;

    box-shadow:
        0 1px 0 rgba(255,255,255,.08);

    clip-path:polygon(
        var(--p1x,0%) var(--p1y,8%),
        var(--p2x,100%) var(--p2y,0%),
        var(--p3x,95%) var(--p3y,100%),
        var(--p4x,3%) var(--p4y,92%)
    );
}


/* the crucial thing:
   no neat rectangles */

.slash::before {
    content:"";
    position:absolute;
    inset:0;

    background:
        linear-gradient(
            92deg,
            rgba(255,255,255,.08),
            transparent 22%,
            rgba(0,0,0,.08) 77%,
            transparent
        );

    opacity:.35;
}


/* narrow cuts */

.slash.cut {
    clip-path:polygon(
        4% 0,
        100% 7%,
        91% 100%,
        0 91%
    );
}


/* triangular fragments */

.slash.shard {
    clip-path:polygon(
        0 9%,
        100% 0,
        61% 100%,
        13% 82%
    );
}


/* long street/horizon strips */

.slash.ribbon {
    clip-path:polygon(
        0 19%,
        100% 0,
        98% 82%,
        2% 100%
    );
}


/* =======================================================
   FLOOR

   A photographic ground plane extending toward viewer.
======================================================= */

#ground {
    position:absolute;

    width:150vw;
    height:125vh;

    left:-25vw;
    top:44vh;

    transform-origin:50% 0;

    transform:
        rotateX(67deg)
        translateZ(-20px);

    transform-style:preserve-3d;

    overflow:hidden;

    opacity:.78;

    -webkit-mask-image:
        linear-gradient(
            to bottom,
            rgba(0,0,0,.15),
            #000 20%,
            #000 72%,
            transparent 100%
        );

    mask-image:
        linear-gradient(
            to bottom,
            rgba(0,0,0,.15),
            #000 20%,
            #000 72%,
            transparent 100%
        );
}


/* =======================================================
   HORIZON
======================================================= */

#horizon {
    position:absolute;
    left:-10vw;
    right:-10vw;

    top:18vh;
    height:45vh;

    transform-style:preserve-3d;

    -webkit-mask-image:
        linear-gradient(
            to bottom,
            transparent,
            #000 14%,
            #000 83%,
            transparent
        );

    mask-image:
        linear-gradient(
            to bottom,
            transparent,
            #000 14%,
            #000 83%,
            transparent
        );
}


/* =======================================================
   TIME GHOSTS
======================================================= */

.memory {
    opacity:0;

    transition:
        opacity 1.7s ease,
        filter 1.7s ease;

    filter:
        grayscale(.22)
        contrast(1.2)
        saturate(.75);
}

.memory.alive {
    opacity:var(--memory-alpha,.42);
}


/* =======================================================
   OPENING TYPE
======================================================= */

#title {
    position:absolute;
    inset:0;

    z-index:80;

    display:flex;
    align-items:center;

    padding:
        max(30px, env(safe-area-inset-top))
        max(34px, env(safe-area-inset-right))
        max(34px, env(safe-area-inset-bottom))
        max(34px, env(safe-area-inset-left));

    pointer-events:none;

    transition:
        opacity 1.4s ease,
        transform 1.4s ease;
}

#title.leave {
    opacity:0;
    transform:scale(1.08);
}

.title-inner {
    margin-top:19vh;
}

.location {
    font-size:clamp(11px,2vw,20px);

    letter-spacing:.19em;

    margin-bottom:20px;
}

h1 {
    margin:0;

    font-family:
        Rockwell,
        "Courier New",
        serif;

    font-size:clamp(58px,13vw,164px);

    letter-spacing:-.07em;
    line-height:.76;

    text-transform:uppercase;
}

h1 span {
    display:block;
    margin-left:.55em;
}

.subtitle {
    margin-top:28px;

    font-size:clamp(16px,3vw,30px);
    line-height:1.5;

    letter-spacing:.05em;
}


/* =======================================================
   SMALL LOCATION STAMP
======================================================= */

#stamp {
    position:absolute;

    z-index:90;

    top:max(20px, env(safe-area-inset-top));
    left:max(24px, env(safe-area-inset-left));

    font-size:10px;
    line-height:1.8;

    letter-spacing:.17em;

    opacity:.55;

    pointer-events:auto;
}

#stamp a {
    color:inherit;
    text-decoration:none;
}


/* =======================================================
   JACK
======================================================= */

#jack {
    position:absolute;

    z-index:55;

    left:51%;
    top:58%;

    width:56px;
    height:44px;

    transform:
        translate(-50%,-50%)
        translateZ(340px);

    cursor:pointer;

    opacity:.9;

    pointer-events:auto;
}


/* deliberately tiny / almost found rather than announced */

.jack-body {
    position:absolute;
    left:5px;
    top:12px;

    width:40px;
    height:27px;

    background:#151515;

    clip-path:polygon(
        3% 10%,
        88% 0,
        100% 71%,
        80% 100%,
        7% 87%
    );
}

.jack-head {
    position:absolute;

    width:21px;
    height:21px;

    right:0;
    top:2px;

    background:#111;

    clip-path:polygon(
        7% 19%,
        23% 0,
        42% 17%,
        74% 4%,
        100% 38%,
        84% 100%,
        9% 84%
    );
}

.jack-eye {
    position:absolute;

    width:3px;
    height:3px;

    right:6px;
    top:10px;

    background:#ebe4be;
}


/* =======================================================
   JACK SLIP
======================================================= */

#jackSlip {
    position:absolute;

    z-index:100;

    left:50%;
    bottom:max(24px, env(safe-area-inset-bottom));

    width:min(470px, calc(100vw - 28px));

    transform:
        translate(-50%,30px)
        rotate(-.35deg);

    opacity:0;
    pointer-events:none;

    transition:
        opacity .25s ease,
        transform .25s ease;
}

#jackSlip.open {
    opacity:1;

    pointer-events:auto;

    transform:
        translate(-50%,0)
        rotate(-.35deg);
}

.paper {
    padding:18px 18px 14px;

    background:#e8e0c5;

    border:1px solid rgba(20,20,15,.42);

    box-shadow:
        6px 8px 0 rgba(0,0,0,.16),
        0 24px 65px rgba(0,0,0,.32);
}

#jackLine {
    margin:0 0 13px;

    font-size:13px;
    line-height:1.5;
}

#jackForm {
    display:flex;
    gap:8px;
}

#jackQ {
    flex:1;
    min-width:0;

    border:0;
    border-bottom:1px solid rgba(0,0,0,.65);

    padding:9px 1px;

    background:transparent;

    outline:none;

    border-radius:0;

    font:16px "Courier New", monospace;
}

#jackForm button {
    border:1px solid rgba(0,0,0,.55);

    background:transparent;

    padding:7px 12px;

    font:12px "Courier New", monospace;
}

#closeJack {
    position:absolute;

    right:8px;
    top:5px;

    border:0;
    background:none;

    padding:6px;

    cursor:pointer;
}


/* =======================================================
   BOTTOM INSTRUCTION
======================================================= */

#instruction {
    position:absolute;

    z-index:90;

    bottom:max(18px, env(safe-area-inset-bottom));
    left:50%;

    transform:translateX(-50%);

    white-space:nowrap;

    font-size:9px;

    letter-spacing:.17em;

    opacity:.48;

    pointer-events:none;

    transition:opacity 1s ease;
}

#instruction.leave {
    opacity:0;
}


/* =======================================================
   MOBILE
======================================================= */

@media (max-width:700px) {

    #world {
        inset:-8%;
    }

    .title-inner {
        margin-top:8vh;
    }

    #horizon {
        top:19vh;
        height:48vh;
    }

    #ground {
        top:49vh;
    }

    #jack {
        top:62%;
    }
}
</style>
</head>

<body>

<div id="field">

    <div id="world">

        <div id="far" class="layer">
            <div id="farFragments"></div>
        </div>

        <div id="architecture" class="layer">

            <div id="horizon">
                <div id="horizonFragments"></div>
            </div>

        </div>

        <div id="squarePlane" class="layer">

            <div id="ground">
                <div id="groundFragments"></div>
            </div>

            <div id="squareFragments"></div>

        </div>

        <div id="near" class="layer">
            <div id="nearFragments"></div>
        </div>

    </div>


    <div id="stamp">
        <a href="/">TIMETRAVELLERSGUILD.COM</a><br>
        GILLETT SQUARE / DALSTON
    </div>


    <header id="title">

        <div class="title-inner">

            <div class="location">
                FIELD LOCATION / GILLETT SQUARE
            </div>

            <h1>
                GILLETT
                <span>SQUARE</span>
            </h1>

            <div class="subtitle">
                Same coordinates. Different square.<br>
                Move through it.
            </div>

        </div>

    </header>


    <div id="jack" aria-label="Jack" role="button" tabindex="0">
        <div class="jack-body"></div>
        <div class="jack-head"></div>
        <div class="jack-eye"></div>
    </div>


    <div id="jackSlip">

        <div class="paper">

            <button
                id="closeJack"
                type="button"
                aria-label="Close"
            >×</button>

            <p id="jackLine">
                <b>JACK:</b>
                You found me.
            </p>

            <form id="jackForm">

                <input
                    id="jackQ"
                    type="text"
                    maxlength="2000"
                    autocomplete="off"
                    placeholder="Say something…"
                >

                <button type="submit">
                    SEND
                </button>

            </form>

        </div>

    </div>


    <div id="instruction">
        DRAG · LOOK · MOVE · TOUCH JACK
    </div>

</div>


<script>
window.TTG_SQUARE = <?= json_encode(
    $config,
    JSON_UNESCAPED_SLASHES |
    JSON_UNESCAPED_UNICODE
) ?>;
</script>


<script>
(() => {
'use strict';

const CFG = window.TTG_SQUARE || {};
const IMAGES = Array.isArray(CFG.images) ? CFG.images : [];

/* =======================================================
   FALLBACK
======================================================= */

if (!IMAGES.length) {

    document.getElementById('squareFragments').innerHTML =
        '<div style="position:absolute;left:35%;top:42%;font-size:12px;letter-spacing:.18em;opacity:.5">/square/images/ is empty</div>';

}


/* =======================================================
   SEEDED-ish RANDOM
======================================================= */

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function choose(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


/* =======================================================
   CREATE SLASH

   One photograph may appear repeatedly at radically
   different crops.

   That is deliberate: one moment occupies several
   positions in the field.
======================================================= */

function slash({
    parent,
    image,
    left,
    top,
    width,
    height,
    z = 0,
    rotate = 0,
    alpha = .8,
    type = '',
    blend = 'normal',
    bx = 50,
    by = 50,
    memory = false
}) {

    const el = document.createElement('div');

    el.className =
        'slash ' +
        type +
        (memory ? ' memory' : '');

    el.style.left = left + '%';
    el.style.top = top + '%';

    el.style.width = width + '%';
    el.style.height = height + '%';

    el.style.setProperty(
        '--img',
        `url("${image}")`
    );

    el.style.setProperty(
        '--alpha',
        alpha
    );

    el.style.setProperty(
        '--blend',
        blend
    );

    el.style.setProperty(
        '--bx',
        bx + '%'
    );

    el.style.setProperty(
        '--by',
        by + '%'
    );


    const skew =
        rand(-5,5);

    el.dataset.baseTransform =
        `translateZ(${z}px) rotate(${rotate}deg) skewX(${skew}deg)`;

    el.style.transform =
        el.dataset.baseTransform;


    el.dataset.timePhase =
        rand(0, Math.PI * 2);

    el.dataset.timeSpeed =
        rand(.18,.8);

    el.dataset.depth =
        z;


    if (memory) {

        el.style.setProperty(
            '--memory-alpha',
            rand(.16,.52)
        );
    }


    parent.appendChild(el);

    return el;
}


/* =======================================================
   DESTINATIONS
======================================================= */

const far =
    document.getElementById('farFragments');

const horizon =
    document.getElementById('horizonFragments');

const square =
    document.getElementById('squareFragments');

const ground =
    document.getElementById('groundFragments');

const near =
    document.getElementById('nearFragments');


const allFragments = [];


/* =======================================================
   GENERATE FIELD FROM ALL IMAGES
======================================================= */

IMAGES.forEach((image, index) => {

    /* -----------------------------------------------
       ENVIRONS / DISTANT ARCHITECTURE
    ----------------------------------------------- */

    for (let i = 0; i < 3; i++) {

        allFragments.push(
            slash({
                parent: far,
                image,

                left: rand(-10,85),
                top: rand(4,69),

                width: rand(22,48),
                height: rand(18,44),

                z: rand(-80,30),

                rotate: rand(-7,7),

                alpha: rand(.18,.42),

                type: choose([
                    'cut',
                    'shard',
                    'ribbon'
                ]),

                bx: rand(8,92),
                by: rand(10,90),

                memory:true
            })
        );
    }


    /* -----------------------------------------------
       HORIZON / BUILDING FRONTAGES / SKY
    ----------------------------------------------- */

    for (let i = 0; i < 4; i++) {

        allFragments.push(
            slash({
                parent:horizon,
                image,

                left:rand(-8,91),
                top:rand(-4,67),

                width:rand(18,39),
                height:rand(24,67),

                z:rand(-15,55),

                rotate:rand(-4,4),

                alpha:rand(.46,.92),

                type:choose([
                    'cut',
                    'ribbon',
                    'shard'
                ]),

                bx:rand(4,96),
                by:rand(4,84)
            })
        );

    }


    /* -----------------------------------------------
       GROUND / PAVING / CHESSBOARD / FEET / RUBBISH
    ----------------------------------------------- */

    for (let i = 0; i < 3; i++) {

        allFragments.push(
            slash({
                parent:ground,
                image,

                left:rand(-6,92),
                top:rand(-4,90),

                width:rand(19,50),
                height:rand(22,52),

                z:rand(-10,30),

                rotate:rand(-10,10),

                alpha:rand(.32,.72),

                type:choose([
                    'cut',
                    'shard'
                ]),

                bx:rand(5,95),
                by:rand(30,100),

                memory:
                    Math.random() > .5
            })
        );

    }


    /* -----------------------------------------------
       SQUARE PROPER
    ----------------------------------------------- */

    for (let i = 0; i < 2; i++) {

        allFragments.push(
            slash({
                parent:square,
                image,

                left:rand(3,87),
                top:rand(15,78),

                width:rand(10,27),
                height:rand(16,38),

                z:rand(30,130),

                rotate:rand(-13,13),

                alpha:rand(.3,.72),

                type:choose([
                    'cut',
                    'shard'
                ]),

                bx:rand(4,96),
                by:rand(4,96),

                memory:
                    Math.random() > .35
            })
        );
    }


    /* -----------------------------------------------
       NEAR BODIES / OBJECTS

       Narrow and partial intentionally.
    ----------------------------------------------- */

    if (index % 2 === 0) {

        allFragments.push(
            slash({
                parent:near,
                image,

                left:rand(5,86),
                top:rand(26,74),

                width:rand(8,20),
                height:rand(25,60),

                z:rand(70,210),

                rotate:rand(-14,14),

                alpha:rand(.24,.62),

                type:choose([
                    'cut',
                    'shard'
                ]),

                bx:rand(5,95),
                by:rand(10,95),

                memory:true
            })
        );
    }

});


/* =======================================================
   4D FIELD

   x/y : drag position
   z   : CSS perspective/depth
   t   : accumulated traversal

   There is deliberately no time control.
======================================================= */

const root =
    document.documentElement;

let yaw = 0;
let pitch = 0;

let targetYaw = 0;
let targetPitch = 0;

let depth = 0;
let targetDepth = 0;

let time = 0;

let dragging = false;

let lastX = 0;
let lastY = 0;

let totalMovement = 0;

let entered = false;


const title =
    document.getElementById('title');

const instruction =
    document.getElementById('instruction');


function enter() {

    if (entered) return;

    entered = true;

    title.classList.add('leave');
    instruction.classList.add('leave');

    setTimeout(() => {
        title.style.display = 'none';
    }, 1500);
}


/* =======================================================
   POINTER
======================================================= */

window.addEventListener(
    'pointerdown',
    event => {

        dragging = true;

        lastX = event.clientX;
        lastY = event.clientY;

        enter();

    },
    { passive:true }
);


window.addEventListener(
    'pointermove',
    event => {

        if (!dragging) return;

        const dx =
            event.clientX - lastX;

        const dy =
            event.clientY - lastY;

        lastX = event.clientX;
        lastY = event.clientY;


        targetYaw += dx * .035;
        targetPitch -= dy * .023;


        targetYaw =
            Math.max(-14, Math.min(14, targetYaw));

        targetPitch =
            Math.max(-7, Math.min(7, targetPitch));


        const movement =
            Math.abs(dx) + Math.abs(dy);

        totalMovement += movement;

        time += movement * .00075;

    },
    { passive:true }
);


window.addEventListener(
    'pointerup',
    () => {
        dragging = false;
    },
    { passive:true }
);


window.addEventListener(
    'pointercancel',
    () => {
        dragging = false;
    },
    { passive:true }
);


/* =======================================================
   WHEEL
======================================================= */

window.addEventListener(
    'wheel',
    event => {

        enter();

        targetDepth += event.deltaY * -.25;

        targetDepth =
            Math.max(
                -180,
                Math.min(
                    230,
                    targetDepth
                )
            );

        time +=
            Math.abs(event.deltaY) * .0009;

    },
    { passive:true }
);


/* =======================================================
   DEVICE ORIENTATION — VERY SMALL

   Makes phone movement perceptible without becoming a
   gyroscope demo.
======================================================= */

window.addEventListener(
    'deviceorientation',
    event => {

        if (dragging) return;

        if (
            typeof event.gamma !== 'number' ||
            typeof event.beta !== 'number'
        ) return;


        const gx =
            Math.max(
                -20,
                Math.min(
                    20,
                    event.gamma
                )
            );

        const gy =
            Math.max(
                20,
                Math.min(
                    70,
                    event.beta
                )
            );


        targetYaw +=
            (gx * .08 - targetYaw)
            * .015;


        targetPitch +=
            (((gy - 45) * -.05) - targetPitch)
            * .015;

    }
);


/* =======================================================
   TEMPORAL COLLAGE

   At different values of t, bits of different photos
   become materially stronger or weaker.

   Same coordinates, multiple observed moments.
======================================================= */

function updateFragments() {

    allFragments.forEach(
        (fragment, index) => {

            const phase =
                Number(
                    fragment.dataset.timePhase
                );

            const speed =
                Number(
                    fragment.dataset.timeSpeed
                );


            const wave =
                (
                    Math.sin(
                        time * speed * 3 +
                        phase
                    ) + 1
                ) / 2;


            const displacement =
                Math.sin(
                    time * speed +
                    phase
                ) * 8;


            const base =
                fragment.dataset.baseTransform;


            fragment.style.transform =
                `${base} translate3d(${displacement}px,${displacement * -.22}px,0)`;


            if (
                fragment.classList.contains(
                    'memory'
                )
            ) {

                if (wave > .58) {

                    fragment.classList.add(
                        'alive'
                    );

                } else {

                    fragment.classList.remove(
                        'alive'
                    );
                }

            }


            fragment.style.filter =
                `contrast(${1.02 + wave * .18})
                 saturate(${.72 + wave * .46})
                 brightness(${.88 + wave * .16})`;

        }
    );
}


/* =======================================================
   JACK
======================================================= */

const jack =
    document.getElementById('jack');

const slip =
    document.getElementById('jackSlip');

const closeJack =
    document.getElementById('closeJack');

const jackForm =
    document.getElementById('jackForm');

const jackQ =
    document.getElementById('jackQ');

const jackLine =
    document.getElementById('jackLine');


function openJack() {

    enter();

    slip.classList.add('open');

    setTimeout(() => {
        jackQ.focus({
            preventScroll:true
        });
    },100);
}


jack.addEventListener(
    'click',
    event => {

        event.stopPropagation();

        openJack();

    }
);


jack.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Enter' ||
            event.key === ' '
        ) {
            openJack();
        }

    }
);


closeJack.addEventListener(
    'click',
    () => {
        slip.classList.remove('open');
    }
);


jackForm.addEventListener(
    'submit',
    async event => {

        event.preventDefault();

        const q =
            jackQ.value.trim();

        if (!q) return;


        jackQ.disabled = true;

        jackLine.innerHTML =
            '<b>JACK:</b> …';


        try {

            const data =
                new FormData();

            data.append(
                'csrf',
                CFG.csrf || ''
            );

            data.append(
                'site',
                'square'
            );

            data.append(
                'q',
                q
            );


            const response =
                await fetch(
                    CFG.jack || '/now/jack',
                    {
                        method:'POST',
                        credentials:'same-origin',
                        body:data,
                        headers:{
                            'X-Requested-With':'fetch'
                        }
                    }
                );


            const type =
                response.headers.get(
                    'content-type'
                ) || '';


            let answer =
                'Filed.';


            if (
                type.includes(
                    'application/json'
                )
            ) {

                const json =
                    await response.json();

                answer =
                    json.reply ||
                    json.answer ||
                    json.message ||
                    json.text ||
                    answer;

            } else {

                const text =
                    await response.text();

                if (text.trim()) {
                    answer = text.trim();
                }

            }


            jackLine.innerHTML =
                '<b>JACK:</b> ' +
                escapeHTML(answer);


            jackQ.value = '';

        } catch (error) {

            console.error(error);

            jackLine.innerHTML =
                '<b>JACK:</b> Line interrupted.';

        } finally {

            jackQ.disabled = false;

            jackQ.focus({
                preventScroll:true
            });

        }

    }
);


function escapeHTML(value) {

    return String(value)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'",'&#039;');
}


/* =======================================================
   RENDER LOOP
======================================================= */

function animate() {

    requestAnimationFrame(
        animate
    );


    yaw +=
        (targetYaw - yaw) * .07;

    pitch +=
        (targetPitch - pitch) * .07;

    depth +=
        (targetDepth - depth) * .07;


    /* tiny autonomous temporal drift */

    time += .0015;


    root.style.setProperty(
        '--ry',
        yaw + 'deg'
    );

    root.style.setProperty(
        '--rx',
        pitch + 'deg'
    );

    root.style.setProperty(
        '--tz',
        depth + 'px'
    );


    updateFragments();

}


animate();

})();
</script>

<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>