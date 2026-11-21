/* NebulaFX — socle partagé : icônes, logo, langues, navigation, animations */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const ICONS = window.NFX_ICONS || {};
  const UI = window.NFX_UI || {};
  const LANGS = window.NFX_LANGS || [];

  const esc = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- Icônes (Lucide) ---------- */
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const hydrateIcons = (root = document) => {
    root.querySelectorAll("i[data-icon]").forEach((el) => {
      const tmp = document.createElement("span");
      tmp.innerHTML = icon(el.dataset.icon, el.className);
      const svg = tmp.firstElementChild;
      if (el.hasAttribute("data-draw")) prepDraw(svg);
      el.replaceWith(svg);
    });
  };
  // Prépare un tracé « dessiné » : chaque forme reçoit pathLength=1 pour animer stroke-dashoffset
  const prepDraw = (svg) => {
    svg.classList.add("draw");
    svg.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse").forEach((s) => s.setAttribute("pathLength", "1"));
  };

  /* ---------- Logo : grande étoile + petite étoile pivotée, bande de brillance ---------- */
  let logoN = 0;
  const star = (cx, cy, r, k = 0.16) => {
    const c = r * k;
    return `M${cx} ${cy - r}Q${cx + c} ${cy - c} ${cx + r} ${cy}Q${cx + c} ${cy + c} ${cx} ${cy + r}Q${cx - c} ${cy + c} ${cx - r} ${cy}Q${cx - c} ${cy - c} ${cx} ${cy - r}Z`;
  };
  const BIG = star(13, 19, 12);
  const SMALL = star(25.5, 6.5, 5.4, 0.18);
  const SMALL_T = "rotate(22 25.5 6.5)";
  const logo = () => {
    const id = "nfxl" + ++logoN;
    return `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#efe9ff"/><stop offset=".55" stop-color="#c7b6ff"/><stop offset="1" stop-color="#9f88f2"/>
        </linearGradient>
        <linearGradient id="${id}s" x1="0" x2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="${id}c"><path d="${BIG}"/><path d="${SMALL}" transform="${SMALL_T}"/></clipPath>
      </defs>
      <g fill="url(#${id}g)"><path d="${BIG}"/><path d="${SMALL}" transform="${SMALL_T}"/></g>
      <g clip-path="url(#${id}c)"><rect class="logo-shine" x="-16" y="-6" width="9" height="44" fill="url(#${id}s)"/></g>
    </svg>`;
  };
  document.querySelectorAll("[data-logo]").forEach((el) => { el.innerHTML = logo(); });
  // Favicon
  const fav = document.createElement("link");
  fav.rel = "icon";
  fav.href = "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe9ff"/><stop offset="1" stop-color="#a48cf5"/></linearGradient></defs><g fill="url(#g)"><path d="${BIG}"/><path d="${SMALL}" transform="${SMALL_T}"/></g></svg>`);
  document.head.append(fav);

  /* ---------- Langues ---------- */
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  const detect = () => {
    const saved = store.get("nfx-lang");
    if (saved && UI[saved]) return saved;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return UI[nav] ? nav : "fr";
  };
  let lang = detect();
  const t = (key, vars) => {
    let s = (UI[lang] && UI[lang][key]) ?? (UI.fr && UI.fr[key]) ?? key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  };

  const loaded = {};
  const loadDocs = (lg) => {
    window.NEBULA_DOCS = window.NEBULA_DOCS || {};
    if (window.NEBULA_DOCS[lg]) return Promise.resolve(window.NEBULA_DOCS[lg]);
    if (!loaded[lg]) {
      loaded[lg] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = `data/docs.${lg}.js`;
        s.onload = () => res(window.NEBULA_DOCS[lg]);
        s.onerror = rej;
        document.head.append(s);
      });
    }
    return loaded[lg];
  };

  const applyUI = (root = document) => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        el.setAttribute(attr, t(key));
      });
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t("meta.desc");
    renderLangMenu();
  };

  /* Menu de langue */
  const langBox = document.getElementById("lang");
  const renderLangMenu = () => {
    if (!langBox) return;
    const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
    langBox.innerHTML = `
      <button class="lang-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(t("nav.lang"))}">
        ${icon("languages")}<span>${cur.short}</span>${icon("chevron-down", "chev-sm")}
      </button>
      <div class="lang-menu" role="listbox">
        ${LANGS.map((l, i) => `<button role="option" class="lang-opt${l.code === lang ? " on" : ""}" data-lang="${l.code}" style="--i:${i}">
          <b>${l.short}</b><span>${esc(l.name)}</span>${l.code === lang ? icon("check", "lang-check") : ""}</button>`).join("")}
      </div>`;
  };
  const closeLang = () => {
    if (!langBox) return;
    langBox.classList.remove("open");
    const b = langBox.querySelector(".lang-btn");
    b && b.setAttribute("aria-expanded", "false");
  };
  if (langBox) {
    langBox.addEventListener("click", (e) => {
      const opt = e.target.closest(".lang-opt");
      if (opt) { closeLang(); setLang(opt.dataset.lang); return; }
      if (e.target.closest(".lang-btn")) {
        const open = !langBox.classList.contains("open");
        langBox.classList.toggle("open", open);
        langBox.querySelector(".lang-btn").setAttribute("aria-expanded", open);
      }
    });
    document.addEventListener("click", (e) => { if (!langBox.contains(e.target)) closeLang(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") closeLang(); });
  }

  const listeners = [];
  const onLang = (fn) => listeners.push(fn);
  const setLang = async (lg) => {
    if (!UI[lg] || lg === lang) return;
    store.set("nfx-lang", lg);
    const main = document.querySelector("[data-lang-fade]");
    const fade = main && !reduce;
    const docsP = loadDocs(lg).catch(() => null);
    if (fade) {
      main.classList.add("lang-out");
      await new Promise((r) => setTimeout(r, 260));
    }
    await docsP;
    lang = lg;
    applyUI();
    listeners.forEach((fn) => fn(lang));
    if (fade) {
      main.classList.remove("lang-out");
      main.classList.add("lang-in");
      void main.offsetWidth;
      main.classList.remove("lang-in");
    }
  };

  /* ---------- Navigation ---------- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav && nav.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Pastille qui glisse sous les liens de navigation
  const links = document.querySelector(".nav-links");
  if (links && fine && !reduce) {
    const pill = document.createElement("span");
    pill.className = "nav-pill";
    links.prepend(pill);
    links.addEventListener("pointerover", (e) => {
      const a = e.target.closest("a"); if (!a) return;
      pill.style.width = a.offsetWidth + "px";
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
      links.classList.add("hovering");
    });
    links.addEventListener("pointerleave", () => links.classList.remove("hovering"));
  }

  /* ---------- Titres découpés en mots ---------- */
  const splitWords = (el, base = 0, step = 0.06) => {
    // à appeler sur un contenu « frais » (juste après applyUI) : on découpe le HTML courant
    const holder = document.createElement("div");
    holder.innerHTML = el.innerHTML;
    let i = 0;
    const wrap = (text) => {
      const frag = document.createDocumentFragment();
      // découpe par mots ; en chinois (pas d'espaces), par groupes de caractères
      const cjk = /[぀-ヿ㐀-鿿＀-￯]/.test(text) && !/\s/.test(text.trim());
      const parts = cjk ? text.match(/.{1,3}/gu) || [] : text.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const w = document.createElement("span");
        const s = document.createElement("span");
        w.className = "word";
        s.textContent = part;
        s.style.setProperty("--d", (base + i++ * step).toFixed(3) + "s");
        w.append(s);
        frag.append(w);
      });
      return frag;
    };
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) n.replaceWith(wrap(n.textContent));
        else if (n.nodeType === 1 && !n.matches("[data-count]")) walk(n);
        else if (n.nodeType === 1) {
          const w = document.createElement("span");
          w.className = "word";
          const s = document.createElement("span");
          s.style.setProperty("--d", (base + i++ * step).toFixed(3) + "s");
          n.replaceWith(w); s.append(n); w.append(s);
        }
      });
    };
    walk(holder);
    el.innerHTML = "";
    el.append(...holder.childNodes);
    el.setAttribute("aria-label", holder.textContent.trim());
  };

  /* ---------- Révélations au scroll ---------- */
  const io = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 })
    : null;
  const observe = (root = document) => {
    root.querySelectorAll(".r:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  };

  /* ---------- Halo de fond qui suit la souris ---------- */
  if (!reduce) {
    const root = document.documentElement;
    let gx = innerWidth / 2, gy = innerHeight * 0.4, tx = gx, ty = gy;
    addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    const tick = () => {
      if (Math.abs(tx - gx) > 0.3 || Math.abs(ty - gy) > 0.3) {
        gx += (tx - gx) * 0.05; gy += (ty - gy) * 0.05;
        root.style.setProperty("--gx", gx.toFixed(1) + "px");
        root.style.setProperty("--gy", gy.toFixed(1) + "px");
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Lumière sur les cartes ---------- */
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(".tile, .spotlight");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  /* ---------- Boutons magnétiques ---------- */
  if (fine && !reduce) {
    document.addEventListener("pointermove", (e) => {
      const b = e.target.closest && e.target.closest(".magnetic");
      document.querySelectorAll(".magnetic.pulled").forEach((x) => {
        if (x !== b) { x.classList.remove("pulled"); x.style.transform = ""; }
      });
      if (!b) return;
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.28;
      b.classList.add("pulled");
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }, { passive: true });
  }

  /* ---------- Démarrage ---------- */
  const start = (cb) => {
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.add("ready");
      cb && cb();
    }));
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 800))]).then(go);
  };

  /* Coloration Lua */
  const LUA = /(--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(local|function|end|if|then|else|elseif|return|for|in|do|while|repeat|until|not|and|or|true|false|nil)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)(?=\s*\()/g;
  const highlightLua = (src) => {
    let out = "", last = 0, m;
    LUA.lastIndex = 0;
    while ((m = LUA.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : m[4] ? "n" : "f";
      out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
      last = LUA.lastIndex;
    }
    return out + esc(src.slice(last));
  };

  hydrateIcons();
  applyUI();

  window.NFX = {
    reduce, fine, esc, icon, hydrateIcons, prepDraw, logo, t, observe, start, splitWords, highlightLua,
    loadDocs, onLang, setLang, applyUI,
    get lang() { return lang; },
  };
})();
