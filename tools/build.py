#!/usr/bin/env python3
"""Build tanks/index.html: inlines every Kenney sprite and the game scripts into one file.

Usage: python3 tools/build.py [fragment_out.html]
The optional argument also writes a body-only fragment (for hosts that add their own <head>).
"""
import base64
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
ORDER = ["core.js", "data.js", "maps.js", "world.js", "render.js", "ui.js", "main.js"]


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    assets = {
        "t": {p.stem: data_uri(p) for p in sorted((ROOT / "assets" / "tanks").glob("*.png"))},
        "u": {p.stem: data_uri(p) for p in sorted((ROOT / "assets" / "ui").glob("*.png"))},
    }
    assets_js = "const ASSETS = " + json.dumps(assets, separators=(",", ":")) + ";"
    game_js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in ORDER)
    page = (SRC / "page.html").read_text(encoding="utf-8")

    # every UI sprite must be referenced somewhere in the page or the scripts
    code = page + game_js
    unused = [k for k in assets["u"] if not re.search(r"(?<![A-Za-z0-9_])" + re.escape(k) + r"(?![A-Za-z0-9_])", code)]
    if unused:
        print("warning: UI sprites never referenced:", ", ".join(unused))

    page = page.replace("/*__ASSETS__*/", assets_js).replace("/*__GAME__*/", game_js)
    head_end = page.index("<canvas")
    head, body = page[:head_end], page[head_end:]
    full = (
        "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
        + head + "</head>\n<body>\n" + body + "</body>\n</html>\n"
    )
    (ROOT / "index.html").write_text(full, encoding="utf-8")
    print("wrote", ROOT / "index.html", f"{len(full) / 1024:.0f} KB,", len(assets["t"]), "tank sprites,", len(assets["u"]), "UI sprites")
    if len(sys.argv) > 1:
        out = pathlib.Path(sys.argv[1])
        out.write_text(page, encoding="utf-8")
        print("wrote", out, f"{len(page) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
