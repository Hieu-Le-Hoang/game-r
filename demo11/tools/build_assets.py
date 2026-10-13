"""Build asset Flare (CC-BY-SA 3.0) -> atlas WebP + JSON cho demo11.

Dựa trên tools/build_assets.py của demo5, thêm:
- tileset nhiều ảnh (grassland = grassland.png + grassland_water.png) và atlas tile chia nhiều trang (<= 4096px)
- 2 map: Lorencia (Black Oak City) + Dungeon (Family Crypt)
- hero đủ bộ cho Dark Knight (giáp da/xích/tấm) và Dark Wizard (vải, áo pháp sư 3 màu)
- quái kiểu MU (tên MU, sprite Flare), âm thanh

Usage: py -3 -E -P tools/build_assets.py <flare_repo_dir>
"""
import json
import math
import pathlib
import re
import shutil
import sys

from PIL import Image

REPO = pathlib.Path(sys.argv[1])
FC = REPO / 'mods' / 'fantasycore'
EC = REPO / 'mods' / 'empyrean_campaign'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'a'
S = 0.75          # scale toàn bộ sprite + tile
MAXW = 2048
PAGE = 4096       # cạnh tối đa 1 trang atlas tile (an toàn cho GPU mobile)
PAD = 2
Q = 78            # chất lượng WebP


def raw(path):
    """Tìm file trong empyrean_campaign trước rồi tới fantasycore (giống thứ tự mod của Flare)."""
    for base in (EC, FC):
        p = base / path
        if p.exists():
            return p
    raise FileNotFoundError(path)


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


def pack(rects, maxw=MAXW):
    """Shelf packer. rects: list of (key, w, h) -> {key: (x, y)}, W, H"""
    order = sorted(rects, key=lambda r: -r[2])
    x = y = shelf = 0
    pos = {}
    for key, w, h in order:
        if x + w + PAD > maxw:
            x, y, shelf = 0, y + shelf + PAD, 0
        pos[key] = (x, y)
        x += w + PAD
        shelf = max(shelf, h)
    return pos, maxw, y + shelf


def pack_pages(rects, maxw=PAGE, maxh=PAGE):
    """Shelf packer nhiều trang. -> {key: (page, x, y)}, [(W, H)...]"""
    order = sorted(rects, key=lambda r: -r[2])
    pages, pos = [], {}
    x = y = shelf = 0
    page = 0
    for key, w, h in order:
        if x + w + PAD > maxw:
            x, y, shelf = 0, y + shelf + PAD, 0
        if y + h > maxh:
            pages.append((maxw, y))
            page, x, y, shelf = page + 1, 0, 0, 0
        pos[key] = (page, x, y)
        x += w + PAD
        shelf = max(shelf, h)
    pages.append((maxw, y + shelf))
    return pos, pages


_img_cache = {}


def src(path):
    if path not in _img_cache:
        _img_cache[path] = Image.open(raw(path)).convert('RGBA')
    return _img_cache[path]


def build_sheet(name, anim_files, keep=None, sub='', sc=S):
    """Gộp 1..n file animation thành 1 atlas. keep: set tên section cần giữ."""
    frames, index, anims = [], {}, {}
    crops = []
    for prefix, af in anim_files:
        secs = parse_anim(raw(af))
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
    missing = keep - {k.split(':')[-1] for k in anims} if keep else set()
    if missing:
        print(f'  ! {name}: thiếu anim {sorted(missing)}')
    tiles = []
    for key, r in crops:
        img, x, y, w, h = key
        im = src(img).crop((x, y, x + w, y + h))
        sw, sh = max(1, round(w * sc)), max(1, round(h * sc))
        im = im.resize((sw, sh), Image.LANCZOS)
        tiles.append((key, im, round(r[4] * sc), round(r[5] * sc)))
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


def read_map(path):
    txt = path.read_text(encoding='utf-8')
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
        enemies.append({'x': x, 'y': y, 'w': w, 'h': h, 'cat': kv.get('category', ''), 'n': num})
    hero = [int(v) for v in head['hero_pos'].split(',')]
    return head, W, H, layers, enemies, hero


def tileset_defs(tsdef):
    """tileset nhiều ảnh: mỗi tile nhớ ảnh nguồn của nó."""
    tdefs, img = {}, None
    for l in raw(tsdef).read_text().splitlines():
        if l.startswith('img='):
            img = l[4:]
        if l.startswith('tile='):
            a = [int(v) for v in l[5:].split(',')]
            tdefs[a[0]] = a[1:] + [img]
    return tdefs


