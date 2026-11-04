#!/usr/bin/env python3
"""Typographic 1200×630 OG cards and punch-card favicon fallbacks."""

from __future__ import annotations

import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OG = ASSETS / "og"

W, H = 1200, 630

FONTS = {
    "cond": "/System/Library/Fonts/Avenir Next Condensed.ttc",
    "serif": "/System/Library/Fonts/NewYork.ttf",
    "georgia": "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "georgia_b": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "courier": "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "courier_b": "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
    "typewriter": "/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc",
    "helvetica": "/System/Library/Fonts/Helvetica.ttc",
    "narrow": "/System/Library/Fonts/Supplemental/Arial Narrow.ttf",
    "narrow_b": "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
}

HOLLERITH = {}
for i, ch in enumerate("ABCDEFGHI"):
    HOLLERITH[ch] = [12, i + 1]
for i, ch in enumerate("JKLMNOPQR"):
    HOLLERITH[ch] = [11, i + 1]
for ch, n in zip("STUVWXYZ", [2, 3, 4, 5, 6, 7, 8, 9]):
    HOLLERITH[ch] = [0, n]
for d in range(10):
    HOLLERITH[str(d)] = [d]
HOLLERITH[" "] = []
ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]


def font(name: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    path = FONTS[name]
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.load_default()


def hex_rgb(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def new_card(bg: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGB", (W, H), hex_rgb(bg))
    return im, ImageDraw.Draw(im)


def grain(im: Image.Image, amount: int = 18, seed: int = 5081) -> None:
    rng = random.Random(seed)
    px = im.load()
    w, h = im.size
    for _ in range(w * h // 14):
        x = rng.randrange(w)
        y = rng.randrange(h)
        r, g, b = px[x, y]
        d = rng.randint(-amount, amount)
        px[x, y] = (
            max(0, min(255, r + d)),
            max(0, min(255, g + d)),
            max(0, min(255, b + d)),
        )


def rules_paper(draw: ImageDraw.ImageDraw, ink: str, gap: int = 28, alpha: int = 22) -> None:
    r, g, b = hex_rgb(ink)
    for x in range(48, W - 36, gap):
        draw.line([(x, 36), (x, H - 36)], fill=(r, g, b, alpha) if False else (r, g, b), width=1)


def punch_card(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str = "TTG",
    cream: str = "#f1e4c4",
    navy: str = "#1e3a5f",
    scarlet: str = "#c41e3a",
    ink: str = "#1a2438",
    cols: int = 24,
) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle([x0, y0, x1, y1], fill=hex_rgb(cream), outline=hex_rgb(navy), width=2)
    cut = min(28, (x1 - x0) // 8)
    draw.polygon([(x0, y0), (x0 + cut, y0), (x0, y0 + cut)], fill=hex_rgb(navy) if False else hex_rgb(cream))
    # recut against a navy-looking void by filling the triangle with a slightly darker cream then overlaying
    # Actual corner cut: paint the triangle the same as the surrounding later; here we cut by filling cream then
    # drawing a dark triangle to suggest the missing corner on dark grounds.
    stripe = max(8, (x1 - x0) // 28)
    draw.rectangle([x0, y0 + cut, x0 + stripe, y1], fill=hex_rgb(scarlet))
    # ticks
    inner_l = x0 + stripe + 10
    inner_r = x1 - 8
    inner_t = y0 + 16
    inner_b = y1 - 14
    n = max(8, cols)
    cw = (inner_r - inner_l) / n
    rh = (inner_b - inner_t) / len(ROWS)
    for i in range(n):
        tx = inner_l + i * cw + cw / 2
        hgt = 7 if i % 5 == 0 else 4
        draw.line([(tx, y0 + 4), (tx, y0 + 4 + hgt)], fill=hex_rgb(navy), width=1)
    punches = [HOLLERITH.get(ch, []) for ch in text.upper() if ch in HOLLERITH]
    for ci, holes in enumerate(punches):
        if ci >= n:
            break
        cx = inner_l + ci * cw + cw / 2
        for hole in holes:
            ri = ROWS.index(hole)
            cy = inner_t + ri * rh + rh / 2
            rx, ry = max(2.2, cw * 0.28), max(1.8, rh * 0.28)
            draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=hex_rgb(ink))
    draw.text((x1 - 10, y1 - 16), "5081", font=font("courier", 12), fill=hex_rgb(navy), anchor="rt")


def wordmark(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], color: str, size: int = 22) -> None:
    draw.text(xy, text, font=font("cond", size, 1), fill=hex_rgb(color))


def fit_title(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], color: str, max_w: int, start: int = 118) -> None:
    size = start
    while size > 36:
        f = font("serif", size)
        bbox = draw.textbbox(xy, text, font=f)
        if bbox[2] - bbox[0] <= max_w:
            draw.text(xy, text, font=f, fill=hex_rgb(color))
            return
        size -= 4
    draw.text(xy, text, font=font("serif", 36), fill=hex_rgb(color))


def footer(draw: ImageDraw.ImageDraw, text: str, color: str, y: int = 560) -> None:
    draw.text((72, y), text, font=font("courier", 18), fill=hex_rgb(color))


def save(im: Image.Image, slug: str) -> None:
    grain(im, 12, seed=sum(ord(c) for c in slug) + 5081)
    path = OG / f"{slug}.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(ROOT))


def card_now() -> None:
    im, d = new_card("#f1e4c4")
    for x in range(56, 1140, 24):
        d.line([(x, 40), (x, 590)], fill=hex_rgb("#c9b48a"), width=1)
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 58), "#c41e3a", 26)
    d.text((72, 118), "LOCAL PRESENT  ·  NETWORK 17.04.2033", font=font("cond", 22, 1), fill=hex_rgb("#1e3a5f"))
    fit_title(d, "NOW", (72, 200), "#1a2438", 700, 168)
    d.text((72, 390), "THE TREE", font=font("cond", 54, 1), fill=hex_rgb("#c41e3a"))
    punch_card(d, (820, 150, 1130, 420), "NOW", cols=16)
    footer(d, "A BOUNDED FIELD.  NOT A FEED.", "#1e3a5f")
    save(im, "now")


def card_jack() -> None:
    im, d = new_card("#111214")
    d.rectangle([0, 0, 18, H], fill=hex_rgb("#c41e3a"))
    wordmark(d, "TIMETRAVELLERSGUILD.COM  ·  JACK", (72, 58), "#c9a961", 22)
    fit_title(d, "JACK", (72, 170), "#f1e4c4", 620, 160)
    d.text((72, 360), "THE DESK  ·  THE HOPPER", font=font("cond", 40, 1), fill=hex_rgb("#c41e3a"))
    punch_card(d, (780, 140, 1136, 430), "JACK", cream="#d9cb9e", navy="#c9a961", cols=14)
    footer(d, "IBM 5081  ·  CLERK ON DUTY  ·  NOT A CHATBOT", "#8a8070")
    save(im, "jack")


def card_tarot() -> None:
    im, d = new_card("#d9cb9e")
    wordmark(d, "JACK  ·  CLERK  ·  PUNCHCARD TAROT", (72, 58), "#1e3a5f", 22)
    fit_title(d, "PUNCHCARD", (72, 150), "#161814", 900, 96)
    fit_title(d, "TAROT", (72, 270), "#c41e3a", 900, 120)
    d.text((72, 420), "HOLD A QUESTION.  PUNCH THE HOPPER.", font=font("courier", 22), fill=hex_rgb("#1e3a5f"))
    punch_card(d, (820, 130, 1136, 400), "TAROT", cream="#f1e4c4", cols=14)
    footer(d, "78 SLIPS  ·  WORKING STOCK  ·  NOT CANON", "#7b8070")
    save(im, "tarot")


def card_feed() -> None:
    im, d = new_card("#080808")
    d.rectangle([0, 0, W, 8], fill=hex_rgb("#a9ff9c"))
    wordmark(d, "TIMETRAVELLERSGUILD.COM  ·  INSTRUMENT Nº15", (72, 58), "#7fbf72", 20)
    fit_title(d, "FEED∞", (72, 180), "#a9ff9c", 900, 150)
    d.text((72, 370), "OBSERVATION ALTERS NAVIGATION.", font=font("courier", 26), fill=hex_rgb("#c6ff8c"))
    footer(d, "MEDIA  +  MACHINE  +  ENCOUNTER  →  FIELD STATE", "#777b73")
    save(im, "feed")


def card_department() -> None:
    im, d = new_card("#ffffff")
    d.rectangle([0, 0, W, 72], fill=hex_rgb("#111111"))
    d.rectangle([0, 72, W, 86], fill=hex_rgb("#c8102e"))
    d.text((72, 24), "WELSH GOVERNMENT", font=font("helvetica", 22), fill=hex_rgb("#ffffff"))
    d.text((720, 28), "LLYWODRAETH CYMRU", font=font("helvetica", 18), fill=(255, 255, 255))
    d.text((72, 130), "Department of Excess Time", font=font("helvetica", 54), fill=hex_rgb("#111111"))
    d.rectangle([72, 210, 220, 216], fill=hex_rgb("#c8102e"))
    d.text((72, 250), "Adran Amser Dros Ben", font=font("helvetica", 32), fill=hex_rgb("#4a4a4a"))
    d.text((72, 340), "Established 1951.  Serving Wales and the United Kingdom.", font=font("helvetica", 24), fill=hex_rgb("#4a4a4a"))
    d.text((72, 420), "The Department administers consequences. It does not create causes.", font=font("georgia", 26), fill=hex_rgb("#1a1a1a"))
    footer(d, "GOV.WALES REGISTER  ·  BILINGUAL PUBLIC SERVICE", "#4a4a4a", 540)
    save(im, "department")


def card_join() -> None:
    im, d = new_card("#d9cb9e")
    for x in range(40, 1160, 32):
        d.ellipse([x, 28, x + 8, 36], fill=hex_rgb("#1e3a5f"))
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 70), "#b2533e", 22)
    d.text((72, 120), "ONE EMAIL  ·  NO PASSWORD  ·  FREE", font=font("cond", 24, 1), fill=hex_rgb("#1e3a5f"))
    fit_title(d, "JOIN", (72, 170), "#161814", 700, 150)
    d.text((72, 360), "CHAT  ·  MAP  ·  PASSPORT", font=font("cond", 52, 1), fill=hex_rgb("#c41e3a"))
    punch_card(d, (780, 150, 1136, 430), "JOIN", cream="#f1e4c4", cols=14)
    footer(d, "TALK TO TRAVELLERS.  WALK THE VALLEY.  STAMP YOUR PASSPORT.", "#1e3a5f")
    save(im, "join")


