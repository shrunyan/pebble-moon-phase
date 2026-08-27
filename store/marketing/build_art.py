#!/usr/bin/env python3
"""Regenerate the marketing composites in this directory.

Inputs  : ../emery_screenshot_{1,2,3}.png  (200x228 emery captures:
          First Quarter, Waxing Crescent, Waxing Gibbous — in that order)
Outputs : hero_1600x1000.png, square_1200x1200.png, banner_1400x560.png

Needs a headless SVG rasteriser. Tries, in order:
  - rsvg-convert            (librsvg;   apt install librsvg2-bin)
  - chromium / chrome       (headless --screenshot)
Note: the snap build of Chromium cannot write outside $HOME, so output is
rendered into a temp dir under $HOME and copied back.

Screenshots are captured with, e.g.:
  pebble emu-set-time ... ; pebble install --emulator emery
  pebble screenshot --emulator emery ../emery_screenshot_1.png
(or temporarily pin tonightAnchor() in src/embeddedjs/main.js to a date
with the phase you want, build, install, screenshot, then revert.)
"""
import base64, os, random, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.dirname(HERE)
SCR_W, SCR_H = 200, 228
random.seed(49)


def load_uri(name):
    """5x nearest-neighbour upscale (keeps the watch pixels crisp), base64'd."""
    src = os.path.join(STORE, name)
    up = os.path.join(tempfile.gettempdir(), name.replace("/", "_") + ".5x.png")
    subprocess.run(["magick", src, "-filter", "point", "-resize", "500%", up],
                   check=True)
    with open(up, "rb") as fh:
        return "data:image/png;base64," + base64.b64encode(fh.read()).decode()


def rasterise(svg_text, w, h, out_path):
    if shutil.which("rsvg-convert"):
        svg = tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False)
        svg.write(svg_text); svg.close()
        subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h),
                        "-o", out_path, svg.name], check=True)
        os.unlink(svg.name); return
    for exe in ("chromium", "chromium-browser", "google-chrome", "chrome"):
        if not shutil.which(exe):
            continue
        # The snap Chromium is confined to non-hidden paths under $HOME for
        # both reads and writes, so stage the SVG + PNG there.
        work = os.path.join(os.path.expanduser("~"), "moonart-build")
        os.makedirs(work, exist_ok=True)
        base = os.path.splitext(os.path.basename(out_path))[0]
        svg_path = os.path.join(work, base + ".svg")
        png_path = os.path.join(work, base + ".png")
        with open(svg_path, "w") as fh:
            fh.write(svg_text)
        subprocess.run([exe, "--headless", "--no-sandbox", "--hide-scrollbars",
                        f"--screenshot={png_path}", f"--window-size={w},{h}",
                        "--default-background-color=00000000",
                        "--force-device-scale-factor=1",
                        f"file://{svg_path}"], check=True, capture_output=True)
        shutil.copy(png_path, out_path)
        return
    sys.exit("no rasteriser found (install librsvg2-bin or chromium)")


def stars(w, h, n):
    out = []
    for _ in range(n):
        out.append(f'<circle cx="{random.uniform(0,w):.1f}" cy="{random.uniform(0,h):.1f}" '
                   f'r="{random.uniform(0.4,1.7):.2f}" fill="#e8ebf5" '
                   f'opacity="{random.uniform(0.10,0.8):.2f}"/>')
    return "\n".join(out)


