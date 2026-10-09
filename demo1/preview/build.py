"""Inline %%IMG:<path>%% tokens (relative to demo1/public/assets) as data URIs.

Usage: python3 build.py  -> writes preview/index.html from preview/index.src.html
"""
import base64
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ASSETS = HERE.parent / "public" / "assets"


def data_uri(rel: str) -> str:
    raw = (ASSETS / rel).read_bytes()
    return "data:image/png;base64," + base64.b64encode(raw).decode()


src = (HERE / "index.src.html").read_text(encoding="utf-8")
out = re.sub(r"%%IMG:([^%]+)%%", lambda m: data_uri(m.group(1)), src)
(HERE / "index.html").write_text(out, encoding="utf-8")
print(f"index.html: {len(out) / 1024:.0f} KB")

# bản local để test (artifact tự bọc skeleton khi publish)
(HERE / "index.local.html").write_text(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<link rel="icon" type="image/png" href="favicon.png">'
    "</head><body>" + out + "</body></html>",
    encoding="utf-8",
)
