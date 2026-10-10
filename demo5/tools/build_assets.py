"""Build asset Flare (CC-BY-SA 3.0) -> atlas WebP + JSON cho demo5.

Chỉ giữ các animation thực sự dùng, scale S, đóng lại atlas mới để giảm dung lượng.
Usage: python3 -I tools/build_assets.py <flare_raw_dir> <family_crypt.txt>
"""
import json
import math
import pathlib
import re
import sys

from PIL import Image

RAW = pathlib.Path(sys.argv[1])
MAP_TXT = pathlib.Path(sys.argv[2])
OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'a'
S = 0.75          # scale toàn bộ sprite + tile
MAXW = 2048
PAD = 2
Q = 78            # chất lượng WebP


def parse_anim(path):
    img_default, imgs, secs, cur = None, {}, {}, None
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
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
    for n, s in secs.items():
        s['image'] = imgs.get(n, img_default)
        s['imgs'] = imgs
        if not s['frames'] and s['f']:
            s['frames'] = max(len(v) for v in s['f'].values())
    return secs


def pack(rects):
    """Shelf packer. rects: list of (key, w, h) -> {key: (x, y)}, W, H"""
    order = sorted(rects, key=lambda r: -r[2])
    x = y = shelf = 0
    pos = {}
    for key, w, h in order:
        if x + w + PAD > MAXW:
            x, y, shelf = 0, y + shelf + PAD, 0
        pos[key] = (x, y)
        x += w + PAD
        shelf = max(shelf, h)
    return pos, MAXW, y + shelf


_img_cache = {}


def src(path):
    if path not in _img_cache:
        _img_cache[path] = Image.open(RAW / path).convert('RGBA')
    return _img_cache[path]


def build_sheet(name, anim_files, keep=None, sub=''):
    """Gộp 1..n file animation thành 1 atlas. keep: set tên section cần giữ."""
    frames, index, anims = [], {}, {}
    crops = []
    for prefix, af in anim_files:
        secs = parse_anim(RAW / af)
        for sname, s in secs.items():
            if keep and sname not in keep:
                continue
            if not s['f'] or not (s['image'] or s['imgs']):
                continue
            dirs = []
            for d in range(8):
                fl = s['f'].get(d)
                if fl is None:
                    dirs.append(None)
                    continue
                seq = []
                for i in range(s['frames']):
                    r = fl.get(i)
                    if r is None or r[2] <= 1 or r[3] <= 1:
                        seq.append(-1)
                        continue
                    img = s['imgs'].get(r[6]) if r[6] else s['image']
                    key = (img or s['image'], *r[:4])
                    if key not in index:
                        index[key] = len(frames)
                        frames.append(None)
                        crops.append((key, r))
                    seq.append(index[key])
                dirs.append(seq)
            # hướng thiếu -> dùng hướng 0
            dirs = [d if d is not None else next(x for x in dirs if x is not None) for d in dirs]
            anims[prefix + sname] = {'d': s['duration'], 't': s['type'], 'n': s['frames'], 'dir': dirs}
    # crop + scale
    tiles = []
    for key, r in crops:
        img, x, y, w, h = key
        im = src(img).crop((x, y, x + w, y + h))
        sw, sh = max(1, round(w * S)), max(1, round(h * S))
        im = im.resize((sw, sh), Image.LANCZOS)
        tiles.append((key, im, round(r[4] * S), round(r[5] * S)))
    pos, W, H = pack([(t[0], t[1].width, t[1].height) for t in tiles])
    sheet = Image.new('RGBA', (W, max(1, H)), (0, 0, 0, 0))
    for key, im, ox, oy in tiles:
        px, py = pos[key]
        sheet.alpha_composite(im, (px, py))
        frames[index[key]] = [px, py, im.width, im.height, ox, oy]
    out = OUT / sub
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / f'{name}.webp', 'WEBP', quality=Q, alpha_quality=85, method=6)
    (out / f'{name}.json').write_text(json.dumps({'frames': frames, 'anims': anims}, separators=(',', ':')))
    return (out / f'{name}.webp').stat().st_size