def card_signals() -> None:
    im, d = new_card("#f2d322")
    d.rectangle([0, 0, W, H], outline=hex_rgb("#161814"), width=16)
    wordmark(d, "IBM 5081  ·  TITLE CARD", (72, 58), "#161814", 22)
    fit_title(d, "SIGNALS", (72, 180), "#161814", 900, 140)
    d.text((72, 370), "A PUNCHCARD PLANE OF THE PUBLIC RECORD", font=font("courier_b", 24), fill=hex_rgb("#161814"))
    punch_card(d, (820, 140, 1130, 400), "SIGNALS", cream="#f7e27a", navy="#161814", scarlet="#c41e3a", cols=16)
    footer(d, "NOT CANON  ·  TAP TO ENTER THE PLANE", "#161814")
    save(im, "signals")


def card_watch() -> None:
    im, d = new_card("#0a0e18")
    d.ellipse([820, 80, 1180, 440], outline=hex_rgb("#c1994e"), width=2)
    d.ellipse([880, 140, 1120, 380], outline=hex_rgb("#5a4420"), width=1)
    wordmark(d, "INSTRUMENT Nº14", (72, 58), "#c1994e", 22)
    fit_title(d, "THE WATCH", (72, 180), "#e8dfc4", 720, 120)
    d.text((72, 360), "ORBITAL VIEWER FOR GLASS PLATES", font=font("cond", 32, 1), fill=hex_rgb("#c1994e"))
    footer(d, "BRASS OPTICS  ·  ECCENTRICITY  ·  HALATION", "#9b988f")
    save(im, "watch")


