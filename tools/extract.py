import sys, os, re, xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
lines = []
def walk(item, path, depth):
    cls = item.get("class")
    props = item.find("Properties")
    name = "?"
    source = None
    if props is not None:
        for p in props:
            if p.get("name") == "Name": name = p.text or ""
            if p.get("name") == "Source": source = p.text or ""
    p2 = path + "/" + name
    extra = ""
    if source is not None:
        fn = re.sub(r'[^A-Za-z0-9_.-]', '_', p2.strip("/")) + ".lua"
        with open(os.path.join(out, fn), "w", encoding="utf-8") as f: f.write(source)
        extra = f"  [{len(source.splitlines())} lignes -> {fn}]"
    lines.append("  "*depth + f"{cls} {name}{extra}")
    for c in item.findall("Item"): walk(c, p2, depth+1)
for it in root.findall("Item"): walk(it, "", 0)
print("\n".join(lines))