def build_map():
    txt = MAP_TXT.read_text(encoding='utf-8')
    head = dict(l.split('=', 1) for l in txt.split('[tilesets]')[0].splitlines() if '=' in l)
    W, H = int(head['width']), int(head['height'])
    layers = {}
    for b in txt.split('[layer]')[1:]:
        lines = b.strip().splitlines()
        typ = next(l for l in lines if l.startswith('type='))[5:]
        i = lines.index('data=')
        rows = []
        for l in lines[i + 1:]:
            l = l.strip()
            if not l or l.startswith('['):
                break
            rows.append([int(v) for v in l.rstrip(',').split(',') if v != ''])
        layers[typ] = [v for r in rows for v in r]
    enemies = []
    for b in txt.split('[enemy]')[1:]:
        kv = dict(l.split('=', 1) for l in b.split('\n\n')[0].strip().splitlines() if '=' in l)
        x, y, w, h = [int(v) for v in kv['location'].split(',')]
        num = [int(v) for v in kv.get('number', '1').split(',')]
        enemies.append({'x': x, 'y': y, 'w': w, 'h': h, 'cat': kv['category'], 'n': num})
    chests = []
    for b in txt.split('[event]')[1:]:
        if 'loot=' in b:
            kv = dict(l.split('=', 1) for l in b.split('\n\n')[0].strip().splitlines() if '=' in l and not l.startswith('#'))
            x, y = [int(v) for v in kv['location'].split(',')[:2]]
            chests.append({'x': x, 'y': y})
    hero = [int(v) for v in head['hero_pos'].split(',')]

    # mở sẵn 2 cửa mà map gốc chỉ mở bằng script (phòng rương + cửa ra phòng quan tài)
    for x, y, tid in ((9, 51, 112), (19, 12, 113)):
        layers['collision'][y * W + x] = 0
        layers['object'][y * W + x] = tid
    # tileset: chỉ cắt tile có trong map
    used = sorted({v for k in ('background', 'object') for v in layers[k] if v} | {160, 161, 163})
    tdefs = {}
    tsimg = None
    for l in (RAW / 'tilesetdefs/tileset_dungeon.txt').read_text().splitlines():
        if l.startswith('img='):
            tsimg = l[4:]
        if l.startswith('tile='):
            a = [int(v) for v in l[5:].split(',')]
            tdefs[a[0]] = a[1:]
    tiles = []
    for tid in used:
        if tid not in tdefs:
            continue
        x, y, w, h, ox, oy = tdefs[tid]
        im = src(tsimg).crop((x, y, x + w, y + h)).resize((round(w * S), round(h * S)), Image.LANCZOS)
        tiles.append((tid, im, round(ox * S), round(oy * S)))
    pos, AW, AH = pack([(t[0], t[1].width, t[1].height) for t in tiles])
    sheet = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
    tf = {}
    for tid, im, ox, oy in tiles:
        px, py = pos[tid]
        sheet.alpha_composite(im, (px, py))
        tf[tid] = [px, py, im.width, im.height, ox, oy]
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / 'tiles.webp', 'WEBP', quality=82, alpha_quality=90, method=6)
    data = {'w': W, 'h': H, 'tw': round(192 * S), 'th': round(96 * S), 'hero': hero, 'tiles': tf,
            'bg': layers['background'], 'obj': layers['object'], 'col': layers['collision'],
            'enemies': enemies, 'chests': chests}
    (OUT / 'map.json').write_text(json.dumps(data, separators=(',', ':')))
    return (OUT / 'tiles.webp').stat().st_size


def build_icons(ids):
    im = src('images/icons/icons.png')
    s = 48
    cols = 16
    rows = math.ceil(len(ids) / cols)
    sheet = Image.new('RGBA', (cols * s, rows * s), (0, 0, 0, 0))
    m = {}
    for i, iid in enumerate(ids):
        x, y = (iid % 8) * 64, (iid // 8) * 64
        sheet.alpha_composite(im.crop((x, y, x + 64, y + 64)).resize((s, s), Image.LANCZOS), ((i % cols) * s, (i // cols) * s))
        m[iid] = [(i % cols) * s, (i // cols) * s]
    sheet.save(OUT / 'icons.webp', 'WEBP', quality=88, method=6)
    (OUT / 'icons.json').write_text(json.dumps({'size': s, 'cols': cols, 'pos': m}))
    return (OUT / 'icons.webp').stat().st_size


if __name__ == '__main__':
    sizes = {}
    sizes['map'] = build_map()
    HERO_KEEP = {'stance', 'run', 'swing', 'hit', 'die', 'cast'}
    layers = ('default_chest default_feet default_hands default_legs head_short leather_chest leather_pants leather_boots leather_gloves leather_hood '
              'chain_cuirass chain_greaves chain_boots chain_gloves chain_coif plate_cuirass plate_greaves plate_boots plate_gauntlets plate_helm '
              'shortsword longsword greatsword hand_axe mace war_hammer staff buckler kite_shield shield').split()
    for l in layers:
        sizes['hero/' + l] = build_sheet(l, [('', f'animations/avatar/male/{l}.txt')], HERO_KEEP, 'hero')
    EN = {'skeleton': {'stance', 'run', 'swing', 'hit', 'die'}, 'skeleton_weak': {'stance', 'run', 'swing', 'hit', 'die'},
          'skeleton_archer': {'stance', 'run', 'shoot', 'hit', 'die'}, 'skeleton_mage': {'stance', 'run', 'cast', 'hit', 'die'},
          'zombie': {'stance', 'run', 'swing', 'hit', 'die'}, 'minotaur': {'stance', 'run', 'swing', 'die', 'cast'}}
    for e, keep in EN.items():
        sizes['enemy/' + e] = build_sheet(e, [('', f'animations/enemies/{e}.txt')], keep, 'enemies')
    for n in ('knight', 'guild_man', 'peasant_woman1'):
        sizes['npc/' + n] = build_sheet(n, [('', f'animations/npcs/{n}.txt')], {'stance'}, 'npcs')
    loot = 'shortsword longsword greatsword hand_axe mace war_hammer staff buckler shield leather_armor steel_armor boots clothes hp_potion coins5 coins25 coins100 ring gem'.split()
    sizes['loot'] = build_sheet('loot', [(l + ':', f'animations/loot/{l}.txt') for l in loot], None, '')
    pw = [p for p in 'fireball blast cleave quake icicle heal spark_red spark_orange spark_blue sparkle freeze'.split()]
    sizes['powers'] = build_sheet('powers', [(p + ':', f'animations/powers/{p}.txt') for p in pw], None, '')
    sizes['icons'] = build_icons([1, 18, 39, 11, 34, 64, 65, 88, 97, 98, 99, 117, 111, 102, 104, 120, 122, 123, 136, 137, 138, 139, 140,
                                  152, 153, 154, 155, 156, 160, 161, 162, 163, 164, 206, 213])
    (OUT / 'portraits').mkdir(exist_ok=True)
    for p in ('male01', 'male03', 'female02', 'male05'):
        src(f'images/portraits/{p}.png').resize((160, 160), Image.LANCZOS).save(OUT / 'portraits' / f'{p}.webp', 'WEBP', quality=85)
    total = sum(sizes.values())
    for k, v in sorted(sizes.items(), key=lambda kv: -kv[1])[:12]:
        print(f'{v / 1e3:8.0f} KB  {k}')
    print(f'TOTAL {total / 1e6:.2f} MB')
