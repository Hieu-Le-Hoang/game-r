"""Build asset Flare (CC-BY-SA 3.0) -> atlas WebP + JSON cho demo10.

- Nhân vật: ghép sẵn các lớp paper-doll (đầu/áo/quần/giày/tay/vũ khí) thành 1 sprite cho mỗi bộ đồ môn phái.
- Quái, NPC, hiệu ứng phép, đồ rơi: cắt bớt animation không dùng, scale S, đóng atlas.
- Map: đọc map Flare -> JSON (layer nền/vật thể/va chạm, vùng quái, NPC, cổng) + atlas tile theo tileset.

Usage: python3 -I tools/build_assets.py   (cần _raw/flare-game, xem tasks/todo.md M0)
"""
import json
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import flare  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'a'
S = 0.75          # scale toàn bộ sprite + tile
MAXW = 2048
PAD = 2
Q = 80            # chất lượng WebP

# thứ tự vẽ lớp theo hướng 0..7 (SW, W, NW, N, NE, E, SE, S) — engine/hero_layers.txt
LAYER_ORDER = [s.split(',') for s in (
    'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head',
    'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main',
    'feet,legs,hands,main,chest,head,off', 'main,feet,legs,hands,chest,head,off')]

HERO_ANIMS = ['stance', 'run', 'swing', 'cast', 'hit', 'die']
_TS = dict(head='head_short', chest='cloth_shirt', legs='cloth_pants', feet='cloth_sandals', hands='default_hands')
OUTFITS = {
    'tanthu_m': ('male', _TS),
    'tanthu_f': ('female', dict(_TS, head='head_long')),
    'thieulam_m': ('male', dict(head='head_bald', chest='mage_vest_alt2', legs='mage_skirt_alt2', feet='cloth_sandals',
                                hands='mage_sleeves_alt2', main='staff')),
    'duongmon_m': ('male', dict(head='leather_hood', chest='leather_chest', legs='leather_pants', feet='leather_boots',
                                hands='leather_gloves', main='dagger')),
    'ngamy_f': ('female', dict(head='head_long', chest='mage_vest_alt1', legs='mage_skirt_alt1', feet='mage_boots_alt1',
                               hands='mage_sleeves_alt1', main='longsword')),
    'caibang_m': ('male', dict(head='head_short', chest='cloth_shirt', legs='cloth_pants', feet='cloth_sandals', hands='cloth_gloves')),
    'vodang_m': ('male', dict(head='head_short', chest='mage_vest', legs='mage_skirt', feet='mage_boots', hands='mage_sleeves',
                              main='longsword')),
}
OUTFITS['duongmon_f'] = ('female', OUTFITS['duongmon_m'][1])
OUTFITS['caibang_f'] = ('female', dict(OUTFITS['caibang_m'][1], head='head_long'))
OUTFITS['vodang_f'] = ('female', dict(OUTFITS['vodang_m'][1], head='head_long'))

# quái -> animation đánh (chỉ giữ stance, run, đòn đánh, die; 'hit' thay bằng nháy màu trong game)
ENEMIES = {'goblin': 'swing', 'goblin_elite': 'swing', 'hobgoblin': 'swing', 'hobgoblin_archer': 'shoot',
           'antlion_small': 'swing', 'antlion': 'swing', 'antlion_armored': 'swing', 'fire_ant': 'swing', 'ice_ant': 'swing',
           'skeleton': 'swing', 'skeleton_archer': 'shoot', 'skeleton_mage': 'cast', 'zombie': 'swing',
           'wyvern_fire': 'cast', 'minotaur': 'swing'}
# biến thể màu (frozen_zombie, skeleton_mage_ice/fire, zombie_ghost) chỉ là INCLUDE + color_mod -> game tự tint sprite gốc
NPCS = ('guild_man guild_man1 guild_man2 knight peasant_man1 peasant_man2 peasant_woman1 peasant_woman2 '
        'wandering_trader wandering_trader1 wandering_trader2').split()
POWERS = ('fireball icicle lightning quake throw_knife spark_red spark_blue spark_green spark_orange blast cleave freeze '
          'heal shield runes runes_blue runes_orange plasmaball thunderstrike spikes dark_mist ember channel stone spit '
          'sparkle arrows').split()
LOOT = ('coins5 coins25 coins100 hp_potion mp_potion clothes leather_armor steel_armor boots ring gem belt scroll pouch '
        'shortsword longsword staff dagger club wand').split()
MAPS = {  # id -> map Flare
    'balang': 'perdition_harbor', 'tuongduong': 'black_oak_city',
    'm1': 'salted_field', 'm2': 'nazia_highlands', 'm3': 'lake_kuuma', 'm4': 'the_breach',
}
PORTRAITS = ('male01', 'male02', 'male03', 'male04', 'male05', 'female01', 'female02', 'female03')

_img = {}


