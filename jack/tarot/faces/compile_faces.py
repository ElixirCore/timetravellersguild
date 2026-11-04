#!/usr/bin/env python3
"""Rasterize JACK_TAROT_FULL_DECK_v1.pdf into web faces and glyph stamps."""
import json
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple

import fitz
from PIL import Image

PDF = Path("/Users/toby/Desktop/Screenshots/JACK_TAROT_FULL_DECK_v1.pdf")
OUT = Path(__file__).resolve().parent
STAMPS = OUT / "stamps"

MAJORS = [
    ("00", "The Fool", "UNINITIALISED ADDRESS", "JACK.MAJOR.00.G0"),
    ("01", "The Magician", "OPERATOR", "JACK.MAJOR.01.G0"),
    ("02", "The High Priestess", "SEALED REGISTER", "JACK.MAJOR.02.G0"),
    ("03", "The Empress", "GENERATIVE FIELD", "JACK.MAJOR.03.G0"),
    ("04", "The Emperor", "CONTROL STRUCTURE", "JACK.MAJOR.04.G0"),
    ("05", "The Hierophant", "PROTOCOL", "JACK.MAJOR.05.G0"),
    ("06", "The Lovers", "BIND / FORK", "JACK.MAJOR.06.G0"),
    ("07", "The Chariot", "DIRECTED TRANSFER", "JACK.MAJOR.07.G0"),
    ("08", "Strength", "FEEDBACK CONTROL", "JACK.MAJOR.08.G0"),
    ("09", "The Hermit", "ISOLATED PROCESS", "JACK.MAJOR.09.G0"),
    ("10", "Wheel of Fortune", "SHUFFLE / CLOCK", "JACK.MAJOR.10.G0"),
    ("11", "Justice", "COMPARATOR", "JACK.MAJOR.11.G0"),
    ("12", "The Hanged Man", "INVERTED REFERENCE", "JACK.MAJOR.12.G0"),
    ("13", "Death", "TERMINATE / REALLOCATE", "JACK.MAJOR.13.G0"),
    ("14", "Temperance", "MIXER / CONVERTER", "JACK.MAJOR.14.G0"),
    ("15", "The Devil", "RECURSIVE BIND", "JACK.MAJOR.15.G0"),
    ("16", "The Tower", "CATASTROPHIC INTERRUPT", "JACK.MAJOR.16.G0"),
    ("17", "The Star", "REMOTE SIGNAL", "JACK.MAJOR.17.G0"),
    ("18", "The Moon", "NOISY CHANNEL", "JACK.MAJOR.18.G0"),
    ("19", "The Sun", "FULL READ", "JACK.MAJOR.19.G0"),
    ("20", "Judgement", "INTERRUPT / RECALL", "JACK.MAJOR.20.G0"),
    ("21", "The World", "CLOSED SYSTEM", "JACK.MAJOR.21.G0"),
]

SUITS = [
    ("wands", "PROGRAMME", 23),
    ("cups", "RECOLLECTION", 37),
    ("swords", "CLASSIFICATION", 51),
    ("pentacles", "RECORD", 65),
]

PIPS = [
    ("01", "Ace", "INITIALISE"),
    ("02", "Two", "POLARITY"),
    ("03", "Three", "TRIANGULATE"),
    ("04", "Four", "STABILISE"),
    ("05", "Five", "PERTURB"),
    ("06", "Six", "TRANSFER"),
    ("07", "Seven", "THRESHOLD"),
    ("08", "Eight", "ITERATE"),
    ("09", "Nine", "SATURATION"),
    ("10", "Ten", "OVERFLOW"),
    ("11", "Page", "PROBE"),
    ("12", "Knight", "CARRIER"),
    ("13", "Queen", "RECEPTIVE CONTROL"),
    ("14", "King", "GOVERNING CONTROL"),
]


def pixmap_image(pix: fitz.Pixmap) -> Image.Image:
    return Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")


def save_webp(im: Image.Image, dest: Path, size: Optional[Tuple[int, int]] = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = im
    if size:
        out = im.copy()
        out.thumbnail(size, Image.Resampling.LANCZOS)
    out.save(dest, "WEBP", quality=78, method=4)


def crop_stamp(im: Image.Image) -> Image.Image:
    w, h = im.size
    return im.crop((int(w * 0.16), int(h * 0.16), int(w * 0.84), int(h * 0.56)))


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"missing deck PDF: {PDF}")
    doc = fitz.open(PDF)
    mat = fitz.Matrix(1.45, 1.45)
    cards = []

    for i, (num, inherited, compiled, code) in enumerate(MAJORS):
        page = doc[1 + i]
        im = pixmap_image(page.get_pixmap(matrix=mat, alpha=False))
        name = f"major-{num}.webp"
        save_webp(im, OUT / name, (720, 1020))
        save_webp(crop_stamp(im), STAMPS / f"major-{num}.webp", (360, 280))
        cards.append({
            "page": 1 + i,
            "file": name,
            "stamp": f"stamps/major-{num}.webp",
            "catalog": inherited,
            "compiled": compiled,
            "code": code,
            "suit": "major",
            "rank": num,
        })

    for suit, suit_compiled, start in SUITS:
        for j, (num, inherited_rank, compiled) in enumerate(PIPS):
            page_i = start + j
            inherited = f"{inherited_rank} of {suit.capitalize()}"
            im = pixmap_image(doc[page_i].get_pixmap(matrix=mat, alpha=False))
            name = f"{suit}-{num}.webp"
            save_webp(im, OUT / name, (720, 1020))
            if num in ("01", "14"):
                save_webp(crop_stamp(im), STAMPS / f"{suit}-{num}.webp", (360, 280))
            cards.append({
                "page": page_i,
                "file": name,
                "stamp": f"stamps/{suit}-{num}.webp" if num in ("01", "14") else None,
                "catalog": inherited,
                "compiled": compiled,
                "code": f"JACK.{suit.upper()}.{num}.G0",
                "suit": suit,
                "rank": num,
                "suit_compiled": suit_compiled,
            })

    manifest = {
        "generation": 0,
        "source": "JACK_TAROT_FULL_DECK_v1.pdf",
        "note": "The deck is not illustrated. The deck is compiled. Jack is learning to see.",
        "cards": cards,
    }
    (OUT / "deck.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(cards)} faces + stamps")


if __name__ == "__main__":
    main()
