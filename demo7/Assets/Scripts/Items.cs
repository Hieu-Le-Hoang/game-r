using System.Collections.Generic;
using System.Linq;
using UnityEngine;

// Item roll: độ hiếm + affix ngẫu nhiên (kiểu Diablo). Port từ demo2/src/items.js
public class Rarity
{
    public string n; public Color c; public Color hex;
}

public class Affix { public string k, t, n; public int v; public bool pre; }

public class Legend { public string n, p, k; }

public class Item
{
    public int id, rarity, ilvl, armor;
    public string kind, m, name, baseName;
    public int[] dmg;
    public List<Affix> affixes = new();
    public Legend power;
}

public class Stats
{
    public int[] dmg = { 1, 3 };
    public int armor, maxHp, maxMp;
    public readonly Dictionary<string, float> a = new();
    public readonly HashSet<string> powers = new();
    public float crit = 5, critDmg = 50, mult = 1, speed = 1.15f;
    public float this[string k] => a.TryGetValue(k, out var v) ? v : 0;
    public float fire => this["fire"];
    public float ls => this["ls"];
    public float mf => this["mf"];
    public float intel => this["int"];
}

public static class Items
{
    public static readonly Rarity[] RAR =
    {
        new Rarity { n = "Thường", c = U.Html("#e6e1d6"), hex = U.Hex(0xe6e1d6) },
        new Rarity { n = "Ma thuật", c = U.Html("#5aa2ff"), hex = U.Hex(0x4d8dff) },
        new Rarity { n = "Hiếm", c = U.Html("#ffd34d"), hex = U.Hex(0xffc83a) },
        new Rarity { n = "Huyền thoại", c = U.Html("#ff8a2a"), hex = U.Hex(0xff7a1a) },
    };

    class Base { public string n, m; public int[] d, a; }
    static readonly Dictionary<string, Base[]> BASES = new()
    {
        ["weapon"] = new[]
        {
            new Base { n = "Kiếm Hiệp Sĩ", m = "sword_1handed", d = new[] { 4, 7 } },
            new Base { n = "Đại Kiếm", m = "sword_2handed", d = new[] { 7, 12 } },
            new Base { n = "Rìu Chiến", m = "axe_1handed", d = new[] { 5, 9 } },
            new Base { n = "Rìu Khổng Lồ", m = "axe_2handed", d = new[] { 8, 13 } },
            new Base { n = "Dao Găm", m = "dagger", d = new[] { 3, 6 } },
            new Base { n = "Trượng Pháp Sư", m = "staff", d = new[] { 4, 8 } },
            new Base { n = "Đũa Phép", m = "wand", d = new[] { 3, 7 } },
        },
        ["shield"] = new[]
        {
            new Base { n = "Khiên Tròn", m = "shield_round", a = new[] { 3, 6 } },
            new Base { n = "Khiên Gai", m = "shield_spikes", a = new[] { 5, 9 } },
            new Base { n = "Khiên Huy Hiệu", m = "shield_badge", a = new[] { 4, 8 } },
        },
    };

    class AffixDef { public string k, n; public int lo, hi; public System.Func<int, string> t; public bool pre; }
    static readonly AffixDef[] PREFIX =
    {
        new AffixDef { k = "dmgPct", n = "Sắc Bén", lo = 10, hi = 40, t = v => $"+{v}% sát thương", pre = true },
        new AffixDef { k = "fire", n = "Rực Lửa", lo = 2, hi = 9, t = v => $"+{v} sát thương lửa", pre = true },
        new AffixDef { k = "atkSpd", n = "Thần Tốc", lo = 6, hi = 20, t = v => $"+{v}% tốc độ đánh", pre = true },
        new AffixDef { k = "ls", n = "Khát Máu", lo = 2, hi = 6, t = v => $"Hút {v}% máu mỗi đòn", pre = true },
        new AffixDef { k = "crit", n = "Chí Mạng", lo = 3, hi = 10, t = v => $"+{v}% tỉ lệ chí mạng", pre = true },
    };
    static readonly AffixDef[] SUFFIX =
    {
        new AffixDef { k = "vit", n = "của Gấu", lo = 3, hi = 14, t = v => $"+{v} Thể lực" },
        new AffixDef { k = "str", n = "của Hổ", lo = 3, hi = 14, t = v => $"+{v} Sức mạnh" },
        new AffixDef { k = "dex", n = "của Cáo", lo = 3, hi = 14, t = v => $"+{v} Nhanh nhẹn" },
        new AffixDef { k = "int", n = "của Cú", lo = 3, hi = 14, t = v => $"+{v} Trí tuệ" },
        new AffixDef { k = "critDmg", n = "của Đại Bàng", lo = 10, hi = 45, t = v => $"+{v}% sát thương chí mạng" },
        new AffixDef { k = "mf", n = "của Thợ Săn", lo = 5, hi = 25, t = v => $"+{v}% tỉ lệ rơi đồ hiếm" },
    };
    static readonly string[] RARE_A = { "Nanh", "Bóng", "Lời Nguyền", "Vết Cắt", "Tiếng Gầm", "Móng" };
    static readonly string[] RARE_B = { "Bão Tố", "Huyết Nguyệt", "Hư Không", "Sấm Sét", "Tro Tàn", "Quạ Đen" };
    public static readonly Legend[] LEGEND =
    {
        new Legend { n = "Nanh Phượng Hoàng", p = "Mỗi đòn đánh có 25% bắn ra cầu lửa", k = "fireProc" },
        new Legend { n = "Lưỡi Hái Tháng Bảy", p = "Quái bị hạ phát nổ, gây sát thương xung quanh", k = "boom" },
        new Legend { n = "Gió Lốc Vĩnh Cửu", p = "Kỹ năng Q không tốn mana", k = "freeSkill" },
    };