def card_hub() -> None:
    im, d = new_card("#07090c")
    cx, cy = 980, 300
    for r, col in ((220, "#b5965a"), (160, "#9cb7bd"), (90, "#8c4f43")):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=hex_rgb(col), width=2)
    wordmark(d, "STATION XIII  ·  2033", (72, 58), "#b5965a", 22)
    fit_title(d, "HUB", (72, 180), "#e8e0cf", 620, 160)
    d.text((72, 370), "ELEVEN STATIONS IN FREE ORBIT", font=font("cond", 32, 1), fill=hex_rgb("#b5965a"))
    footer(d, "THE PUBLIC INTERFACE  ·  DRAG  ·  PINCH  ·  TAP", "#9b988f")
    save(im, "hub")


def card_station13() -> None:
    im, d = new_card("#070706")
    wordmark(d, "TTG-13", (72, 58), "#c9a961", 26)
    fit_title(d, "Station 13", (72, 180), "#f4eede", 900, 120)
    d.text((72, 360), "The instrument does not announce itself.", font=font("georgia", 32), fill=hex_rgb("#948d80"))
    footer(d, "51.46 °N   3.19 °W   ·   THE FFILM IS BEGUN", "#7d6838")
    save(im, "station13")


def card_square() -> None:
    im, d = new_card("#1a0a28")
    wordmark(d, "TIMETRAVELLERSGUILD.COM  /  SQUARE", (72, 58), "#e4c583", 22)
    fit_title(d, "GILLETT", (72, 160), "#f4eede", 900, 110)
    fit_title(d, "SQUARE", (72, 290), "#c9a961", 900, 110)
    d.text((72, 430), "OFFICIAL PLAYGROUND OF THE GUILD", font=font("cond", 28, 1), fill=hex_rgb("#c9a961"))
    footer(d, "JACK HAS BROUGHT HIS CUBE OUTDOORS", "#9b988f")
    save(im, "square")


