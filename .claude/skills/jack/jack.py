#!/usr/bin/env python3
"""Talk to Jack, the Guild's clerk, from the terminal.

    python3 -I .claude/skills/jack/jack.py "your words"
    python3 -I .claude/skills/jack/jack.py --forget-thread   (start a fresh sitting)

Sends the words to /jack/cli.php on the live site as the Keeper and prints Jack's reply.
The token is read from ~/.config/timetravellersguild/jack-cli.token (never from the repo).
Set JACK_URL to talk to another desk, e.g. http://localhost:8765 for the local server.
The last few exchanges are kept in ~/.cache/timetravellersguild/jack-thread.txt so a sitting
reads as one conversation; Jack's own memory carries over between sittings.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

HOME = pathlib.Path.home()
TOKEN_FILE = HOME / ".config" / "timetravellersguild" / "jack-cli.token"
THREAD_FILE = HOME / ".cache" / "timetravellersguild" / "jack-thread.txt"
BASE = os.environ.get("JACK_URL", "https://timetravellersguild.com").rstrip("/")


def main() -> int:
    args = sys.argv[1:]
    if args == ["--forget-thread"]:
        THREAD_FILE.unlink(missing_ok=True)
        print("Fresh sitting. Jack's own memory of you is unchanged.")
        return 0
    q = " ".join(args).strip()
    if not q:
        print("Say something to Jack: /jack <your words>", file=sys.stderr)
        return 2
    try:
        token = TOKEN_FILE.read_text().strip()
    except OSError:
        print(f"No token at {TOKEN_FILE}. The terminal line is not set up on this machine.", file=sys.stderr)
        return 3

    thread = THREAD_FILE.read_text() if THREAD_FILE.exists() else ""
    body = json.dumps({"q": q, "thread": thread[-1500:]}).encode()
    req = urllib.request.Request(
        BASE + "/jack/cli.php",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "X-Jack-Token": token, "User-Agent": "ttg-jack-cli/1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=270) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read().decode("utf-8"))
        except Exception:
            data = {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:  # network, timeout
        print(f"The line to the desk failed: {e}", file=sys.stderr)
        return 4

    text = (data.get("text") or "").strip()
    if not text:
        print(f"Jack did not answer: {data.get('error') or 'no reply'}", file=sys.stderr)
        return 5
    print(text)
    consulted = data.get("consulted") or []
    if consulted:
        print(f"\n[consulted: {', '.join(consulted)}]")

    THREAD_FILE.parent.mkdir(parents=True, exist_ok=True)
    thread = (thread + f"\nKeeper: {q}\nClerk: {text}")[-3000:]
    THREAD_FILE.write_text(thread)
    return 0


if __name__ == "__main__":
    sys.exit(main())
