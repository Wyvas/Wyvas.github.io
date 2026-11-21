"""Télécharge les icônes Lucide utilisées par le site et génère icons.js (sprite JS local).
Usage : python tools/build_icons.py icons.js
"""
import json, re, sys, urllib.request

VERSION = "0.460.0"
NAMES = """
sparkles wand-sparkles download zap boxes refresh-cw sliders-horizontal globe layout-dashboard app-window
workflow settings-2 spline clock puzzle bug library keyboard sigma chef-hat arrow-left-right cpu
layout-template layout-grid image repeat list aperture circle-dot network gamepad-2 braces radio-tower
gauge circle-help triangle-alert book-open search arrow-right arrow-left chevron-down copy check
lightbulb menu x languages save upload eye dices diamond plus maximize-2 undo-2 redo-2 magnet sun
move-diagonal-2 ellipsis-vertical settings play pause skip-back skip-forward swords flame leaf atom
star graduation-cap feather recycle telescope activity layers hourglass construction code-xml
mouse-pointer-click file-code arrow-up-right box
rotate-ccw chevron-right folder cloud wind palette shapes lock monitor sliders-vertical circle square
terminal table trash-2 grip-vertical eye-off folder-open file plus-circle mouse-pointer-2 move cloud-snow
target orbit droplets snowflake bolt shield sword crosshair
""".split()

out = {}
for n in NAMES:
    url = f"https://unpkg.com/lucide-static@{VERSION}/icons/{n}.svg"
    try:
        svg = urllib.request.urlopen(url, timeout=20).read().decode("utf-8")
    except Exception as e:  # noqa: BLE001
        print("MANQUANT", n, e)
        continue
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    out[n] = re.sub(r"\s+", " ", inner).strip()

with open(sys.argv[1], "w", encoding="utf-8") as f:
    f.write("/* Icônes Lucide (ISC License, https://lucide.dev) — généré par tools/build_icons.py */\n")
    f.write("window.NFX_ICONS = ")
    json.dump(out, f, separators=(",", ":"))
    f.write(";\n")
print(len(out), "icônes")
