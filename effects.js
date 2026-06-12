/* ===========================================================
   لَمة — محرك المؤثرات البصرية
   خلفية نجوم متحركة + كونفيتي + ألعاب نارية (Canvas، بدون مكتبات)
   =========================================================== */

const FX = (() => {
  // ---------------- خلفية النجوم المتحركة ----------------
  function starfield(canvasId) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let stars = [];
    let w, h;

    function resize() {
      w = cv.width = window.innerWidth;
      h = cv.height = window.innerHeight;
      const count = Math.min(160, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2, // عمق
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2, // لمعان
      }));
    }
    window.addEventListener("resize", resize);
    resize();

    let t = 0;
    function loop() {
      t += 0.015;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.z * 0.25; // انجراف بطيء للأسفل
        if (s.y > h) {
          s.y = 0;
          s.x = Math.random() * w;
        }
        const alpha = 0.35 + 0.45 * Math.sin(s.tw + t * s.z * 3);
        const glow = s.z > 0.75; // نجوم ذهبية لامعة أحياناً
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = glow
          ? `rgba(255, 180, 107, ${alpha})`
          : `rgba(200, 215, 255, ${alpha * 0.8})`;
        ctx.shadowBlur = glow ? 8 : 0;
        ctx.shadowColor = "rgba(255,180,107,0.8)";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(loop);
    }
    loop();
  }

  // ---------------- كونفيتي + ألعاب نارية ----------------
  function makeOverlay() {
    let cv = document.getElementById("fxOverlay");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.id = "fxOverlay";
      cv.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:200;";
      document.body.appendChild(cv);
    }
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    return cv;
  }

  const COLORS = ["#ff7a47", "#ffb46b", "#3aa0ff", "#ff5d73", "#34d399", "#ffffff", "#a78bfa"];

  function confettiBurst(x, y, amount, power = 1) {
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
        size: Math.random() * 8 + 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        shape: Math.random() > 0.5 ? "rect" : "circ",
      });
    }

    let running = true;
    function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive++;
        p.vy += 0.18; // جاذبية
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.008;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0 && running) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    }
    tick();
    return () => (running = false);
  }

  // عرض احتفالي: رشقات متتالية + ألعاب نارية
  function celebrate(duration = 4500) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // رشقتان من الجانبين
    confettiBurst(0, H * 0.4, 90, 1.4);
    confettiBurst(W, H * 0.4, 90, 1.4);
    confettiBurst(W / 2, H * 0.2, 70, 1.2);

    const end = Date.now() + duration;
    (function rain() {
      confettiBurst(Math.random() * W, -10, 16, 0.8);
      if (Date.now() < end) setTimeout(rain, 320);
    })();
  }

  return { starfield, confettiBurst, celebrate };
})();
