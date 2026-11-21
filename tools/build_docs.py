"""Génère data/docs.<langue>.js (contenu de la doc, traduit) à partir des scripts extraits du plugin.

Usage :
  python tools/extract.py assets/NebulaFX.rbxmx <dossier_extrait>
  python tools/build_docs.py <dossier_extrait> data

Les traductions viennent des packs de langue du plugin (Editor/Locales) : le texte français sert de clé.
"""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
rd = lambda f: open(os.path.join(SRC, f), encoding="utf-8").read()
LANGS = ["fr", "en", "zh", "es", "pt", "de"]

# ---------------------------------------------------------------- mini parseur Lua
TOK = re.compile(r'''
    (?P<ws>\s+|--[^\n]*)
  | (?P<str>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')
  | (?P<num>-?\d+(?:\.\d+)?)
  | (?P<concat>\.\.)
  | (?P<id>[A-Za-z_][A-Za-z_0-9.]*)
  | (?P<sym>[{}(),=])
''', re.X)
ESC = {"n": "\n", "t": "\t", '"': '"', "'": "'", "\\": "\\"}


def unq(s):
    return re.sub(r'\\(.)', lambda m: ESC.get(m.group(1), m.group(1)), s[1:-1])


def tokens(text, pos):
    while pos < len(text):
        m = TOK.match(text, pos)
        if not m:
            raise ValueError("token error at %d: %r" % (pos, text[pos:pos + 40]))
        pos = m.end()
        if m.lastgroup != "ws":
            yield m.lastgroup, m.group(), pos


GEN = object()


class Parser:
    def __init__(self, text, pos):
        self.it, self.peeked = tokens(text, pos), None

    def next(self):
        if self.peeked:
            t, self.peeked = self.peeked, None
            return t
        return next(self.it)

    def peek(self):
        if not self.peeked:
            self.peeked = next(self.it)
        return self.peeked

    def value(self):
        kind, txt, _ = self.next()
        if kind == "str":
            v = unq(txt)
            while self.peek()[0] == "concat":
                self.next()
                v += self.value()
            return v
        if kind == "num":
            return txt
        if kind == "sym" and txt == "{":
            out = []
            while True:
                if self.peek()[1] == "}":
                    self.next()
                    return out
                out.append(self.value())
                if self.peek()[1] == ",":
                    self.next()
        if (kind == "id" and txt == "function") or (kind == "sym" and txt == "("):
            return GEN
        return txt


# ---------------------------------------------------------------- traductions du plugin
keys = {}
for n, s in re.findall(r'^\t\[(\d+)\] = (".*"),\s*$', rd("NebulaFX_Editor_Locales_Keys.lua"), re.M):
    keys[unq(s)] = int(n)
packs = {"fr": None}
for lg in LANGS[1:]:
    packs[lg] = {int(n): unq(s) for n, s in re.findall(r'^\t\[(\d+)\] = (".*"),\s*$', rd(f"NebulaFX_Editor_Locales_{lg}.lua"), re.M)}

stats_tr = {lg: [0, 0] for lg in LANGS}


def make_L(lang):
    def L(s):
        if not isinstance(s, str) or lang == "fr" or not s.strip():
            return s
        stats_tr[lang][1] += 1
        i = keys.get(s)
        if i is not None and i in packs[lang]:
            stats_tr[lang][0] += 1
            return packs[lang][i]
        return s
    return L


# ---------------------------------------------------------------- pages statiques
docs_src = rd("NebulaFX_Editor_DocsContent.lua")
groups = Parser(docs_src, docs_src.index("C.Groups =") + len("C.Groups =")).value()
pages = []
for m in re.finditer(r'^page\(', docs_src, re.M):
    p = Parser(docs_src, m.end())
    args = []
    for _ in range(5):
        args.append(p.value())
        if p.peek()[1] == ",":
            p.next()
    pid, group, _icon, title, blocks = args
    pages.append({"id": pid, "group": group, "title": title, "blocks": None if blocks is GEN else blocks})

# ---------------------------------------------------------------- données de référence
docs = rd("NebulaFX_Editor_Docs.lua")


def kv(src, start):
    out = {}
    for m in re.finditer(start + r'\s*=\s*\{(.*?)\n\}', src, re.S):
        for k, v in re.findall(r'^\s*(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"', m.group(1), re.M):
            out[k] = unq('"' + v + '"')
    return out


doc_mods = kv(docs, r'Docs\.Modules')
for m in re.finditer(r'^local (\w+) = \{(.*?)\n\}', docs, re.S | re.M):
    for k, v in re.findall(r'^\s*(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"', m.group(2), re.M):
        doc_mods.setdefault(k, unq('"' + v + '"'))
