/* ===========================================================
   بايو (BIO) — المؤثرات البصرية (Canvas، بدون مكتبات)
   خلفية «خلايا» سداسية عائمة بألوان الشعار + كونفيتي واحتفال
   تحترم prefers-reduced-motion: خلفية ثابتة وبدون كونفيتي.
   الواجهة العامة كما هي: FX.starfield(id) / FX.confettiBurst() / FX.celebrate()
   =========================================================== */

const FX = (() => {
  const PALETTE = ["#f9e09b", "#c3e813", "#e4a6f7", "#9fe0ec", "#e8949d"];
  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const reduced = () => reduceMQ.matches;

  function hexPath(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (Math.PI / 3) * i;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  // ---------------- خلفية الخلايا العائمة ----------------
  // (الاسم starfield بقي للتوافق مع game.js)
  function starfield(canvasId) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let cells = [];
    let w, h, dpr;
    let raf = null;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(8, Math.min(22, Math.floor((w * h) / 70000)));
      cells = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 8 + Math.random() * 26,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.12,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.0015,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        fill: Math.random() > 0.55,
      }));
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const light = document.body && document.body.dataset.mode === "light";
      for (const s of cells) {
        hexPath(ctx, s.x, s.y, s.r, s.rot);
        ctx.globalAlpha = light ? 0.16 : 0.1;
        if (s.fill) {
          ctx.fillStyle = s.c;
          ctx.fill();
        } else {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = s.c;
          ctx.globalAlpha = light ? 0.35 : 0.22;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      for (const s of cells) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;
        if (s.y < -40) {
          s.y = h + 40;
          s.x = Math.random() * w;
        }
        if (s.x < -40) s.x = w + 40;
        if (s.x > w + 40) s.x = -40;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function startStop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      if (!reduced() && !document.hidden) loop();
      else draw();
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", startStop);
    reduceMQ.addEventListener && reduceMQ.addEventListener("change", startStop);
    resize();
    startStop();
  }

  // ---------------- كونفيتي ----------------
  function makeOverlay() {
    let cv = document.getElementById("fxOverlay");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.id = "fxOverlay";
      cv.setAttribute("aria-hidden", "true");
      cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:200;";
      document.body.appendChild(cv);
    }
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    return cv;
  }

  const COLORS = [...PALETTE, "#ffffff"];

  function confettiBurst(x, y, amount, power = 1) {
    if (reduced()) return () => {};
    const cv = makeOverlay();
    const ctx = cv.getContext("2d");
    const parts = [];
    for (let i = 0; i < amount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 7 + 3) * power;
      parts.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 4,
        size: Math.random() * 8 + 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        shape: Math.random() > 0.5 ? "hex" : "rect",
      });
    }

    let running = true;
    function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive++;
        p.vy += 0.18;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.009;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        if (p.shape === "hex") {
          hexPath(ctx, p.x, p.y, p.size / 2, p.rot);
          ctx.fill();
        } else {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.5);
        }
        ctx.restore();
      }
      if (alive > 0 && running) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    }
    tick();
    return () => (running = false);
  }

  // احتفال الفوز
  function celebrate(duration = 4000) {
    if (reduced()) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    confettiBurst(0, H * 0.4, 80, 1.4);
    confettiBurst(W, H * 0.4, 80, 1.4);
    confettiBurst(W / 2, H * 0.2, 60, 1.2);
    const end = Date.now() + duration;
    (function rain() {
      confettiBurst(Math.random() * W, -10, 14, 0.8);
      if (Date.now() < end) setTimeout(rain, 340);
    })();
  }

  return { starfield, confettiBurst, celebrate };
})();