def card_triangla() -> None:
    im, d = new_card("#0F1620")
    d.polygon([(980, 120), (1140, 420), (820, 420)], outline=hex_rgb("#D69A4E"), width=3)
    wordmark(d, "FINGER DRUM  ·  THREE SIDES", (72, 58), "#D69A4E", 22)
    fit_title(d, "TRIANGLA", (72, 180), "#EFE7D6", 750, 120)
    d.text((72, 360), "The finger drum with three sides.", font=font("georgia", 30), fill=hex_rgb("#7C8894"))
    footer(d, "BLUEPRINT  ·  PLAN  ·  3D", "#D69A4E")
    save(im, "triangla")


def card_cardiff() -> None:
    im, d = new_card("#e9e3d3")
    d.rectangle([48, 40, 1152, 590], outline=hex_rgb("#c2b89e"), width=2)
    wordmark(d, "GUILD ARCHIVE  ·  INSTRUMENT Nº13", (72, 70), "#4a5f7a", 22)
    fit_title(d, "CARDIFF", (72, 170), "#211d16", 800, 130)
    d.text((72, 340), "On the founding at Cardiff.", font=font("georgia", 34), fill=hex_rgb("#8c3f28"))
    footer(d, "A CROSS-TEMPORAL NOTE  ·  NOT A MINUTE", "#4a4235")
    save(im, "cardiff")