def watch(cx, cy, s, rot, img, buttons="both"):
    sw, sh = SCR_W * s, SCR_H * s
    bezel, frame = 14 * s, 10 * s
    bw, bh = sw + 2 * (bezel + frame), sh + 2 * (bezel + frame)
    x, y = cx - bw / 2, cy - bh / 2
    r, ri = 28 * s, 17 * s
    sx, sy = cx - sw / 2, cy - sh / 2
    bl = (f'<rect x="{x-5.5*s:.1f}" y="{cy-24*s:.1f}" width="{7*s:.1f}" height="{22*s:.1f}" '
          f'rx="{3*s:.1f}" fill="#9a9ba4"/>') if buttons in ("both", "left") else ""
    br = (f'<rect x="{x+bw-1.5*s:.1f}" y="{cy-58*s:.1f}" width="{7*s:.1f}" height="{20*s:.1f}" rx="{3*s:.1f}" fill="#9a9ba4"/>'
          f'<rect x="{x+bw-2*s:.1f}" y="{cy-13*s:.1f}" width="{8.5*s:.1f}" height="{26*s:.1f}" rx="{3*s:.1f}" fill="#cfd0d7"/>'
          f'<rect x="{x+bw-1.5*s:.1f}" y="{cy+26*s:.1f}" width="{7*s:.1f}" height="{20*s:.1f}" rx="{3*s:.1f}" fill="#9a9ba4"/>'
          ) if buttons in ("both", "right") else ""
    return f'''
    <g transform="rotate({rot} {cx:.1f} {cy:.1f})">
      <ellipse cx="{cx:.1f}" cy="{y+bh+12*s:.1f}" rx="{bw*0.46:.1f}" ry="{14*s:.1f}" fill="#000" opacity="0.42" filter="url(#soft)"/>
      {bl}{br}
      <rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="{r:.1f}" fill="url(#body)" stroke="#66666f" stroke-width="{1.3*s:.2f}"/>
      <rect x="{x+2*s:.1f}" y="{y+2*s:.1f}" width="{bw-4*s:.1f}" height="{bh-4*s:.1f}" rx="{r-2*s:.1f}" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="{1.4*s:.2f}"/>
      <rect x="{x+1.5*s:.1f}" y="{y+1.5*s:.1f}" width="{bw-3*s:.1f}" height="{bh*0.44:.1f}" rx="{r:.1f}" fill="url(#gloss)"/>
      <rect x="{x+frame:.1f}" y="{y+frame:.1f}" width="{bw-2*frame:.1f}" height="{bh-2*frame:.1f}" rx="{ri:.1f}" fill="#040405"/>
      <rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="#0a0c1e"/>
      <image x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" href="{img}" image-rendering="pixelated" style="image-rendering:pixelated"/>
      <rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="url(#scr)" opacity="0.06"/>
    </g>'''


