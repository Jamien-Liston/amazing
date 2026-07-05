#!/usr/bin/env python3
"""Generate Amazing PWA icons (four-point sparkle star on the cosmic theme).

Draws at 4x supersample then downscales with LANCZOS for crisp edges.
Outputs icons/icon-192.png and icons/icon-512.png. Maskable-safe: all
artwork sits within the central ~80% safe zone.
"""
import math
import os
from PIL import Image, ImageDraw

SS = 4  # supersample factor
SIZE = 512 * SS

# Theme palette (matches css/style.css)
BG_TOP = (46, 30, 102)    # #2e1e66
BG_BOT = (28, 18, 64)     # --bg #1c1240
STAR = (255, 201, 77)     # --accent #ffc94d
STAR_GLOW = (255, 226, 150)
TWINKLE = (253, 249, 239) # --text warm white


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def four_point_star(cx, cy, r_long, r_short):
    """Points of a four-point sparkle (long tips N/E/S/W, short between)."""
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        r = r_long if i % 2 == 0 else r_short
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def make_icon():
    img = Image.new("RGB", (SIZE, SIZE), BG_BOT)
    d = ImageDraw.Draw(img)

    # Radial-ish gradient: vertical blend
    for y in range(SIZE):
        d.line([(0, y), (SIZE, y)], fill=lerp(BG_TOP, BG_BOT, y / SIZE))

    S = SIZE
    cx, cy = 0.5 * S, 0.5 * S

    # Soft glow behind the main star: concentric tinted discs
    for r, tint in ((0.30, 0.10), (0.24, 0.16), (0.18, 0.22)):
        overlay = lerp(BG_BOT, STAR_GLOW, tint)
        d.ellipse([cx - r * S, cy - r * S, cx + r * S, cy + r * S], fill=overlay)

    # Main sparkle star
    d.polygon(four_point_star(cx, cy, 0.30 * S, 0.075 * S), fill=STAR)

    # Two small companion twinkles
    d.polygon(four_point_star(0.75 * S, 0.27 * S, 0.06 * S, 0.016 * S), fill=TWINKLE)
    d.polygon(four_point_star(0.26 * S, 0.74 * S, 0.045 * S, 0.012 * S), fill=TWINKLE)

    return img


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons = os.path.join(here, "icons")
    os.makedirs(icons, exist_ok=True)
    base = make_icon()
    for px in (512, 192):
        out = base.resize((px, px), Image.LANCZOS)
        out.save(os.path.join(icons, f"icon-{px}.png"))
        print(f"wrote icons/icon-{px}.png")


if __name__ == "__main__":
    main()
