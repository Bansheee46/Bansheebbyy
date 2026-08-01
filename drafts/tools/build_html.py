import sys

svg = open("welcome.svg").read()

SITE = r"""
  <!-- ===================== macOS-style site ===================== -->
  <header class="menubar reveal" style="--i:0">
    <div class="menubar-inner">
      <div class="logo">
        <span class="logo-mark"></span> Bbyy
      </div>
      <nav class="nav">
        <a href="#overview">Overview</a>
        <a href="#features">Features</a>
        <a href="#gallery">Gallery</a>
        <a href="#contact">Contact</a>
      </nav>
      <a class="pill" href="#contact">Get started</a>
    </div>
  </header>

  <main class="site">
    <section class="hero" id="overview">
      <p class="eyebrow reveal" style="--i:1">Introducing</p>
      <h1 class="reveal" style="--i:2">Crafted with care.</h1>
      <p class="lede reveal" style="--i:3">
        A calm, focused space designed in the spirit of macOS —
        clean typography, soft depth, and motion that feels alive.
      </p>
      <div class="cta reveal" style="--i:4">
        <a class="btn primary" href="#contact">Get Started</a>
        <a class="btn ghost" href="#features">Learn more&nbsp;&rsaquo;</a>
      </div>
    </section>

    <section class="showcase" id="gallery">
      <div class="mac-window reveal" style="--i:5">
        <div class="titlebar">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <div class="title">bbyy&nbsp;&mdash;&nbsp;welcome</div>
        </div>
        <div class="window-body">
          <aside class="side">
            <span class="side-ic"></span>
            <span class="side-ic"></span>
            <span class="side-ic"></span>
          </aside>
          <div class="panel">
            <p class="panel-kicker">Welcome back</p>
            <h2>Hello, I&rsquo;m Bbyy.</h2>
            <p class="panel-text">
              This is a little corner of the web built with intention —
              quiet colours, gentle motion, and a handwriting that draws itself.
            </p>
            <div class="stats">
              <div class="stat"><b>12</b><span>Projects</span></div>
              <div class="stat"><b>∞</b><span>Ideas</span></div>
              <div class="stat"><b>100%</b><span>Handmade</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="features" id="features">
      <article class="card reveal" style="--i:6">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M18 14l.9 2.3L21 17l-2.1.7L18 20l-.9-2.3L15 17l2.1-.7z"/></svg>
        <h3>Delightful detail</h3>
        <p>Every transition is eased, every shadow soft — the small things done right.</p>
      </article>
      <article class="card reveal" style="--i:7">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.2 12l2 2 3.6-4"/></svg>
        <h3>Built to last</h3>
        <p>Clean, semantic structure and fluid layouts that hold up on any screen.</p>
      </article>
      <article class="card reveal" style="--i:8">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#0071e3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>
        <h3>Fast by nature</h3>
        <p>A featherweight preloader and zero heavy dependencies keep it snappy.</p>
      </article>
    </section>

    <footer class="footer" id="contact">
      <div class="reveal" style="--i:9">
        <span class="logo-mark small"></span>
        <p>Bbyy &mdash; made with care.</p>
        <p class="copy">© 2026 Bbyy. Designed in the spirit of macOS.</p>
      </div>
    </footer>
  </main>
"""