def card_cube() -> None:
    im, d = new_card("#d9cb9e")
    # wireframe cube
    ox, oy = 900, 180
    s = 110
    d.polygon([(ox, oy + 30), (ox + s, oy), (ox + s, oy + s), (ox, oy + s + 30)], outline=hex_rgb("#1e3a5f"), width=2)
    d.polygon([(ox + 50, oy - 20), (ox + s + 50, oy - 50), (ox + s + 50, oy + s - 50), (ox + 50, oy + s - 20)], outline=hex_rgb("#c41e3a"), width=2)
    for a, b in [((ox, oy + 30), (ox + 50, oy - 20)), ((ox + s, oy), (ox + s + 50, oy - 50)), ((ox + s, oy + s), (ox + s + 50, oy + s - 50)), ((ox, oy + s + 30), (ox + 50, oy + s - 20))]:
        d.line([a, b], fill=hex_rgb("#1e3a5f"), width=2)
    wordmark(d, "TIMETRAVELLERSGUILD.COM  ·  CUBE", (72, 58), "#b2533e", 22)
    fit_title(d, "CUBE", (72, 180), "#161814", 700, 150)
    d.text((72, 370), "SLIGHTLY BROKEN GEOMETRY", font=font("cond", 34, 1), fill=hex_rgb("#1e3a5f"))
    footer(d, "RESTORE THE CUBE, ONE LESSON AT A TIME", "#7b8070")
    save(im, "cube")


def card_people() -> None:
    im, d = new_card("#d9cb9e")
    d.polygon([(72, 140), (86, 140), (72, 154)], fill=hex_rgb("#1e3a5f"))
    d.rectangle([72, 140, 560, 500], outline=hex_rgb("#1e3a5f"), width=3)
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (92, 170), "#b2533e", 18)
    fit_title(d, "PEOPLE", (92, 230), "#161814", 430, 90)
    d.text((92, 360), "CAST REGISTER", font=font("courier", 24), fill=hex_rgb("#1e3a5f"))
    d.text((92, 400), "PUBLIC LAYER  ·  NOT CANON", font=font("courier", 18), fill=hex_rgb("#7b8070"))
    punch_card(d, (700, 150, 1136, 430), "PEOPLE", cream="#f1e4c4", cols=16)
    footer(d, "PUNCH STOCK  ·  YOUR SLIP", "#1e3a5f")
    save(im, "people")


def card_intro() -> None:
    im, d = new_card("#d9cb9e")
    punch_card(d, (80, 80, 1120, 280), "TTG", cream="#f1e4c4", cols=36)
    wordmark(d, "IBM 5081  ·  CLICK TO ENTER", (72, 310), "#1e3a5f", 22)
    fit_title(d, "THE TIME", (72, 350), "#161814", 1000, 72)
    fit_title(d, "TRAVELLERS GUILD", (72, 430), "#c41e3a", 1050, 68)
    footer(d, "YOU ALREADY TRAVEL THROUGH TIME.  YOU FORGOT HOW.", "#1e3a5f", 560)
    save(im, "intro")


def card_field() -> None:
    im, d = new_card("#d9cb9e")
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 58), "#b2533e", 22)
    d.text((72, 120), "5 PROJECTIONS  ·  NOT CANON", font=font("cond", 24, 1), fill=hex_rgb("#1e3a5f"))
    fit_title(d, "THE FIELD", (72, 190), "#161814", 900, 120)
    d.text((72, 370), "TELL JACK YOUR STORY.  HE LODGES.", font=font("courier", 24), fill=hex_rgb("#1e3a5f"))
    footer(d, "TEMPORAL  SOCIAL  SPATIAL  INSTITUTIONAL  SYMBOLIC", "#7b8070")
    save(im, "field")