doc_inputs = kv(docs, r'Docs\.Inputs')
for m in re.finditer(r'^local MORE_INPUTS = \{(.*?)\n\}', docs, re.S | re.M):
    for k, v in re.findall(r'^\s*(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"', m.group(1), re.M):
        doc_inputs.setdefault(k, unq('"' + v + '"'))
doc_nodes = kv(docs, r'Docs\.Nodes')
doc_rend = kv(docs, r'Docs\.Renderers')
for k, v in re.findall(r'Docs\.Renderers\.(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"', docs):
    doc_rend[k] = unq('"' + v + '"')
stage_labels = kv(docs, r'Docs\.StageLabels')

TYPE_FR = {"float": "nombre", "int": "entier", "bool": "oui/non", "vec2": "vecteur 2D", "vec3": "vecteur 3D",
           "color": "couleur RGBA", "enum": "liste", "string": "texte", "asset": "asset id", "attr": "attribut",
           "curve": "courbe", "any": "nombre ou vecteur"}

mods_src = rd("NebulaFX_Runtime_Modules.lua") + "\n" + rd("NebulaFX_Runtime_ModulesExtra.lua")
local_lists = {m.group(1): re.findall(r'"([^"]+)"', m.group(2))
               for m in re.finditer(r'local (\w+)\s*=\s*\{([^{}]*)\}', mods_src)}


def parse_inputs(seg):
    out = []
    for im in re.finditer(r'\{\s*name\s*=\s*"(\w+)",\s*type\s*=\s*"(\w+)"(.*?)\},?\s*$', seg, re.M):
        rest = im.group(3)
        opts = re.search(r'options\s*=\s*(\{[^}]*\}|\w+)', rest)
        options = None
        if opts:
            o = opts.group(1)
            options = re.findall(r'"([^"]+)"', o) if o.startswith("{") else local_lists.get(o)
        dflt = re.search(r'default\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,}]+)', rest)
        mn = re.search(r'\bmin\s*=\s*([-\d.]+)', rest)
        mx = re.search(r'\bmax\s*=\s*([-\d.]+)', rest)
        tip = re.search(r'tip\s*=\s*"([^"]*)"', rest)
        out.append({"name": im.group(1), "type": im.group(2), "default": dflt.group(1).strip() if dflt else "",
                    "tip": tip.group(1) if tip else doc_inputs.get(im.group(1), ""), "options": options,
                    "min": mn.group(1) if mn else None, "max": mx.group(1) if mx else None})
    return out


defs = list(re.finditer(r'def\("(\w+)",\s*\{', mods_src))
rend_start = mods_src.find("Modules.Renderers = {")
modules = []
for i, m in enumerate(defs):
    end = defs[i + 1].start() if i + 1 < len(defs) else len(mods_src)
    if m.start() < rend_start < end:
        end = rend_start
    seg = mods_src[m.end():end].split("run = function")[0]
    name = re.search(r'name\s*=\s*"([^"]+)"', seg)
    cat = re.search(r'category\s*=\s*"([^"]+)"', seg)
    st = re.search(r'stages\s*=\s*\{([^}]*)\}', seg)
    modules.append({"id": m.group(1), "name": name.group(1) if name else m.group(1),
                    "cat": cat.group(1) if cat else "Other", "stages": re.findall(r'"(\w+)"', st.group(1)) if st else [],
                    "desc": doc_mods.get(m.group(1), ""), "inputs": parse_inputs(seg)})

renderers = []
rsrc = mods_src[rend_start:]
for k in re.findall(r'"(\w+)"', re.search(r'RendererOrder\s*=\s*\{([^}]*)\}', rsrc).group(1)):
    m = re.search(r'(?:^\t|Renderers\.)' + k + r'\s*=\s*\{\s*name\s*=\s*"([^"]+)",\s*icon\s*=\s*"([^"]+)",\s*settings\s*=\s*\{(.*?)\n\t\t?\},', rsrc, re.S | re.M)
    if m:
        renderers.append({"key": k, "name": m.group(1), "desc": doc_rend.get(k, ""), "settings": parse_inputs(m.group(3))})

