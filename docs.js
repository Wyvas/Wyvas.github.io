/* NebulaFX — documentation : rendu des pages, recherche, explorateur de modules */
(() => {
  const N = window.NFX;
  const { reduce, esc, icon, t, start } = N;
  const $ = (s, r = document) => r.querySelector(s);

  const PAGE_ICON = {
    welcome: "sparkles", "simple-mode": "wand-sparkles", install: "download", quickstart: "zap",
    concepts: "boxes", frame: "refresh-cw", params: "sliders-horizontal", spaces: "globe",
    "ui-overview": "layout-dashboard", "ui-windows": "app-window", "ui-graph": "workflow", "ui-inspector": "settings-2",
    curves: "spline", timeline: "clock", scratch: "puzzle", debug: "bug", library: "library", shortcuts: "keyboard",
    expressions: "sigma", recipes: "chef-hat", events: "arrow-left-right", gpu: "cpu", templates: "layout-template",
    browser: "layout-grid", visuals: "image", "sim-stages": "repeat", "ref-modules": "list", "ref-renderers": "aperture",
    "ref-attributes": "circle-dot", "ref-nodes": "network", "game-setup": "gamepad-2", api: "braces",
    network: "radio-tower", performance: "gauge", faq: "circle-help", limits: "triangle-alert", glossary: "book-open",
  };
  // Symboles des boutons du plugin cités dans le texte → icônes
  const GLYPHS = [
    ["|◀", "skip-back"], ["▶|", "skip-forward"], ["💾", "save"], ["⇪", "upload"], ["👁", "eye"], ["✨", "sparkles"],
    ["🎮", "gamepad-2"], ["🎲", "dices"], ["◆", "diamond"], ["✚", "plus"], ["⤢", "maximize-2"], ["↶", "undo-2"],
    ["↷", "redo-2"], ["↺", "undo-2"], ["⌗", "magnet"], ["☀", "sun"], ["⟳", "repeat"], ["◢", "move-diagonal-2"],
    ["✕", "x"], ["⋮", "ellipsis-vertical"], ["⚙", "settings"], ["▶", "play"], ["▸", "arrow-right"],
  ];
  const GLYPH_RE = new RegExp(GLYPHS.map(([g]) => g.replace(/[|]/g, "\\|")).join("|"), "gu");
  const GLYPH_MAP = Object.fromEntries(GLYPHS);

  let D = null, pages = [], byId = {}, modById = {}, ordered = [];
  const setData = (data) => {
    D = data;
    pages = D.pages;
    byId = Object.fromEntries(pages.map((p) => [p.id, p]));
    modById = Object.fromEntries(D.modules.map((m) => [m.id, m]));
    ordered = D.groups.flatMap((g) => pages.filter((p) => p.group === g));
  };

  const sidebar = $("#sidebar"), sbNav = $("#sbNav"), sbInd = $("#sbIndicator");
  const doc = $("#doc"), toc = $("#toc"), scrim = $("#scrim"), menuBtn = $("#menuBtn");

  /* ---------- Texte enrichi ---------- */
  const CODE_RE = /\b((?:Nebula|fx|User|System|Emitter|Particles|Engine|ReplicatedStorage|ServerStorage|workspace|SimStage|Enum)[.:]\w[\w.:]*(?:\([^)]*\))?|rbx\w*:\/\/[^\s,)]+)/g;
  const inline = (txt) => esc(txt)
    .replace(CODE_RE, (m) => { const c = m.replace(/[.,;:]+$/, ""); return `<code>${c}</code>${m.slice(c.length)}`; })
    .replace(GLYPH_RE, (g) => `<span class="ii">${icon(GLYPH_MAP[g])}</span>`)
    .replace(/\n/g, "<br>");
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = (s) => norm(s).replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "");

  const MONO_FIRST = /^(nom|name|option|m[ée]thode|method|fonction|function|node|r[ée]glage|setting|cl[ée]|key|namespace|op[ée]rateur|operator|backend|interpolation)/i;

  const renderTable = (cols, rows) =>
    `<div class="table-wrap"><table${MONO_FIRST.test(cols[0]) ? ' class="mono"' : ""}><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${
      rows.map((r) => `<tr>${r.map((c) => `<td>${inline(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  const renderBlock = (b, ctx) => {
    const [k, a, c] = b;
    switch (k) {
      case "h": {
        let id = slug(a) || "s";
        while (ctx.ids.has(id)) id += "-";
        ctx.ids.add(id); ctx.heads.push({ id, text: a });
        return `<h2 id="${id}">${inline(a)}<span class="hash" aria-hidden="true">#</span></h2>`;
      }
      case "p": return `<p>${inline(a)}</p>`;
      case "list": return `<ul>${a.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`;
      case "steps": return `<ol class="steps">${a.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`;
      case "tip": return `<div class="callout tip"><span class="ci">${icon("lightbulb")}</span><div>${inline(a.replace(/^(Astuce|Tip|Tipp|Dica|Consejo|提示)\s*[:：]\s*/, ""))}</div></div>`;
      case "warn": return `<div class="callout warn"><span class="ci">${icon("triangle-alert")}</span><div>${inline(a)}</div></div>`;
      case "code": {
        const lua = /local |Nebula|--|\(|=/.test(a);
        return `<div class="codeblock"><pre><code>${lua ? N.highlightLua(a) : esc(a)}</code></pre><button class="copy" type="button">${icon("copy")}<span>${esc(t("d.copy"))}</span></button></div>`;
      }
      case "table": return renderTable(a, c);
      case "link": return `<a class="link-card" href="#${esc(c)}"><span>${inline(a)}</span>${icon("arrow-right")}</a>`;
      case "modules": return `<p>${esc(t("d.modIntro", { n: D.modules.length }))}</p>${renderModules()}`;
      default: return "";
    }
  };

  /* ---------- Explorateur de modules ---------- */
  const renderModules = () => {
    const cats = [...new Set(D.modules.map((m) => m.cat))];
    return `<div class="mods" id="mods">
      <div class="mods-bar">
        <label class="mods-filter">${icon("search")}
          <input id="modq" type="search" placeholder="${esc(t("d.modFilter"))}" autocomplete="off" spellcheck="false">
          <small id="modcount">${esc(t("d.modCount", { n: D.modules.length }))}</small>
        </label>
        <div class="chips" id="modchips">
          <button class="fchip on" data-cat="">${esc(t("d.modAll"))}</button>
          ${cats.map((c) => `<button class="fchip" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
      </div>
      ${cats.map((c) => `<section class="mods-group" data-cat="${esc(c)}"><div class="mods-cat">${esc(c)}</div>
        ${D.modules.filter((m) => m.cat === c).map((m) => `<div class="mod" id="mod-${esc(m.id)}" data-id="${esc(m.id)}">
          <button class="mod-head" aria-expanded="false">
            <span class="mod-name">${esc(m.name)}<code>${esc(m.id)}</code></span>
            <span class="mod-desc">${inline(m.desc || "—")}</span>
            <span class="chev">${icon("chevron-down")}</span>
          </button>
          <div class="mod-body"><div><div class="mod-inner">
            <div class="mod-meta"><span class="tag cat">${esc(m.cat)}</span>${m.stages.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>
            ${m.inputs.length ? renderTable(D.headers, m.inputs) : ""}
          </div></div></div>
        </div>`).join("")}</section>`).join("")}
      <div class="mods-empty" id="modempty" hidden>${esc(t("d.modNone"))}</div>
    </div>`;
  };
  const toggleMod = (el, force) => {
    const open = force ?? !el.classList.contains("open");
    el.classList.toggle("open", open);
    el.querySelector(".mod-head").setAttribute("aria-expanded", open);
  };
  const bindModules = () => {
    const root = $("#mods");
    if (!root) return;
    const q = $("#modq"), count = $("#modcount"), empty = $("#modempty");
    const hay = Object.fromEntries(D.modules.map((m) => [m.id, norm([m.name, m.id, m.desc, m.cat, ...m.inputs.map((i) => i.join(" "))].join(" "))]));
    let cat = "";
    const apply = () => {
      const terms = norm(q.value.trim()).split(/\s+/).filter(Boolean);
      let n = 0;
      root.querySelectorAll(".mods-group").forEach((g) => {
        let shown = 0;
        g.querySelectorAll(".mod").forEach((el) => {
          const ok = (!cat || g.dataset.cat === cat) && terms.every((x) => hay[el.dataset.id].includes(x));
          el.hidden = !ok; if (ok) shown++;
        });
        g.hidden = !shown; n += shown;
      });
      count.textContent = t(n === 1 ? "d.modCount1" : "d.modCount", { n });
      empty.hidden = n > 0;
    };
    q.addEventListener("input", apply);
    root.querySelector("#modchips").addEventListener("click", (e) => {
      const b = e.target.closest(".fchip"); if (!b) return;
      cat = b.dataset.cat;
      root.querySelectorAll(".fchip").forEach((x) => x.classList.toggle("on", x === b));
      apply();
    });
    root.addEventListener("click", (e) => { const h = e.target.closest(".mod-head"); if (h) toggleMod(h.parentElement); });
  };

  /* ---------- Sidebar ---------- */
  const renderSidebar = () => {
    sbNav.innerHTML = D.groups.map((g) => {
      const list = pages.filter((p) => p.group === g);
      return list.length ? `<div class="sb-group"><div class="sb-title">${esc(g)}</div>${
        list.map((p) => `<a class="sb-link" href="#${p.id}" data-id="${p.id}">${icon(PAGE_ICON[p.id] || "file-code")}<span>${esc(p.title)}</span></a>`).join("")}</div>` : "";
    }).join("");
  };
  const moveIndicator = (instant) => {
    const a = sbNav.querySelector(".sb-link.active");
    sidebar.classList.toggle("has-active", !!a);
    if (!a) return;
    if (instant) sbInd.style.transition = "none";
    sbInd.style.transform = `translateY(${a.offsetTop}px)`;
    sbInd.style.height = a.offsetHeight + "px";
    if (instant) { void sbInd.offsetWidth; sbInd.style.transition = ""; }
  };
  const setDrawer = (open) => {
    sidebar.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
    menuBtn.setAttribute("aria-expanded", open);
  };
  menuBtn.addEventListener("click", () => setDrawer(!sidebar.classList.contains("open")));
  scrim.addEventListener("click", () => setDrawer(false));

  /* ---------- Rendu d'une page ---------- */
  let current = null, spy = null;
  const buildPage = (p) => {
    const ctx = { ids: new Set(), heads: [] };
    const body = p.blocks.map((b) => renderBlock(b, ctx)).join("");
    const i = ordered.indexOf(p), prev = ordered[i - 1], next = ordered[i + 1];
    const ic = PAGE_ICON[p.id] || "file-code";
    return {
      heads: ctx.heads,
      html: `
      <div class="crumb">${esc(t("d.crumb"))} ${icon("arrow-right")} ${esc(p.group)}</div>
      <h1><span class="h-ico">${icon(ic, "draw")}</span>${esc(p.title)}</h1>
      <div class="head-rule"></div>
      ${body}
      <nav class="pager">
        ${prev ? `<a class="prev" href="#${prev.id}"><small>${icon("arrow-left")} ${esc(t("d.prev"))}</small><span>${esc(prev.title)}</span></a>` : ""}
        ${next ? `<a class="next" href="#${next.id}"><small>${esc(t("d.next"))} ${icon("arrow-right")}</small><span>${esc(next.title)}</span></a>` : ""}
      </nav>`,
    };
  };

  const renderToc = (heads) => {
    toc.classList.remove("has-on");
    toc.innerHTML = heads.length
      ? `<div class="toc-inner"><div class="toc-title">${icon("list")}${esc(t("d.onpage"))}</div><span class="toc-marker" id="tocMarker"></span>${
        heads.map((h) => `<a href="#${current}/${h.id}" data-target="${h.id}">${esc(h.text)}</a>`).join("")}</div>`
      : "";
    if (spy) spy.disconnect();
    if (!heads.length || !("IntersectionObserver" in window)) return;
    const links = Object.fromEntries([...toc.querySelectorAll("a")].map((a) => [a.dataset.target, a]));
    const marker = $("#tocMarker");
    const visible = new Map();
    spy = new IntersectionObserver((es) => {
      es.forEach((e) => visible.set(e.target.id, e.isIntersecting));
      const first = heads.find((h) => visible.get(h.id));
      if (!first) return;
      Object.values(links).forEach((a) => a.classList.toggle("on", a === links[first.id]));
      const a = links[first.id];
      marker.style.transform = `translateY(${a.offsetTop}px)`;
      marker.style.height = a.offsetHeight + "px";
      toc.classList.add("has-on");
    }, { rootMargin: `-70px 0px -65% 0px` });
    heads.forEach((h) => { const el = document.getElementById(h.id); el && spy.observe(el); });
  };

  const show = (id, focus, force) => {
    const p = byId[id] || byId.welcome;
    const same = current === p.id && !force;
    current = p.id;
    sbNav.querySelectorAll(".sb-link").forEach((a) => a.classList.toggle("active", a.dataset.id === p.id));
    moveIndicator(force);
    const active = sbNav.querySelector(".sb-link.active");
    if (active && !same && innerWidth > 960) active.scrollIntoView({ block: "nearest" });
    document.title = `${p.title} · NebulaFX`;
    setDrawer(false);

    const after = () => {
      if (!focus) return;
      const el = document.getElementById(focus);
      if (!el) return;
      if (el.classList.contains("mod")) {
        toggleMod(el, true);
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1600);
      }
      setTimeout(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 80);
    };
    if (same) { after(); return; }

    const swap = () => {
      const { html, heads } = buildPage(p);
      doc.innerHTML = html;
      [...doc.children].forEach((el, i) => el.style.setProperty("--i", i));
      doc.querySelectorAll("svg.draw").forEach(N.prepDraw);
      bindModules();
      renderToc(heads);
      if (!force) scrollTo({ top: 0, behavior: "auto" });
      doc.classList.remove("leaving", "enter");
      if (!reduce) { void doc.offsetWidth; doc.classList.add("enter"); }
      after();
      onScroll();
    };
    if (reduce || !doc.innerHTML || force) { swap(); return; }
    doc.classList.add("leaving");
    setTimeout(swap, 180);
  };

  const route = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith("mod-") && modById[h.slice(4)]) return show("ref-modules", h);
    const [pid, anchor] = h.split("/");
    show(byId[pid] ? pid : "welcome", anchor);
  };
  addEventListener("hashchange", route);

  toc.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-target]"); if (!a) return;
    e.preventDefault();
    history.replaceState(null, "", a.getAttribute("href"));
    document.getElementById(a.dataset.target)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });
  doc.addEventListener("click", (e) => {
    if (e.target.classList.contains("hash")) {
      const h2 = e.target.closest("h2");
      history.replaceState(null, "", `#${current}/${h2.id}`);
      h2.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      return;
    }
    const btn = e.target.closest(".copy"); if (!btn) return;
    const text = btn.previousElementSibling.textContent;
    const done = () => {
      btn.innerHTML = `${icon("check")}<span>${esc(t("d.copied"))}</span>`; btn.classList.add("ok");
      setTimeout(() => { btn.innerHTML = `${icon("copy")}<span>${esc(t("d.copy"))}</span>`; btn.classList.remove("ok"); }, 1400);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  });

  /* ---------- Progression de lecture ---------- */
  const progress = $("#progress");
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => moveIndicator(true));

  /* ---------- Recherche ---------- */
  let index = [];
  const blockText = (b) => {
    const [k, a, c] = b;
    if (k === "list" || k === "steps") return a.join(" ");
    if (k === "table") return a.join(" ") + " " + c.map((r) => r.join(" ")).join(" ");
    return typeof a === "string" ? a : "";
  };
  const buildIndex = () => {
    index = [
      ...pages.map((p) => ({ href: "#" + p.id, title: p.title, icon: PAGE_ICON[p.id] || "file-code", group: p.group, raw: p.blocks.map(blockText).join(" · ") })),
      ...D.modules.map((m) => ({ href: "#mod-" + m.id, title: m.name, icon: "box", group: t("d.module") + " · " + m.cat, raw: [m.desc, m.inputs.map((i) => i[0]).join(", ")].join(" · ") })),
    ].map((e) => ({ ...e, tn: norm(e.title), rn: norm(e.raw) }));
  };

  const palette = $("#palette"), q = $("#q"), results = $("#results");
  let sel = 0, hits = [];
  const snippet = (raw, rn, terms) => {
    const pos = terms.map((x) => rn.indexOf(x)).filter((x) => x >= 0).sort((a, b) => a - b)[0];
    if (pos === undefined) return esc(raw.slice(0, 120));
    const s = Math.max(0, pos - 40);
    let piece = esc((s ? "…" : "") + raw.slice(s, s + 150));
    terms.forEach((x) => {
      const pat = x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/e/g, "[eéèêë]").replace(/a/g, "[aàâä]").replace(/i/g, "[iîï]").replace(/o/g, "[oôö]").replace(/u/g, "[uùûü]").replace(/c/g, "[cç]");
      piece = piece.replace(new RegExp(`(${pat})`, "gi"), "<mark>$1</mark>");
    });
    return piece;
  };
  const search = () => {
    const terms = norm(q.value.trim()).split(/\s+/).filter(Boolean);
    if (!terms.length) hits = ordered.slice(0, 8).map((p) => index.find((e) => e.href === "#" + p.id));
    else {
      hits = index.map((e) => {
        if (!terms.every((x) => e.tn.includes(x) || e.rn.includes(x))) return null;
        let score = 0;
        terms.forEach((x) => { score += e.tn.startsWith(x) ? 12 : e.tn.includes(x) ? 6 : 0; score += Math.min(3, e.rn.split(x).length - 1); });
        if (e.href.startsWith("#mod-")) score -= 1;
        return { e, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30).map((x) => x.e);
    }
    sel = 0;
    results.innerHTML = hits.length
      ? hits.map((e, i) => `<a class="res${i === 0 ? " on" : ""}" href="${e.href}" role="option" data-i="${i}" style="--i:${i}">
          <div class="res-top">${icon(e.icon)}${esc(e.title)}<small>${esc(e.group)}</small></div>
          <p>${snippet(e.raw, e.rn, terms)}</p></a>`).join("")
      : `<div class="res-empty">${esc(t("d.noResult", { q: q.value }))}</div>`;
  };
  const highlight = (i) => {
    const items = results.querySelectorAll(".res");
    if (!items.length) return;
    sel = (i + items.length) % items.length;
    items.forEach((el, j) => el.classList.toggle("on", j === sel));
    items[sel].scrollIntoView({ block: "nearest" });
  };
  const openPalette = () => {
    palette.hidden = false;
    requestAnimationFrame(() => palette.classList.add("show"));
    q.value = ""; search();
    setTimeout(() => q.focus(), 20);
  };
  const closePalette = () => {
    palette.classList.remove("show");
    setTimeout(() => { palette.hidden = true; }, reduce ? 0 : 250);
  };
  $("#searchBtn").addEventListener("click", openPalette);
  q.addEventListener("input", search);
  palette.addEventListener("click", (e) => { if (e.target === palette || e.target.closest(".res")) closePalette(); });
  results.addEventListener("pointermove", (e) => { const r = e.target.closest(".res"); if (r && +r.dataset.i !== sel) highlight(+r.dataset.i); });
  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
      e.preventDefault(); palette.hidden ? openPalette() : closePalette(); return;
    }
    if (palette.hidden) { if (e.key === "Escape") setDrawer(false); return; }
    if (e.key === "Escape") closePalette();
    else if (e.key === "ArrowDown") { e.preventDefault(); highlight(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(sel - 1); }
    else if (e.key === "Enter") {
      const h = hits[sel];
      if (h) { e.preventDefault(); closePalette(); if (location.hash === h.href) route(); else location.hash = h.href; }
    }
  });

  /* ---------- Démarrage + changement de langue ---------- */
  const init = (data, keepScroll) => {
    setData(data);
    renderSidebar();
    buildIndex();
    const y = scrollY;
    current = null;
    const h = decodeURIComponent(location.hash.slice(1));
    const [pid] = h.split("/");
    if (h.startsWith("mod-") && modById[h.slice(4)]) show("ref-modules", keepScroll ? null : h, true);
    else show(byId[pid] ? pid : "welcome", keepScroll ? null : h.split("/")[1], true);
    if (keepScroll) scrollTo({ top: y, behavior: "auto" });
  };

  N.loadDocs(N.lang).then((data) => {
    init(data);
    start(() => moveIndicator(true));
  });
  N.onLang((lg) => init(window.NEBULA_DOCS[lg], true));
})();