def card_navigator() -> None:
    im, d = new_card("#d9cb9e")
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 58), "#b2533e", 22)
    fit_title(d, "NAVIGATOR", (72, 180), "#161814", 1000, 110)
    d.text((72, 350), "WALK THE TIMETREE", font=font("cond", 36, 1), fill=hex_rgb("#1e3a5f"))
    footer(d, "PENDING SLIPS ARE NOT CANON.  A KEEPER WRITES CANON.", "#7b8070")
    save(im, "navigator")


def card_arianrhod() -> None:
    im, d = new_card("#8a9080")
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 58), "#2a2e28", 22)
    fit_title(d, "ARIANRHOD", (72, 180), "#161814", 1000, 110)
    d.text((72, 350), "JACK OVERHEATED  ·  THE WAREHOUSE IS GONE", font=font("cond", 28, 1), fill=hex_rgb("#2a2e28"))
    footer(d, "NOT CANON  ·  POST HERSELF TO THE CUBE", "#2a2e28")
    save(im, "arianrhod")


def card_archive() -> None:
    im, d = new_card("#0e0d0b")
    wordmark(d, "TIMETRAVELLERSGUILD.COM", (72, 58), "#c9a961", 22)
    fit_title(d, "ARCHIVE", (72, 180), "#f4eede", 900, 130)
    d.text((72, 360), "ROOMS ATTACHED TO A STABLE CHRONOLOGY", font=font("cond", 28, 1), fill=hex_rgb("#c9a961"))
    footer(d, "FILM  ·  MISSIONS  ·  RESEARCH  ·  ELSEWHEN", "#948d80")
    save(im, "archive")


def card_door() -> None:
    im, d = new_card("#070706")
    d.rectangle([880, 120, 1080, 420], outline=hex_rgb("#c9a961"), width=3)
    d.ellipse([1048, 250, 1068, 270], fill=hex_rgb("#e4c583"))
    wordmark(d, "STATION XIII", (72, 58), "#c9a961", 26)
    fit_title(d, "THE DOOR", (72, 180), "#f4eede", 750, 120)
    d.text((72, 360), "The Ffilm is begun. Find your way through.", font=font("georgia", 28), fill=hex_rgb("#948d80"))
    footer(d, "KNOCK  ·  THREE TIMES", "#7d6838")
    save(im, "door")


def card_puzzle() -> None:
    im, d = new_card("#f3e6c4")
    wordmark(d, "JACK / CLERK / HOLLERITH DESK / 1951", (72, 58), "#1e3a5f", 20)
    fit_title(d, "The polite", (72, 150), "#1a2438", 900, 90)
    fit_title(d, "phish", (72, 260), "#c41e3a", 900, 110)
    punch_card(d, (780, 140, 1136, 400), "JACK 1951", cols=18)
    footer(d, "J-1951-PHI  ·  80 COL  ·  HUMAN EYES REQUIRED", "#1e3a5f")
    save(im, "puzzle")


def card_map() -> None:
    im, d = new_card("#f1e4c4")
    wordmark(d, "TIMETRAVELLERSGUILD.COM  ·  JACK", (72, 58), "#c41e3a", 22)
    fit_title(d, "MAP", (72, 180), "#1a2438", 700, 160)
    d.text((72, 370), "HIS BODY AS A POSTAL MAP", font=font("cond", 34, 1), fill=hex_rgb("#1e3a5f"))
    footer(d, "HUMANS FILE.  THE ROBOT SHUFFLES.", "#1e3a5f")
    save(im, "map")