tsrc, tlsrc = rd("NebulaFX_Editor_Templates.lua"), rd("NebulaFX_Editor_TemplateLibrary.lua")
cats = re.findall(r'\{\s*id\s*=\s*"(\w+)",\s*label\s*=\s*"([^"]+)",\s*icon\s*=\s*"[^"]+"\s*\}', tsrc)
orig = {k: a for k, a in re.findall(r'^\t(\w+)\s*=\s*\{\s*"(\w+)",\s*"[^"]+"\s*\},', tsrc, re.M)}
templates = []
for text in (tsrc, tlsrc):
    adds = list(re.finditer(r'\badd\("(\w+)",\s*"([^"]+)",\s*"([^"]*)"', text))
    for i, m in enumerate(adds):
        seg = text[m.end(): adds[i + 1].start() if i + 1 < len(adds) else len(text)]
        c = re.findall(r'end\s*,\s*"(\w+)"(?:\s*,\s*"[^"]*")?\s*\)', seg)
        cat = orig.get(m.group(1)) or (c[-1] if c else "")
        templates.append({"id": m.group(1), "label": m.group(2), "desc": m.group(3), "cat": cat})

vm = rd("NebulaFX_Runtime_ScratchVM.lua")
nd = list(re.finditer(r'^node\("(\w+)",', vm, re.M))
nodes = []
for i, m in enumerate(nd):
    seg = vm[m.end(): nd[i + 1].start() if i + 1 < len(nd) else len(vm)]
    name = re.search(r'^\s*name\s*=\s*"([^"]+)"', seg, re.M)
    cat = re.search(r'category\s*=\s*"([^"]+)"', seg)
    ins = re.search(r'inputs\s*=\s*\{((?:\s*\{[^}]*\},?)*)\s*\}', seg)
    outs = re.search(r'outputs\s*=\s*\{((?:\s*\{[^}]*\},?)*)\s*\}', seg)
    nodes.append({"id": m.group(1), "name": name.group(1) if name else m.group(1), "cat": cat.group(1) if cat else "Math",
                  "ins": re.findall(r'\{\s*"(\w+)",\s*"(\w+)"', ins.group(1)) if ins else [],
                  "outs": re.findall(r'\{\s*"(\w+)"', outs.group(1)) if outs else []})

pd = rd("NebulaFX_Runtime_ParticleData.lua")
attr_desc = dict(re.findall(r'^\t\t(\w+)\s*=\s*"([^"]*)",', docs_src[docs_src.index('page("ref-attributes"'):], re.M))
attributes = [(n, t) for n, t, rest in re.findall(r'\{\s*name\s*=\s*"(\w+)",.*?type\s*=\s*"(\w+)"(.*?)\}\s*,?\s*$', pd, re.M) if "hidden" not in rest]


def by_cat(items):
    order, d = [], {}
    for it in items:
        d.setdefault(it["cat"], [])
        if it["cat"] not in order:
            order.append(it["cat"])
        d[it["cat"]].append(it)
    return order, d