def img(rel):
    if rel not in _img:
        _img[rel] = Image.open(flare.path(rel)).convert('RGBA')
    return _img[rel]


def pack(rects):
    """Shelf packer. rects: list of (key, w, h) -> {key: (x, y)}, W, H"""
    x = y = shelf = 0
    pos = {}
    for key, w, h in sorted(rects, key=lambda r: -r[2]):
        if x + w + PAD > MAXW:
            x, y, shelf = 0, y + shelf + PAD, 0
        pos[key] = (x, y)
        x += w + PAD
        shelf = max(shelf, h)
    return pos, MAXW if y else x, y + shelf


def save_atlas(name, tiles, anims, sub='', extra=None):
    """tiles: list of (key, PIL image đã scale, ox, oy). Ghi <name>.webp + .json, trả về số byte."""
    pos, W, H = pack([(t[0], t[1].width, t[1].height) for t in tiles])
    sheet = Image.new('RGBA', (max(1, W), max(1, H)), (0, 0, 0, 0))
    frames = {}
    for key, im, ox, oy in tiles:
        px, py = pos[key]
        sheet.alpha_composite(im, (px, py))
        frames[key] = [px, py, im.width, im.height, ox, oy]
    out = OUT / sub
    out.mkdir(parents=True, exist_ok=True)
    keys = list(frames)
    idx = {k: i for i, k in enumerate(keys)}
    for a in anims.values():
        a['dir'] = [[idx[k] if k is not None else -1 for k in seq] for seq in a['dir']]
    sheet.save(out / f'{name}.webp', 'WEBP', quality=Q, alpha_quality=85, method=6)
    (out / f'{name}.json').write_text(json.dumps({'frames': [frames[k] for k in keys], 'anims': anims, **(extra or {})}, separators=(',', ':')))
    return (out / f'{name}.webp').stat().st_size


def scaled(im, ox, oy):
    w, h = max(1, round(im.width * S)), max(1, round(im.height * S))
    return im.resize((w, h), Image.LANCZOS), round(ox * S), round(oy * S)


def build_sheet(name, anim_files, keep=None, sub='', stride=1):
    """Gộp 1..n file animation Flare thành 1 atlas. keep: set tên section cần giữ.
    stride: animation từ 8 frame trở lên chỉ lấy 1/stride số frame (giảm dung lượng, tổng thời gian giữ nguyên)."""
    tiles, seen, anims, meta = [], set(), {}, {}
    for prefix, af in anim_files:
        for sname, s in flare.parse_anim(af, meta).items():
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
                k = stride if s['frames'] >= 8 else 1
                for i in range(0, s['frames'], k):
                    r = fl.get(i)
                    if r is None or r[2] <= 1 or r[3] <= 1:
                        seq.append(None)
                        continue
                    src = (s['imgs'].get(r[6]) if r[6] else None) or s['image']
                    key = (src, *r[:4])
                    if key not in seen:
                        seen.add(key)
                        x, y, w, h, ox, oy = r[:6]
                        tiles.append((key, *scaled(img(src).crop((x, y, x + w, y + h)), ox, oy)))
                    seq.append(key)
                dirs.append(seq)
            dirs = [d if d is not None else next(x for x in dirs if x is not None) for d in dirs]
            anims[prefix + sname] = {'d': s['duration'], 't': s['type'], 'n': len(dirs[0]), 'dir': dirs}
    return save_atlas(name, tiles, anims, sub, {'mod': meta} if meta else None)


def build_outfit(name, gender, outfit):
    """Ghép các lớp paper-doll thành 1 sprite mỗi frame, theo thứ tự lớp của từng hướng."""
    layers = {slot: flare.parse_anim(f'animations/avatar/{gender}/{l}.txt') for slot, l in outfit.items()}
    tiles, anims = [], {}
    for an in HERO_ANIMS:
        ref = layers['chest'][an]
        dirs = []
        for d in range(8):
            seq = []
            for i in range(ref['frames']):
                parts = []
                for slot in LAYER_ORDER[d]:
                    s = layers.get(slot, {}).get(an)
                    r = s and s['f'].get(d, {}).get(i)
                    if r and r[2] > 1 and r[3] > 1:
                        parts.append((s['image'], r))
                if not parts:
                    seq.append(None)
                    continue
                x0 = min(-r[4] for _, r in parts)
                y0 = min(-r[5] for _, r in parts)
                x1 = max(r[2] - r[4] for _, r in parts)
                y1 = max(r[3] - r[5] for _, r in parts)
                can = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
                for src, r in parts:
                    x, y, w, h, ox, oy = r[:6]
                    can.alpha_composite(img(src).crop((x, y, x + w, y + h)), (-ox - x0, -oy - y0))
                key = (an, d, i)
                tiles.append((key, *scaled(can, -x0, -y0)))
                seq.append(key)
            dirs.append(seq)
        anims[an] = {'d': ref['duration'], 't': ref['type'], 'n': ref['frames'], 'dir': dirs}
    return save_atlas(name, tiles, anims, 'chars')