def make_favicon() -> None:
    """Cream IBM 5081 on navy, TTG punched, for ico / apple-touch."""
    sizes = {
        ASSETS / "favicon-32.png": 32,
        ASSETS / "apple-touch-icon.png": 180,
    }
    frames = []
    for dim in (16, 32, 48):
        im = Image.new("RGB", (dim, dim), hex_rgb("#1e3a5f"))
        d = ImageDraw.Draw(im)
        scale = dim / 64
        # card
        cream = hex_rgb("#f1e4c4")
        scarlet = hex_rgb("#c41e3a")
        ink = hex_rgb("#1a2438")
        navy = hex_rgb("#1e3a5f")
        x0, y0, x1, y1 = int(10 * scale), int(16 * scale), int(54 * scale), int(48 * scale)
        d.rectangle([x0, y0, x1, y1], fill=cream)
        cut = max(2, int(8 * scale))
        d.polygon([(x0, y0), (x0 + cut, y0), (x0, y0 + cut)], fill=navy)
        d.rectangle([x0, y0 + cut, x0 + max(2, int(4 * scale)), y1], fill=scarlet)
        # holes for TTG
        holes = [
            (28, 28.4), (28, 38),
            (36, 28.4), (36, 38),
            (44, 22), (44, 44.4),
        ]
        rx = max(1, int(1.6 * scale))
        ry = max(1, int(1.2 * scale))
        for hx, hy in holes:
            cx, cy = int(hx * scale), int(hy * scale)
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=ink)
        frames.append(im)
        if dim == 32:
            im.save(ASSETS / "favicon-32.png", "PNG")
    # 180 apple
    big = Image.new("RGB", (180, 180), hex_rgb("#1e3a5f"))
    d = ImageDraw.Draw(big)
    d.rectangle([22, 42, 158, 138], fill=hex_rgb("#f1e4c4"))
    d.polygon([(22, 42), (48, 42), (22, 68)], fill=hex_rgb("#1e3a5f"))
    d.rectangle([22, 68, 34, 138], fill=hex_rgb("#c41e3a"))
    for i, x in enumerate(range(48, 150, 12)):
        hgt = 10 if i % 5 == 0 else 6
        d.line([(x, 46), (x, 46 + hgt)], fill=hex_rgb("#1e3a5f"), width=2)
    punches = [HOLLERITH.get(ch, []) for ch in "TTG"]
    inner_l, inner_t, cw, rh = 52, 70, 28, 5.2
    for ci, holes in enumerate(punches):
        cx = inner_l + ci * cw
        for hole in holes:
            ri = ROWS.index(hole)
            cy = inner_t + ri * rh
            d.ellipse([cx - 4, cy - 3, cx + 4, cy + 3], fill=hex_rgb("#1a2438"))
    d.text((148, 128), "5081", font=font("courier", 12), fill=hex_rgb("#1e3a5f"), anchor="rt")
    big.save(ASSETS / "apple-touch-icon.png", "PNG", optimize=True)
    ico = ASSETS / "favicon.ico"
    from io import BytesIO
    import struct

    def png_bytes(img: Image.Image) -> bytes:
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    sized = [big.resize((n, n), Image.Resampling.LANCZOS) for n in (16, 32, 48)]
    pngs = [png_bytes(img) for img in sized]
    offset = 6 + 16 * len(pngs)
    entries = []
    blob = b""
    for img, png in zip(sized, pngs):
        w, h = img.size
        entries.append(struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(png), offset))
        offset += len(png)
        blob += png
    ico.write_bytes(struct.pack("<HHH", 0, 1, len(pngs)) + b"".join(entries) + blob)
    sized[1].save(ASSETS / "favicon-32.png", "PNG")
    print("wrote favicon.ico, favicon-32.png, apple-touch-icon.png")


def main() -> None:
    OG.mkdir(parents=True, exist_ok=True)
    makers = [
        card_now, card_jack, card_tarot, card_feed, card_department,
        card_join, card_signals, card_watch, card_hub, card_station13,
        card_square, card_triangla, card_cardiff, card_cube, card_people,
        card_intro, card_field, card_navigator, card_arianrhod, card_archive,
        card_door, card_puzzle, card_map,
    ]
    for fn in makers:
        fn()
    make_favicon()
    print(f"{len(makers)} OG cards")


if __name__ == "__main__":
    main()