html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bbyy — Welcome</title>
<style>
  :root {
    --bg: #fbfbfd;
    --ink: #1d1d1f;
    --muted: #86868b;
    --blue: #0071e3;
    --blue-d: #0077ed;
    --line: rgba(0,0,0,0.08);
    --card: #ffffff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
                 "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--ink);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  body.revealed { overflow: auto; }

  /* ---------- Preloader overlay ---------- */
  #preloader {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: radial-gradient(130% 130% at 50% 30%, #ffffff 0%, #f4f4f6 55%, #e9e9ee 100%);
    z-index: 9999;
    transition: opacity 1.1s ease, visibility 1.1s ease, filter 1.1s ease;
  }
  #preloader.done { opacity: 0; visibility: hidden; pointer-events: none; filter: blur(6px); }

  #stage { position: relative; animation: rise 1.2s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
  #handwrite {
    width: min(84vw, 780px); height: auto; overflow: visible;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,0.06));
  }

  #pen {
    position: fixed; left: 0; top: 0; width: 16px; height: 16px;
    margin: -8px 0 0 -8px; border-radius: 50%;
    background: radial-gradient(circle at 35% 32%, #5b5b61, #1d1d1f 72%);
    box-shadow: 0 0 14px 5px rgba(29,29,31,0.22);
    opacity: 0; transition: opacity .35s ease;
    pointer-events: none; z-index: 10000; mix-blend-mode: multiply;
  }
  #pen::after {
    content: ""; position: absolute; left: 50%; top: 50%;
    width: 2px; height: 26px; margin: -3px 0 0 -1px;
    background: linear-gradient(to bottom, rgba(29,29,31,0), rgba(29,29,31,.55));
    transform: rotate(38deg); transform-origin: top center; border-radius: 2px;
  }

  .caption {
    margin-top: 2.4rem; font-size: 0.8rem; letter-spacing: 0.34em;
    text-transform: uppercase; color: var(--muted);
    opacity: 0; transform: translateY(8px);
    transition: opacity 1s ease .25s, transform 1s ease .25s;
  }
  #preloader.writing .caption { opacity: 1; transform: none; }
  .caption .dots::after { content: ""; animation: dots 1.6s steps(4, end) infinite; }
  @keyframes dots { 0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}100%{content:""} }

  #replay {
    position: fixed; right: 22px; bottom: 22px; z-index: 10001;
    border: none; cursor: pointer; font: inherit; font-size: .8rem; letter-spacing: .02em;
    color: var(--ink); background: rgba(255,255,255,.7);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(0,0,0,.06); padding: 8px 16px; border-radius: 980px;
    box-shadow: 0 4px 16px rgba(0,0,0,.08);
    opacity: 0; transform: translateY(8px);
    transition: opacity .6s ease, transform .6s ease, background .2s ease;
  }
  #replay:hover { background: rgba(255,255,255,.95); }
  #replay.show { opacity: 1; transform: none; }

  /* ---------- Staggered reveal of the site ---------- */
  .reveal {
    opacity: 0; transform: translateY(22px);
    transition: opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1);
    transition-delay: calc(var(--i, 0) * 0.10s);
  }
  body.revealed .reveal { opacity: 1; transform: none; }

  /* ---------- Menu bar ---------- */
  .menubar {
    position: sticky; top: 0; z-index: 50;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    background: rgba(251,251,253,0.72);
    border-bottom: 1px solid var(--line);
  }
  .menubar-inner {
    max-width: 1024px; margin: 0 auto; padding: 0 22px; height: 52px;
    display: flex; align-items: center; gap: 28px;
  }
  .logo { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 1.05rem; letter-spacing: -0.01em; }
  .logo-mark {
    width: 18px; height: 18px; border-radius: 6px;
    background: linear-gradient(135deg, #6ab7ff, #0071e3);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.06);
  }
  .logo-mark.small { width: 14px; height: 14px; border-radius: 5px; }
  .nav { display: flex; gap: 26px; margin-left: 6px; }
  .nav a { color: #1d1d1f; text-decoration: none; font-size: 0.86rem; opacity: .82; transition: opacity .2s; }
  .nav a:hover { opacity: 1; }
  .pill {
    margin-left: auto; text-decoration: none; color: #fff;
    background: var(--blue); padding: 6px 14px; border-radius: 980px;
    font-size: 0.84rem; font-weight: 500; transition: background .2s, transform .2s;
  }
  .pill:hover { background: var(--blue-d); transform: translateY(-1px); }

  /* ---------- Hero ---------- */
  .site { max-width: 1024px; margin: 0 auto; padding: 0 22px; }
  .hero { text-align: center; padding: clamp(60px, 12vh, 130px) 0 40px; }
  .eyebrow { color: var(--blue); font-weight: 600; font-size: 1rem; letter-spacing: .01em; margin-bottom: 10px; }
  .hero h1 {
    font-weight: 600; letter-spacing: -0.03em; line-height: 1.05;
    font-size: clamp(2.6rem, 7vw, 5rem);
    background: linear-gradient(180deg, #1d1d1f, #3a3a3f);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .lede { max-width: 600px; margin: 20px auto 0; color: var(--muted); font-size: clamp(1rem, 2.2vw, 1.25rem); line-height: 1.5; }
  .cta { margin-top: 30px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
  .btn { text-decoration: none; font-size: 1rem; padding: 12px 24px; border-radius: 980px; transition: transform .2s, background .2s, box-shadow .2s; }
  .btn.primary { background: var(--blue); color: #fff; box-shadow: 0 6px 18px rgba(0,113,227,.28); }
  .btn.primary:hover { background: var(--blue-d); transform: translateY(-1px); }
  .btn.ghost { color: var(--blue); }
  .btn.ghost:hover { text-decoration: underline; }

  /* ---------- macOS window mock ---------- */
  .showcase { padding: 30px 0 50px; display: flex; justify-content: center; }
  .mac-window {
    width: min(720px, 100%); border-radius: 14px; overflow: hidden;
    background: #fff; border: 1px solid var(--line);
    box-shadow: 0 30px 70px rgba(0,0,0,.16), 0 8px 20px rgba(0,0,0,.08);
  }
  .titlebar {
    height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px;
    background: linear-gradient(180deg, #f6f6f8, #ececed);
    border-bottom: 1px solid var(--line);
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.red { background: #ff5f57; } .dot.yellow { background: #febc2e; } .dot.green { background: #28c840; }
  .title { margin: 0 auto; font-size: 0.78rem; color: #6e6e73; }
  .window-body { display: flex; min-height: 240px; }
  .side { width: 64px; background: #fafafa; border-right: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 0; }
  .side-ic { width: 30px; height: 30px; border-radius: 8px; background: #ececed; box-shadow: inset 0 0 0 1px rgba(0,0,0,.04); }
  .side-ic:nth-child(1){ background: linear-gradient(135deg,#cfe8ff,#9fd0ff); }
  .side-ic:nth-child(2){ background: linear-gradient(135deg,#ffe3c2,#ffd0a0); }
  .side-ic:nth-child(3){ background: linear-gradient(135deg,#d8ffd8,#aef0ae); }
  .panel { flex: 1; padding: 30px 34px; text-align: left; }
  .panel-kicker { color: var(--blue); font-weight: 600; font-size: 0.85rem; }
  .panel h2 { font-size: clamp(1.5rem, 3.5vw, 2.1rem); letter-spacing: -0.02em; margin: 6px 0 10px; }
  .panel-text { color: var(--muted); line-height: 1.55; max-width: 440px; }
  .stats { display: flex; gap: 26px; margin-top: 24px; }
  .stat { display: flex; flex-direction: column; }
  .stat b { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.02em; }
  .stat span { color: var(--muted); font-size: 0.8rem; }

  /* ---------- Features ---------- */
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; padding: 30px 0 70px; }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 18px;
    padding: 28px 26px; box-shadow: 0 10px 30px rgba(0,0,0,.05);
    transition: transform .25s ease, box-shadow .25s ease;
  }
  .card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(0,0,0,.09); }
  .ic { width: 34px; height: 34px; margin-bottom: 14px; }
  .card h3 { font-size: 1.15rem; letter-spacing: -0.01em; margin-bottom: 8px; }
  .card p { color: var(--muted); line-height: 1.5; font-size: 0.95rem; }

  /* ---------- Footer ---------- */
  .footer { text-align: center; padding: 50px 22px 70px; border-top: 1px solid var(--line); color: var(--muted); }
  .footer .logo-mark { display: inline-block; vertical-align: -2px; margin-right: 6px; }
  .footer p { margin-top: 6px; }
  .footer .copy { font-size: 0.8rem; opacity: .7; }

  @media (max-width: 640px) {
    .nav { display: none; }
    .window-body { flex-direction: column; }
    .side { width: 100%; flex-direction: row; justify-content: center; padding: 12px; border-right: none; border-bottom: 1px solid var(--line); }
  }
</style>
</head>
<body>

  <div id="preloader" class="writing">
    <div id="stage">
__SVG__
    </div>
    <div class="caption">Loading<span class="dots"></span></div>
  </div>

  <button id="replay" title="Replay the handwriting">Replay</button>
  <div id="pen"></div>

__SITE__

  <script src="https://cdn.jsdelivr.net/npm/vivus@0.4.6/dist/vivus.min.js"></script>
  <script>
    var svg       = document.getElementById('handwrite');
    var pen       = document.getElementById('pen');
    var preloader = document.getElementById('preloader');
    var replay    = document.getElementById('replay');

    function onDrawn () {
      setTimeout(function () {
        preloader.classList.remove('writing');
        preloader.classList.add('done');
        document.body.classList.add('revealed');
        replay.classList.add('show');
      }, 600);
    }

    var vivus = new Vivus('handwrite', {
      type: 'oneByOne',
      duration: 240,
      animTimingFunction: Vivus.EASE,
      pathTimingFunction: Vivus.EASE_OUT,
      dashGap: 3,
      start: 'autostart'
    }, onDrawn);

    function positionPen () {
      var paths = svg.querySelectorAll('path');
      var tip = null, tipPath = null, active = false;
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var total = p.getTotalLength();
        if (!total) continue;
        var off = parseFloat(p.style.strokeDashoffset);
        if (isNaN(off)) off = 0;
        var drawn = total - off;
        if (drawn > 1 && drawn < total - 1) {
          tip = p.getPointAtLength(drawn); tipPath = p; active = true; break;
        } else if (drawn >= total - 1) {
          tip = p.getPointAtLength(total); tipPath = p;
        }
      }
      if (tip && tipPath) {
        var ctm = tipPath.getScreenCTM();
        var pt = svg.createSVGPoint();
        pt.x = tip.x; pt.y = tip.y;
        var s = pt.matrixTransform(ctm);
        pen.style.left = s.x + 'px';
        pen.style.top  = s.y + 'px';
        pen.style.opacity = active ? 1 : 0;
      } else {
        pen.style.opacity = 0;
      }
    }

    var running = false;
    function loop () {
      if (running) return;
      running = true;
      (function frame () {
        positionPen();
        if (vivus.getStatus() === 'end') { pen.style.opacity = 0; running = false; return; }
        requestAnimationFrame(frame);
      })();
    }
    loop();

    replay.addEventListener('click', function () {
      preloader.classList.remove('done', 'writing');
      replay.classList.remove('show');
      pen.style.opacity = 1;
      vivus.reset();
      vivus.play(1, onDrawn);
      loop();
    });
  </script>

</body>
</html>
"""

html = html.replace("__SVG__", "      " + svg.replace("\n", "\n      "))
html = html.replace("__SITE__", SITE)

with open("var5.html", "w") as f:
    f.write(html)
print("wrote var5.html", len(html), "bytes")
