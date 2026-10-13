"""Đọc dữ liệu Flare (map, tileset, animation) dùng chung cho build_assets.py và các script khảo sát.

Flare là hệ mod chồng lên nhau: empyrean_campaign đè lên fantasycore. Hàm path() tìm file theo đúng thứ tự đó.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / '_raw' / 'flare-game' / 'mods'
MODS = [ROOT / 'empyrean_campaign', ROOT / 'fantasycore']


def path(rel):
    for m in MODS:
        p = m / rel
        if p.exists():
            return p
    raise FileNotFoundError(rel)


def _kv(block):
    out = {}
    for l in block.strip().splitlines():
        if '=' in l and not l.startswith('#'):
            k, v = l.split('=', 1)
            out.setdefault(k, v)
    return out


def parse_map(name):
    txt = path(f'maps/{name}.txt').read_text(encoding='utf-8')
    head = _kv(txt.split('[tilesets]')[0].split('[header]')[1])
    W, H = int(head['width']), int(head['height'])
    layers = {}
    for b in txt.split('[layer]')[1:]:
        lines = b.strip().splitlines()
        typ = next(l for l in lines if l.startswith('type='))[5:]
        i = lines.index('data=')
        vals = []
        for l in lines[i + 1:]:
            l = l.strip()
            if not l or l.startswith('['):
                break
            vals += [int(v) for v in l.rstrip(',').split(',') if v != '']
        layers[typ] = vals
    sections = re.split(r'^\[(\w+)\]\s*$', txt, flags=re.M)
    objs = [(sections[i], _kv(sections[i + 1])) for i in range(1, len(sections) - 1, 2)]
    return {'w': W, 'h': H, 'head': head, 'layers': layers, 'objs': objs,
            'tileset': head.get('tileset', '')}


def parse_tileset(rel):
    """-> {tile_id: (img_rel, x, y, w, h, ox, oy)}"""
    out, img = {}, None
    for l in path(rel).read_text(encoding='utf-8').splitlines():
        if l.startswith('img='):
            img = l[4:]
        elif l.startswith('tile='):
            a = [int(v) for v in l[5:].split(',')]
            out[a[0]] = (img, *a[1:7])
    return out


def parse_anim(rel, meta=None):
    """File animation Flare -> {section: {frames, duration(ms), type, image, imgs, f: {dir: {i: [x,y,w,h,ox,oy,tag]}}}}
    meta (dict, tùy chọn) nhận color_mod / alpha_mod. Hỗ trợ INCLUDE (bản biến thể màu của quái gốc)."""
    img_default, imgs, secs, cur = None, {}, {}, None
    for line in path(rel).read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('INCLUDE '):
            return {**parse_anim(line[8:].strip(), meta), **secs}
        if cur is None and line.startswith(('color_mod=', 'alpha_mod=')) and meta is not None:
            k, _, v = line.partition('=')
            meta[k] = [int(x) for x in v.split(',')]
            continue
        if line.startswith('['):
            cur = line[1:-1]
            secs[cur] = {'frames': 0, 'duration': 0, 'type': 'looped', 'f': {}}
            continue
        k, _, v = line.partition('=')
        if cur is None:
            if k == 'image':
                parts = v.split(',')
                if len(parts) > 1:
                    imgs[parts[1]] = parts[0]
                else:
                    img_default = parts[0]
            continue
        s = secs[cur]
        if k == 'frames':
            s['frames'] = int(v)
        elif k == 'duration':
            n = int(re.sub(r'\D', '', v))
            s['duration'] = n if v.endswith('ms') else n * 1000
        elif k == 'type':
            s['type'] = v
        elif k == 'frame':
            parts = v.split(',')
            a = [int(x) for x in parts[:8]]
            tag = parts[8] if len(parts) > 8 else None
            s['f'].setdefault(a[1], {})[a[0]] = a[2:8] + [tag]
    for s in secs.values():
        s['image'] = img_default
        s['imgs'] = imgs
        if not s['frames'] and s['f']:
            s['frames'] = max(len(v) for v in s['f'].values())
    return secs