def build_map(name, map_path, extra_tiles=(), patch=None):
    head, W, H, layers, enemies, hero = read_map(map_path)
    if patch:
        patch(W, layers)
    tdefs = tileset_defs(head['tileset'])
    used = sorted({v for k in ('background', 'object') for v in layers[k] if v} | set(extra_tiles))
    tiles = []
    for tid in used:
        if tid not in tdefs:
            continue
        x, y, w, h, ox, oy, img = tdefs[tid]
        im = src(img).crop((x, y, x + w, y + h)).resize((max(1, round(w * S)), max(1, round(h * S))), Image.LANCZOS)
        tiles.append((tid, im, round(ox * S), round(oy * S)))
    pos, pages = pack_pages([(t[0], t[1].width, t[1].height) for t in tiles])
    sheets = [Image.new('RGBA', (pw, max(1, ph)), (0, 0, 0, 0)) for pw, ph in pages]
    tf = {}
    for tid, im, ox, oy in tiles:
        pg, px, py = pos[tid]
        sheets[pg].alpha_composite(im, (px, py))
        tf[tid] = [px, py, im.width, im.height, ox, oy, pg]
    (OUT / 'maps').mkdir(parents=True, exist_ok=True)
    size = 0
    for i, sh in enumerate(sheets):
        p = OUT / 'maps' / f'{name}_{i}.webp'
        sh.save(p, 'WEBP', quality=80, alpha_quality=88, method=6)
        size += p.stat().st_size
    # bỏ tile object không có hình (tile rỗng / tile thuộc tileset Tiled ngoài game)
    obj = [v if v in tf else 0 for v in layers['object']]
    bg = [v if v in tf else 0 for v in layers['background']]
    data = {'w': W, 'h': H, 'tw': round(192 * S), 'th': round(96 * S), 'hero': hero, 'pages': len(sheets), 'tiles': tf,
            'bg': bg, 'obj': obj, 'col': layers['collision'], 'enemies': enemies}
    (OUT / 'maps' / f'{name}.json').write_text(json.dumps(data, separators=(',', ':')))
    print(f'  map {name}: {W}x{H}, {len(tf)} tile, {len(sheets)} trang {[f"{w}x{h}" for w, h in pages]}')
    return size


def crypt_patch(W, layers):
    # giống demo5: mở sẵn 2 cửa mà map gốc chỉ mở bằng script
    for x, y, tid in ((9, 51, 112), (19, 12, 113)):
        layers['collision'][y * W + x] = 0
        layers['object'][y * W + x] = tid


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


SFX = {
    'swing1': 'soundfx/melee_attack.ogg', 'swing2': 'soundfx/melee_attack_2.ogg', 'swing3': 'soundfx/melee_attack_3.ogg',
    'hurt': 'soundfx/male_hit.ogg', 'die': 'soundfx/male_die.ogg', 'levelup': 'soundfx/level_up.ogg', 'nomana': 'soundfx/no_mana.ogg',
    'fireball': 'soundfx/powers/fireball.ogg', 'quake': 'soundfx/powers/quake.ogg', 'shock': 'soundfx/powers/shock.ogg',
    'teleport': 'soundfx/powers/teleport.ogg', 'heal': 'soundfx/powers/heal.ogg', 'potion': 'soundfx/powers/potion.ogg',
    'burn': 'soundfx/powers/burn.ogg', 'thunder': 'soundfx/powers/thunder.ogg', 'warcry': 'soundfx/powers/warcry.ogg',
    'coins': 'soundfx/inventory/inventory_coins.ogg', 'gem': 'soundfx/inventory/inventory_gem.ogg',
    'metal': 'soundfx/inventory/inventory_metal.ogg', 'loot': 'soundfx/flying_loot.ogg', 'cloth': 'soundfx/inventory/inventory_cloth.ogg',
    'spider_hit': 'soundfx/enemies/antlion_hit.ogg', 'spider_die': 'soundfx/enemies/antlion_die.ogg',
    'goblin_hit': 'soundfx/enemies/goblin_hit.ogg', 'goblin_die': 'soundfx/enemies/goblin_die.ogg',
    'bull_hit': 'soundfx/enemies/minotaur_hit.ogg', 'bull_die': 'soundfx/enemies/minotaur_die.ogg',
    'skel_hit': 'soundfx/enemies/skeleton_hit.ogg', 'skel_die': 'soundfx/enemies/skeleton_die.ogg',
    'wyv_hit': 'soundfx/enemies/wyvern_hit.ogg', 'wyv_die': 'soundfx/enemies/wyvern_die.ogg',
    'zomb_hit': 'soundfx/enemies/zombie_hit.ogg', 'zomb_die': 'soundfx/enemies/zombie_die.ogg',
    'amb_field': 'soundfx/environment/bird_twitter_loop.ogg', 'amb_cave': 'soundfx/environment/cave_wind_loop.ogg',
}