def build_maps():
    """Mỗi map -> maps/<id>.json; tile gom theo tileset -> tiles_<tileset>.webp/json (chỉ tile có dùng)."""
    used, maps = {}, {}
    for mid, fname in MAPS.items():
        m = flare.parse_map(fname)
        ts = m['tileset'].split('/')[-1][8:-4]   # tilesetdefs/tileset_grassland.txt -> grassland
        L = m['layers']
        used.setdefault(ts, set()).update(v for k in ('background', 'object') for v in L.get(k, []) if v)
        zones, npcs, exits = [], [], []
        for typ, kv in m['objs']:
            if typ in ('enemy', 'enemygroup') and 'location' in kv:
                x, y, w, h = [int(v) for v in kv['location'].split(',')]
                zones.append([x, y, w, h])
            elif typ == 'npc' and 'location' in kv:
                npcs.append([int(v) for v in kv['location'].split(',')[:2]])
            elif typ == 'event' and 'intermap' in kv and 'location' in kv:
                x, y, w, h = [int(v) for v in kv['location'].split(',')]
                exits.append([x, y, w, h])
        maps[mid] = {'src': fname, 'ts': ts, 'w': m['w'], 'h': m['h'],
                     'hero': [int(v) for v in m['head']['hero_pos'].split(',')],
                     'bg': L['background'], 'obj': L.get('object', [0] * (m['w'] * m['h'])), 'col': L['collision'],
                     'zones': zones, 'npcs': npcs, 'exits': exits}
    sizes = {}
    for ts, ids in used.items():
        defs = flare.parse_tileset(f'tilesetdefs/tileset_{ts}.txt')
        tiles = []
        for tid in sorted(ids):
            if tid not in defs:
                continue
            src, x, y, w, h, ox, oy = defs[tid]
            tiles.append((tid, *scaled(img(src).crop((x, y, x + w, y + h)), ox, oy)))
        pos, W, H = pack([(t[0], t[1].width, t[1].height) for t in tiles])
        sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        tf = {}
        for tid, im, ox, oy in tiles:
            px, py = pos[tid]
            sheet.alpha_composite(im, (px, py))
            tf[tid] = [px, py, im.width, im.height, ox, oy]
        sheet.save(OUT / f'tiles_{ts}.webp', 'WEBP', quality=82, alpha_quality=90, method=6)
        (OUT / f'tiles_{ts}.json').write_text(json.dumps(tf, separators=(',', ':')))
        sizes['tiles_' + ts] = (OUT / f'tiles_{ts}.webp').stat().st_size
    (OUT / 'maps').mkdir(parents=True, exist_ok=True)
    for mid, d in maps.items():
        d['tw'], d['th'] = round(192 * S), round(96 * S)
        (OUT / 'maps' / f'{mid}.json').write_text(json.dumps(d, separators=(',', ':')))
    return sizes


def build_icons():
    """Toàn bộ icons.png (8 cột x 64px) -> 40px. id icon Flare = hàng*8 + cột."""
    im = img('images/icons/icons.png')
    s = 40
    out = im.resize((im.width * s // 64, im.height * s // 64), Image.LANCZOS)
    out.save(OUT / 'icons.webp', 'WEBP', quality=88, method=6)
    (OUT / 'icons.json').write_text(json.dumps({'size': s, 'cols': im.width // 64}))
    return (OUT / 'icons.webp').stat().st_size


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = build_maps()
    for name, (g, of) in OUTFITS.items():
        sizes['chars/' + name] = build_outfit(name, g, of)
    for e, atk in ENEMIES.items():
        sizes['enemies/' + e] = build_sheet(e, [('', f'animations/enemies/{e}.txt')], {'stance', 'run', atk, 'die'}, 'enemies', 2)
    for n in NPCS:
        sizes['npcs/' + n] = build_sheet(n, [('', f'animations/npcs/{n}.txt')], {'stance'}, 'npcs')
    sizes['loot'] = build_sheet('loot', [(l + ':', f'animations/loot/{l}.txt') for l in LOOT])
    sizes['powers'] = build_sheet('powers', [(p + ':', f'animations/powers/{p}.txt') for p in POWERS])
    sizes['icons'] = build_icons()
    (OUT / 'portraits').mkdir(exist_ok=True)
    for p in PORTRAITS:
        img(f'images/portraits/{p}.png').resize((128, 128), Image.LANCZOS).save(OUT / 'portraits' / f'{p}.webp', 'WEBP', quality=85)
    total = sum(sizes.values())
    for k, v in sorted(sizes.items(), key=lambda kv: -kv[1])[:14]:
        print(f'{v / 1e3:8.0f} KB  {k}')
    print(f'TOTAL {total / 1e6:.2f} MB')
