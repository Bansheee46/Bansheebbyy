import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

font_path = sys.argv[1]
text = sys.argv[2]
out_svg = sys.argv[3]

tt = TTFont(font_path)
cmap = tt.getBestCmap()
hmtx = tt["hmtx"]
glyphSet = tt.getGlyphSet()
upm = tt["head"].unitsPerEm
yMin = tt["head"].yMin
yMax = tt["head"].yMax
ascender = tt["hhea"].ascent
descender = tt["hhea"].descent

scale = 1.0
# font coords have y-up; map glyph y -> SVG y with top at 0:
#   svg_y = yMax - py  ==  translate(0, yMax) then scale(1,-1)
baseline = yMax * scale
total_w = 0.0
paths = []

# letter spacing factor (script fonts look better a touch tighter)
tracking = -0.02

for ch in text:
    if ch == " ":
        total_w += upm * 0.25 * scale
        continue
    gname = cmap.get(ord(ch))
    if gname is None:
        # fallback: advance by em
        total_w += upm * scale
        continue
    pen = SVGPathPen(glyphSet)
    glyphSet[gname].draw(pen)
    d = pen.getCommands()
    if d.strip():
        paths.append((total_w, d))
    adv = hmtx[gname][0]
    total_w += adv * scale * (1 + tracking)

width = total_w
height = (yMax - yMin) * scale

# Compute exact ink bounding box so nothing gets clipped.
ink = [1e9, 1e9, -1e9, -1e9]  # xmin, ymin(font), xmax, ymax(font)
# Recompute properly: iterate again with bounds pen.
bounds_paths = []
bx = 0.0
for ch in text:
    if ch == " ":
        bx += upm * 0.25 * scale
        continue
    gname = cmap.get(ord(ch))
    if gname is None:
        bx += upm * scale
        continue
    bpen = BoundsPen(glyphSet)
    glyphSet[gname].draw(bpen)
    if bpen.bounds:
        x0, y0, x1, y1 = bpen.bounds
        ink[0] = min(ink[0], bx + x0 * scale)
        ink[1] = min(ink[1], y0 * scale)
        ink[2] = max(ink[2], bx + x1 * scale)
        ink[3] = max(ink[3], y1 * scale)
    adv = hmtx[gname][0]
    bx += adv * scale * (1 + tracking)

# A hand-drawn signature flourish, drawn last (underlined swash with a tail).
fx0 = ink[0] + upm * 0.04 * scale
fx1 = ink[2] - upm * 0.04 * scale
span = fx1 - fx0
flourish = (
    f"M {fx0:.1f} {-upm*0.02*scale:.1f} "
    f"C {fx0 + span*0.35:.1f} {-upm*0.10*scale:.1f} "
    f"{fx1 - span*0.35:.1f} {-upm*0.10*scale:.1f} {fx1:.1f} {-upm*0.015*scale:.1f} "
    f"c {upm*0.02*scale:.1f} {-upm*0.05*scale:.1f} {upm*0.05*scale:.1f} "
    f"{-upm*0.03*scale:.1f} {upm*0.07*scale:.1f} {upm*0.012*scale:.1f}"
)
# Include the flourish in the ink bounds so nothing clips.
ink[0] = min(ink[0], fx0)
ink[2] = max(ink[2], fx1 + upm * 0.07 * scale)
ink[1] = min(ink[1], -upm * 0.10 * scale)

pad = upm * 0.08 * scale
# map font y -> svg y:  svgY = yMax - fontY
vb_x = ink[0] - pad
vb_y = (yMax * scale) - ink[3] - pad
vb_w = (ink[2] - ink[0]) + 2 * pad
vb_h = (ink[3] - ink[1]) + 2 * pad

parts = []
parts.append(
    f'<svg id="handwrite" xmlns="http://www.w3.org/2000/svg" '
    f'viewBox="{vb_x:.1f} {vb_y:.1f} {vb_w:.1f} {vb_h:.1f}" '
    f'preserveAspectRatio="xMidYMid meet" '
    f'fill="none" stroke="#1d1d1f" stroke-width="{upm*0.012:.2f}" '
    f'stroke-linecap="round" stroke-linejoin="round">'
)
for x, d in paths:
    parts.append(
        f'<path transform="translate({x:.2f},{baseline:.2f}) scale(1,-1)" d="{d}"/>'
    )
# flourish last -> draws after the word like a finishing signature
parts.append(
    f'<path transform="translate(0.00,{baseline:.2f}) scale(1,-1)" d="{flourish}"/>'
)
parts.append("</svg>")

with open(out_svg, "w") as f:
    f.write("\n".join(parts))

print(f"width={width:.1f} height={height:.1f} letters={len(paths)}")
