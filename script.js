/* NebulaFX — page d'accueil */
(() => {
  const N = window.NFX;
  const { reduce, esc, icon, t, highlightLua, observe, start, splitWords } = N;

  const CAT_ICON = { Combat: "swords", Magic: "wand-sparkles", Fire: "flame", Nature: "leaf", SciFi: "atom", UI: "star", Learning: "graduation-cap", Lightweight: "feather" };

  /* ---------- Titres ---------- */
  const heroTitle = document.getElementById("heroTitle");
  const splitAll = () => {
    splitWords(heroTitle, 0.25, 0.07);
    document.querySelectorAll("h2[data-split]").forEach((h) => splitWords(h, 0, 0.05));
  };

  /* ---------- Code (commentaires traduits) ---------- */
  const SNIPPETS = [
    { file: "StarterPlayerScripts", code: () => `local Nebula = require(game.ReplicatedStorage.NebulaFX.Runtime)
local hrp = player.Character:WaitForChild("HumanoidRootPart")

-- ${t("code.c1")}
local aura = Nebula.Spawn("Aura", {
	Attach = hrp,
	AutoDestroy = false,
	User = { Tint = Color3.new(0.8, 0.7, 1) },
})

-- ${t("code.c2")}
aura:SetUser("Charge", 0.8)
aura:Stop() -- ${t("code.c3")}` },
    { file: "ServerScriptService", code: () => `local Nebula = require(game.ReplicatedStorage.NebulaFX.Runtime)
Nebula.EnableNetworking()

-- ${t("code.c4")}
Nebula.PlayForAll("Explosion", CFrame.new(pos), { Size = 2 })

-- ${t("code.c5")}
Nebula.PlayFor(player, "LevelUp", hrp.CFrame)` },
    { file: "LocalScript", code: () => `-- ${t("code.c6")}
Nebula.Spawn("Impacts", { AutoDestroy = false })

-- ${t("code.c7")}
Nebula.WriteChannel("Impacts",
	result.Position,
	result.Normal,
	Color3.new(1, 0.6, 0.2))` },
  ];
  const panes = document.getElementById("panes");
  const tabs = [...document.querySelectorAll(".tab")];
  const pill = document.getElementById("tabPill");
  const file = document.getElementById("file");
  let tab = 0;
  const renderCode = () => {
    panes.innerHTML = SNIPPETS.map((s, i) =>
      `<pre class="code-pane${i === tab ? " on" : ""}">${highlightLua(s.code()).split("\n").map((l, j) => `<span class="ln" style="--i:${j}">${l || " "}</span>`).join("\n")}</pre>`).join("");
  };
  const movePill = () => {
    const b = tabs[tab];
    pill.style.width = b.offsetWidth + "px";
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  tabs.forEach((b, i) => b.addEventListener("click", () => {
    tab = i;
    tabs.forEach((x, j) => x.classList.toggle("on", j === i));
    panes.querySelectorAll(".code-pane").forEach((p, j) => p.classList.toggle("on", j === i));
    file.textContent = SNIPPETS[i].file;
    movePill();
  }));
  addEventListener("resize", movePill);

  /* ---------- Modèles (défilé) ---------- */
  const marquee = document.getElementById("marquee");
  const renderMarquee = (D) => {
    if (!D) return;
    const list = D.templates.filter((x) => x.cat !== "Learning" || !/^Empty/.test(x.label));
    const rows = [[], [], []];
    list.forEach((x, i) => rows[i % 3].push(x));
    marquee.innerHTML = rows.map((items, r) => {
      const chips = (hidden) => items.map((x) =>
        `<span class="chip"${hidden ? ' aria-hidden="true"' : ""}>${icon(CAT_ICON[x.cat] || "sparkles")}${esc(x.label)}<small>${esc(x.catLabel)}</small></span>`).join("");
      return `<div class="row${r % 2 ? " rev" : ""}" style="--dur:${80 + r * 16}s">${chips(false)}${chips(true)}</div>`;
    }).join("");
  };

  /* ---------- Compteurs ---------- */
  const setCounts = (D) => {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const v = D && D.stats[el.dataset.count];
      if (v) el.textContent = v;
    });
  };
  const animateCount = (el) => {
    const target = parseInt(el.textContent, 10);
    if (!target || reduce) return;
    const t0 = performance.now(), dur = 1800;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const stats = document.querySelector(".stats");
  if ("IntersectionObserver" in window) {
    const so = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { stats.querySelectorAll("b").forEach(animateCount); so.disconnect(); }
    }, { threshold: 0.4 });
    so.observe(stats);
  }

  /* ---------- Particules de la tuile GPU ---------- */
  const particles = document.getElementById("particles");
  if (particles && !reduce) {
    let html = "";
    for (let i = 0; i < 28; i++) {
      html += `<i style="left:${(Math.random() * 100).toFixed(1)}%;--t:${(2.4 + Math.random() * 2.6).toFixed(2)}s;--dl:${(-Math.random() * 5).toFixed(2)}s;--x:${(Math.random() * 30 - 15).toFixed(0)}px"></i>`;
    }
    particles.innerHTML = html;
  }

  /* ---------- Rendu dépendant de la langue ---------- */
  const renderLang = (D, split = true) => {
    document.title = "NebulaFX";
    if (split) splitAll();
    setCounts(D);
    renderCode();
    renderMarquee(D);
    requestAnimationFrame(movePill);
  };

  splitAll(); // tout de suite, pour éviter un flash du titre avant l'animation
  N.loadDocs(N.lang).catch(() => null).then((D) => {
    renderLang(D, false);
    start(() => {
      heroTitle.classList.add("on");
      observe();
      movePill();
    });
  });

  N.onLang((lg) => {
    renderLang(window.NEBULA_DOCS && window.NEBULA_DOCS[lg]);
    heroTitle.classList.remove("on");
    void heroTitle.offsetWidth;
    requestAnimationFrame(() => heroTitle.classList.add("on"));
  });

  if (reduce) return;

  /* ---------- Défilement fluide (Lenis) ---------- */
  if (window.Lenis) {
    const lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    const loop = (time) => { lenis.raf(time); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -70, duration: 1.5 });
    }));
  }

  /* ---------- Scroll : le texte du hero s'efface, la carte se pose ---------- */
  const heroCopy = document.getElementById("heroCopy");
  const stageScroll = document.getElementById("stageScroll");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const h = innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / (h * 0.75)));
      heroCopy.style.opacity = (1 - p * 1.1).toFixed(3);
      heroCopy.style.transform = `translateY(${(-p * 60).toFixed(1)}px) scale(${(1 - p * 0.04).toFixed(4)})`;
      heroCopy.style.filter = p > 0.01 ? `blur(${(p * 8).toFixed(2)}px)` : "";
      const q = Math.min(1, Math.max(0, scrollY / (h * 1.1)));
      stageScroll.style.transform = `perspective(1600px) rotateX(${(q * 6).toFixed(2)}deg) scale(${(1 - q * 0.05).toFixed(4)})`;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Tilt 3D de la carte ---------- */
  const stage = document.getElementById("stage");
  const card = document.getElementById("card");
  const lerp = (a, b, k) => a + (b - a) * k;
  const s = { x: 0, y: 0, tx: 0, ty: 0, mx: 50, my: 0, tmx: 50, tmy: 0, h: 0, th: 0 };
  let visible = true;
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    s.tx = x - 0.5; s.ty = y - 0.5; s.tmx = x * 100; s.tmy = y * 100; s.th = 1;
  });
  stage.addEventListener("pointerleave", () => { s.tx = 0; s.ty = 0; s.th = 0; });
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);
  const tick = () => {
    if (visible) {
      s.x = lerp(s.x, s.tx, 0.07); s.y = lerp(s.y, s.ty, 0.07);
      s.mx = lerp(s.mx, s.tmx, 0.12); s.my = lerp(s.my, s.tmy, 0.12);
      s.h = lerp(s.h, s.th, 0.06);
      card.style.setProperty("--rx", (-s.y * 3).toFixed(3) + "deg");
      card.style.setProperty("--ry", (s.x * 4).toFixed(3) + "deg");
      card.style.setProperty("--mx", s.mx.toFixed(2) + "%");
      card.style.setProperty("--my", s.my.toFixed(2) + "%");
      card.style.setProperty("--hover", s.h.toFixed(3));
      card.style.setProperty("--px", (-s.x * 16).toFixed(2));
      card.style.setProperty("--py", (-s.y * 12).toFixed(2));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