if __name__ == '__main__':
    sizes = {}
    sizes['map/lorencia'] = build_map('lorencia', EC / 'maps' / 'black_oak_city.txt')
    sizes['map/dungeon'] = build_map('dungeon', EC / 'maps' / 'family_crypt.txt', (160, 161, 163), crypt_patch)

    HERO_KEEP = {'stance', 'run', 'swing', 'hit', 'die', 'cast'}
    layers = ('default_chest default_feet default_hands default_legs head_short '
              'leather_chest leather_pants leather_boots leather_gloves leather_hood '
              'chain_cuirass chain_greaves chain_boots chain_gloves chain_coif '
              'plate_cuirass plate_greaves plate_boots plate_gauntlets plate_helm '
              'cloth_shirt cloth_pants cloth_gloves cloth_sandals '
              'mage_vest mage_skirt mage_sleeves mage_boots mage_hood '
              'mage_vest_alt1 mage_skirt_alt1 mage_sleeves_alt1 mage_boots_alt1 mage_hood_alt1 '
              'mage_vest_alt2 mage_skirt_alt2 mage_sleeves_alt2 mage_boots_alt2 mage_hood_alt2 '
              'shortsword longsword zweihander greatsword wand rod staff greatstaff buckler kite_shield shield').split()
    for l in layers:
        sizes['hero/' + l] = build_sheet(l, [('', f'animations/avatar/male/{l}.txt')], HERO_KEEP, 'hero')

    MELEE = {'stance', 'run', 'swing', 'hit', 'die'}
    ESC = {'wyvern': 0.5}  # wyvern gốc quá to (atlas > 4096px), Budge Dragon vốn là quái nhỏ
    EN = {'antlion_small': MELEE, 'wyvern': MELEE, 'minotaur': MELEE | {'cast'}, 'goblin': MELEE,
          'hobgoblin': MELEE, 'skeleton': MELEE, 'zombie': MELEE,
          'skeleton_mage': {'stance', 'run', 'cast', 'hit', 'die'}}
    for e, keep in EN.items():
        sizes['enemy/' + e] = build_sheet(e, [('', f'animations/enemies/{e}.txt')], keep, 'enemies', ESC.get(e, S))
    for n in ('guild_man', 'peasant_woman1', 'knight'):
        sizes['npc/' + n] = build_sheet(n, [('', f'animations/npcs/{n}.txt')], {'stance'}, 'npcs')

    loot = ('shortsword longsword zweihander greatsword wand rod staff greatstaff buckler shield '
            'leather_armor steel_armor boots clothes hp_potion mp_potion coins5 coins25 coins100 gem book').split()
    sizes['loot'] = build_sheet('loot', [(l + ':', f'animations/loot/{l}.txt') for l in loot], None, '')
    pw = ('fireball blast cleave quake heal spark_red spark_orange spark_blue sparkle freeze '
          'plasmaball lightning runes').split()
    sizes['powers'] = build_sheet('powers', [(p + ':', f'animations/powers/{p}.txt') for p in pw], None, '')
    sizes['icons'] = build_icons([
        # skill
        1, 22, 10, 44, 45, 39, 34, 9, 64, 65,
        # vũ khí, khiên
        97, 98, 100, 99, 104, 105, 106, 107, 120, 122, 123,
        # giáp: da, xích, tấm, vải, pháp sư x3
        144, 145, 146, 147, 148, 152, 153, 154, 155, 156, 160, 161, 162, 163, 164,
        129, 130, 131, 132, 136, 137, 138, 139, 140, 184, 185, 186, 187, 188, 192, 193, 194, 195, 196,
        # ngọc, hộp
        68, 71, 225,
    ])
    (OUT / 'portraits').mkdir(exist_ok=True)
    for p in ('male01', 'male03', 'female02'):
        src(f'images/portraits/{p}.png').resize((160, 160), Image.LANCZOS).save(OUT / 'portraits' / f'{p}.webp', 'WEBP', quality=85)
    (OUT / 'sfx').mkdir(exist_ok=True)
    for k, p in SFX.items():
        shutil.copyfile(raw(p), OUT / 'sfx' / f'{k}.ogg')
        sizes['sfx/' + k] = (OUT / 'sfx' / f'{k}.ogg').stat().st_size
    shutil.copyfile(REPO / 'CREDITS.txt', OUT / 'CREDITS-flare.txt')
    total = sum(sizes.values())
    for k, v in sorted(sizes.items(), key=lambda kv: -kv[1])[:14]:
        print(f'{v / 1e3:8.0f} KB  {k}')
    print(f'TOTAL {total / 1e6:.2f} MB')