    static int uid = 1;

    static int RollRarity(float boost)
    {
        float x = U.Rnd * 100 - boost;
        return x < 2.5f ? 3 : x < 13 ? 2 : x < 42 ? 1 : 0;
    }

    public static Item Potion() => new Item { id = uid++, kind = "potion", m = "bottle_A_green", rarity = 0, name = "Bình Hồi Máu", ilvl = 1 };

    public class Opt { public int? rarity; public float boost; public string kind; public int baseIdx = -1; public Legend legend; }

    public static Item Roll(int ilvl, Opt o = null)
    {
        o ??= new Opt();
        int r = o.rarity ?? RollRarity(o.boost);
        if (o.kind == null && U.Rnd < 0.15f) return Potion();
        string kind = o.kind ?? (U.Rnd < 0.28f ? "shield" : "weapon");
        var b = o.baseIdx >= 0 ? BASES[kind][o.baseIdx] : U.Pick(BASES[kind]);
        float sc = 1 + ilvl * 0.12f + r * 0.15f;
        var it = new Item { id = uid++, kind = kind, m = b.m, baseName = b.n, rarity = r, ilvl = ilvl };
        if (kind == "weapon") it.dmg = new[] { Mathf.RoundToInt(b.d[0] * sc), Mathf.RoundToInt(b.d[1] * sc) };
        else it.armor = Mathf.RoundToInt(U.RInt(b.a[0], b.a[1]) * sc);
        int n = new[] { 0, U.RInt(1, 2), U.RInt(3, 4), 4 }[r];
        var pool = PREFIX.Concat(SUFFIX).ToList();
        for (int i = 0; i < n && pool.Count > 0; i++)
        {
            int j = Random.Range(0, pool.Count);
            var a = pool[j]; pool.RemoveAt(j);
            int v = Mathf.RoundToInt((a.lo + U.Rnd * (a.hi - a.lo)) * (1 + ilvl * 0.05f));
            it.affixes.Add(new Affix { k = a.k, v = v, t = a.t(v), n = a.n, pre = a.pre });
        }
        if (r == 3) { var L = o.legend ?? U.Pick(LEGEND); it.name = L.n; it.power = L; }
        else if (r == 2) it.name = $"{U.Pick(RARE_A)} {U.Pick(RARE_B)}";
        else
        {
            var pre = it.affixes.FirstOrDefault(a => a.pre);
            var suf = it.affixes.FirstOrDefault(a => !a.pre);
            it.name = string.Join(" ", new[] { b.n, pre?.n, suf?.n }.Where(s => s != null));
        }
        return it;
    }

    public static int SellPrice(Item it) => 4 + it.rarity * 14 + it.ilvl;
}

// Trạng thái nhân vật (sống qua đổi hero)
public static class S
{
    public static string hero = "Knight";
    public static int lvl = 1, xp, gold = 40, quest; // quest: 0 chưa nhận, 1 đang làm, 2 xong chờ trả, 3 đã trả
    public static float hp = 1, mp = 1;
    public static List<Item> bag = new();
    public static Item weapon, shield;

    public static void Reset()
    {
        hero = "Knight"; lvl = 1; xp = 0; gold = 40; quest = 0; hp = mp = 1;
        bag = new List<Item>();
        weapon = Items.Roll(1, new Items.Opt { kind = "weapon", baseIdx = 0, rarity = 0 });
        shield = Items.Roll(1, new Items.Opt { kind = "shield", baseIdx = 0, rarity = 0 });
        bag.Add(Items.Roll(3, new Items.Opt { kind = "weapon", baseIdx = 3, rarity = 2 }));
        bag.Add(Items.Roll(2, new Items.Opt { kind = "weapon", baseIdx = 5, rarity = 1 }));
        bag.Add(Items.Potion()); bag.Add(Items.Potion()); bag.Add(Items.Potion());
    }

    public static Item Eq(string kind) => kind == "weapon" ? weapon : shield;
    public static void SetEq(string kind, Item it) { if (kind == "weapon") weapon = it; else shield = it; }
    public static int XpNeed => 30 + lvl * 25;

    public static Stats Calc()
    {
        var s = new Stats();
        foreach (var it in new[] { weapon, shield })
        {
            if (it == null) continue;
            if (it.dmg != null) s.dmg = (int[])it.dmg.Clone();
            s.armor += it.armor;
            foreach (var a in it.affixes) s.a[a.k] = s[a.k] + a.v;
            if (it.power != null) s.powers.Add(it.power.k);
        }
        s.maxHp = 80 + lvl * 12 + Mathf.RoundToInt(s["vit"] * 5);
        s.maxMp = 50 + lvl * 8 + Mathf.RoundToInt(s["int"] * 3);
        s.crit = 5 + s["crit"] + s["dex"] * 0.3f;
        s.critDmg = 50 + s["critDmg"];
        s.mult = 1 + (s["dmgPct"] + s["str"]) / 100f;
        s.speed = 1.15f * (1 + s["atkSpd"] / 100f);
        return s;
    }
}