def page(w, h, body, title_size, sub_y, tag_lines, tag_y, tag_size,
         title_y, moon, vig, out_name):
    mx, my, mr, mo = moon
    tspans = "".join(f'<tspan x="{w/2:.0f}" dy="{0 if i==0 else tag_size*1.55:.0f}">{ln}</tspan>'
                     for i, ln in enumerate(tag_lines))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"
  font-family="'Liberation Sans','DejaVu Sans','Arial',sans-serif">
  <defs>
    <radialGradient id="bg" cx="42%" cy="28%" r="98%">
      <stop offset="0%" stop-color="#151931"/><stop offset="52%" stop-color="#0a0c1e"/><stop offset="100%" stop-color="#04050b"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="46%" r="72%">
      <stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="{vig}"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0%" stop-color="#30303a"/><stop offset="40%" stop-color="#1b1b22"/><stop offset="100%" stop-color="#0a0a0e"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.16"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff"/><stop offset="38%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#bg)"/>
  <circle cx="{w*mx:.0f}" cy="{h*my:.0f}" r="{h*mr:.0f}" fill="#161a34" opacity="{mo}"/>
  <circle cx="{w*mx:.0f}" cy="{h*my:.0f}" r="{h*mr:.0f}" fill="none" stroke="#2b3057" stroke-width="2" opacity="{mo}"/>
  <g>{stars(w, h, w * h // 5200)}</g>
  <rect width="{w}" height="{h}" fill="url(#vig)"/>
  {body}
  <text x="{w/2:.0f}" y="{sub_y}" font-size="{tag_size*0.72:.0f}" fill="#7278a0" letter-spacing="4" font-weight="700" text-anchor="middle">FOR PEBBLE TIME 2</text>
  <text x="{w/2:.0f}" y="{title_y}" font-size="{title_size}" font-weight="700" fill="#f4f4f9" letter-spacing="{title_size*0.004:.1f}" text-anchor="middle">Moon Phase</text>
  <text x="{w/2:.0f}" y="{tag_y}" font-size="{tag_size}" fill="#a6abc7" text-anchor="middle">{tspans}</text>
</svg>'''
    out = os.path.join(HERE, out_name)
    rasterise(svg, w, h, out)
    # palette-reduce with dithering: gradients stay smooth, files stay small
    subprocess.run(["magick", out, "-strip", "-dither", "FloydSteinberg",
                    "-colors", "200", f"png8:{out}"], check=True)
    print("wrote", out_name)


fq = load_uri("emery_screenshot_1.png")   # First Quarter
wc = load_uri("emery_screenshot_2.png")   # Waxing Crescent
wg = load_uri("emery_screenshot_3.png")   # Waxing Gibbous

# hero
W, H = 1600, 1000
page(W, H,
     watch(W*0.170, H*0.635, 1.52, -13, wc, "left") +
     watch(W*0.830, H*0.635, 1.52,  13, wg, "right") +
     watch(W*0.500, H*0.545, 2.00,   0, fq, "both"),
     title_size=98, sub_y=154, title_y=120,
     tag_lines=["Tonight's moon at a glance — phase, illumination, and a disc drawn to match.",
                "Computed on your watch. No phone, no network."],
     tag_y=H-62, tag_size=28, moon=(0.87, 0.15, 0.46, 0.5), vig=0.42,
     out_name="hero_1600x1000.png")

# square
W, H = 1200, 1200
page(W, H, watch(W*0.5, H*0.545, 2.75, 0, fq, "both"),
     title_size=96, sub_y=182, title_y=146,
     tag_lines=["Tonight's phase, illumination, and a", "matching disc — computed on-watch."],
     tag_y=H-88, tag_size=31, moon=(0.5, 0.5, 0.6, 0.3), vig=0.4,
     out_name="square_1200x1200.png")

def banner(w, h, watch_scale, title_size, tag_size, tag_lines, out_name):
    """Watch on the left, right-aligned text block. Used for the wide banners."""
    tx = w * 0.63
    body = watch(w * 0.265, h * 0.52, watch_scale, -5, fq, "both")
    tspans = "".join(
        f'<tspan x="{tx:.0f}" dy="{0 if i==0 else tag_size*1.5:.0f}">{ln}</tspan>'
        for i, ln in enumerate(tag_lines))
    mx, my, mr, mo = 0.63, 0.5, 0.62, 0.4
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"
  font-family="'Liberation Sans','DejaVu Sans','Arial',sans-serif">
  <defs>
    <radialGradient id="bg" cx="42%" cy="28%" r="98%">
      <stop offset="0%" stop-color="#151931"/><stop offset="52%" stop-color="#0a0c1e"/><stop offset="100%" stop-color="#04050b"/></radialGradient>
    <radialGradient id="vig" cx="50%" cy="46%" r="72%">
      <stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.32"/></radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0%" stop-color="#30303a"/><stop offset="40%" stop-color="#1b1b22"/><stop offset="100%" stop-color="#0a0a0e"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.16"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff"/><stop offset="38%" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#bg)"/>
  <circle cx="{w*mx:.0f}" cy="{h*my:.0f}" r="{h*mr:.0f}" fill="#161a34" opacity="{mo}"/>
  <circle cx="{w*mx:.0f}" cy="{h*my:.0f}" r="{h*mr:.0f}" fill="none" stroke="#2b3057" stroke-width="2" opacity="{mo}"/>
  <g>{stars(w, h, w * h // 5200)}</g>
  <rect width="{w}" height="{h}" fill="url(#vig)"/>
  {body}
  <text x="{tx:.0f}" y="{h*0.42:.0f}" font-size="{title_size}" font-weight="700" fill="#f4f4f9" text-anchor="middle">Moon Phase</text>
  <text x="{tx:.0f}" y="{h*0.42 + title_size*0.75:.0f}" font-size="{tag_size}" fill="#a6abc7" text-anchor="middle">{tspans}</text>
</svg>'''
    out = os.path.join(HERE, out_name)
    rasterise(svg, w, h, out)
    subprocess.run(["magick", out, "-strip", "-dither", "FloydSteinberg",
                    "-colors", "200", f"png8:{out}"], check=True)
    print("wrote", out_name)


# official dev-portal marketing banner
banner(720, 320, 0.66, 46, 15,
       ["Phase, illumination, and a", "matching disc — computed on-watch."],
       "marketing-banner-720x320.png")

# larger banner for a README / social card
banner(1400, 560, 1.40, 80, 27,
       ["Phase, illumination, and a procedurally", "drawn disc — all computed on-watch."],
       "banner_1400x560.png")