# ---------------------------------------------------------------- construction par langue
def build(lang):
    L = make_L(lang)
    f = lambda pat, *a: L(pat) % a

    def fmt_default(raw):
        raw = raw.strip()
        if not raw:
            return "—"
        if raw.startswith("{"):
            if "mode" in raw:
                if "random" in raw:
                    nums = re.findall(r'-?\d+(?:\.\d+)?', raw)
                    return f("Aléa %s → %s", nums[0], nums[1]) if len(nums) > 1 else L("Aléa")
                return L("Courbe") if "curve" in raw else "—"
            nums = re.findall(r'-?\d+(?:\.\d+)?|"[^"]*"', raw)
            return "(" + ", ".join(n.strip('"') for n in nums) + ")"
        if raw.startswith('"'):
            return raw.strip('"') or "—"
        return raw

    def rows(inputs):
        out = []
        for i in inputs:
            extra = L(i["tip"] or "")
            if i["options"]:
                extra = (extra + " • " if extra else "") + f("Choix : %s", ", ".join(i["options"]))
            if i["min"] or i["max"]:
                extra = (extra + " • " if extra else "") + f("Plage : %s à %s", i["min"] or "−∞", i["max"] or "+∞")
            out.append([i["name"], L(TYPE_FR.get(i["type"], i["type"])), fmt_default(i["default"]), extra])
        return out

    def tr_block(b):
        k = b[0]
        if k in ("list", "steps"):
            return [k, [L(x) for x in b[1]]]
        if k == "table":
            return [k, [L(c) for c in b[1]], [[L(c) for c in r] for r in b[2]]]
        if k == "link":
            return [k, L(b[1]), b[2]]
        if k == "code":
            return [k, L(b[1])]
        return [k] + [L(x) for x in b[1:]]

    cat_label = {cid: L(label) for cid, label in cats}
    gen = {}
    order, cmap = by_cat(templates)
    blocks = [["p", f("%d modèles prêts à l'emploi, rangés par catégorie. Ils s'ouvrent depuis la fenêtre « Créer un système » (au lancement du plugin, ou Fichier › Nouvel effet…), ou depuis Bibliothèque › Modèles. Chacun est aussi un exemple d'une technique.", len(templates))]]
    for cid, _ in cats:
        if cid in cmap:
            blocks.append(["h", cat_label[cid]])
            blocks.append(["table", [L("Modèle"), L("Ce qu'il montre")], [[L(t["label"]), L(t["desc"])] for t in cmap[cid]]])
    gen["templates"] = blocks
    gen["ref-modules"] = [["modules"]]

    blocks = [["p", L("Un émetteur peut avoir plusieurs rendus (ex. Sprite + Light). Tous se mettent à jour en un seul déplacement groupé et ne réécrivent une propriété que si elle a changé.")]]
    for r in renderers:
        blocks.append(["h", r["name"]])
        if r["desc"]:
            blocks.append(["p", L(r["desc"])])
        blocks.append(["table", [L("Réglage"), L("Type"), L("Par défaut"), L("Détails")], rows(r["settings"])])
    blocks.append(["h", L("Choisir le backend du Sprite")])
    blocks.append(["table", [L("Backend"), L("Pour"), L("Limites")], [
        ["Beam", L("Lueurs additives, étincelles, le plus rapide"), L("Pas de flipbook ; invisible dans l'aperçu intégré")],
        ["Billboard", L("Flipbooks (SubUV), rotation d'image"), L("Pas d'additif")],
        ["Decal", L("Aperçu intégré"), L("Pas d'additif ni de brillance")]]])
    gen["ref-renderers"] = blocks

    gen["ref-attributes"] = [
        ["p", L("Lisibles partout via Particles.Nom (liens, expressions, courbes, Scratch Pad) et modifiables avec Set Float/Vector Attribute ou un node Set Particle Attribute. Vous pouvez aussi créer vos propres attributs : il suffit d'écrire dans un nom nouveau.")],
        ["table", [L("Nom"), L("Type"), L("Description")], [["Particles." + n, L(TYPE_FR.get(t, t)), L(attr_desc.get(n, ""))] for n, t in attributes]],
        ["tip", L("Les modules Scale Color / Scale Sprite Size / Scale Mesh Size multiplient la valeur de NAISSANCE (copie interne), pas la valeur courante : ils ne s'accumulent pas.")],
    ]

    order, nmap = by_cat(nodes)
    blocks = [["p", L("Math et vecteurs acceptent nombres et vecteurs : un nombre combiné à un vecteur est appliqué à chaque composante.")]]
    for c in order:
        blocks.append(["h", c])
        blocks.append(["table", [L("Node"), L("Entrées"), L("Sorties"), L("Description")], [[
            n["name"],
            ", ".join("%s (%s)" % (a, L(TYPE_FR.get(b, b))) for a, b in n["ins"]) or "—",
            ", ".join(n["outs"]) or "—",
            L(doc_nodes.get(n["id"], ""))] for n in nmap[c]]])
    gen["ref-nodes"] = blocks

    out_pages = []
    for p in pages:
        if p["blocks"] is None:
            if p["id"] not in gen:
                continue
            blocks = gen[p["id"]]
        else:
            blocks = [tr_block(b) for b in p["blocks"]]
        out_pages.append({"id": p["id"], "group": L(p["group"]), "title": L(p["title"]), "blocks": blocks})

    return {
        "lang": lang,
        "groups": [L(g) for g in groups],
        "pages": out_pages,
        "modules": [{"id": m["id"], "name": m["name"], "cat": m["cat"], "desc": L(m["desc"]),
                     "stages": [L(stage_labels.get(s, s)) for s in m["stages"]], "inputs": rows(m["inputs"])} for m in modules],
        "headers": [L("Réglage"), L("Type"), L("Par défaut"), L("Détails")],
        "stats": {"modules": len(modules), "templates": len(templates), "nodes": len(nodes), "renderers": len(renderers)},
        "templates": [{"label": L(t["label"]), "cat": t["cat"], "catLabel": cat_label.get(t["cat"], t["cat"])} for t in templates],
    }


os.makedirs(OUT, exist_ok=True)
for lang in LANGS:
    data = build(lang)
    with open(os.path.join(OUT, f"docs.{lang}.js"), "w", encoding="utf-8") as fh:
        fh.write("/* Généré depuis NebulaFX.rbxmx par tools/build_docs.py — ne pas éditer à la main */\n")
        fh.write("window.NEBULA_DOCS = window.NEBULA_DOCS || {};\nwindow.NEBULA_DOCS[%s] = " % json.dumps(lang))
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
for lg, (ok, tot) in stats_tr.items():
    if tot:
        print(f"{lg}: {ok}/{tot} textes traduits ({100 * ok // tot}%)")
print("pages:", len(pages), "modules:", len(modules), "modèles:", len(templates), "nodes:", len(nodes))
