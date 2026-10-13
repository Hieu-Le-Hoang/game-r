using System;
using UnityEngine;

// Loot, vàng, rương, NPC + nhiệm vụ (port demo2)
public partial class Game
{
    // ---------- loot ----------
    void DropItem(Item it, Vector3 from, Vector3 to)
    {
        var R = Items.RAR[it.rarity];
        var g = new GameObject("loot").transform;
        var beam = Fx.LootBeam(g, R.hex, it.rarity);
        var holder = new GameObject("holder").transform;
        holder.SetParent(g, false);
        var m = Res.Inst(it.m, holder).transform;
        if (it.kind == "potion") m.localScale = Vector3.one * 1.6f;
        else if (it.kind == "weapon") m.localRotation = Quaternion.Euler(0, 0, 0.5f * Mathf.Rad2Deg);
        holder.localPosition = new Vector3(0, 0.75f, 0);
        g.position = from;
        var o = new Loot { it = it, g = g, holder = holder, beam = beam };
        loot.Add(o);
        tweens.Add(0.6f, k =>
        {
            if (!g) return;
            g.position = new Vector3(Mathf.Lerp(from.x, to.x, k), Mathf.Sin(k * Mathf.PI) * 2.6f, Mathf.Lerp(from.z, to.z, k));
            holder.localRotation = Quaternion.Euler(k * 720, 0, 0);
        }, () =>
        {
            if (!g) return;
            holder.localRotation = Quaternion.identity; g.position = new Vector3(to.x, 0, to.z); o.ready = true;
            glow.Emit(Emit.At(new Vector3(to.x, 0.3f, to.z), 12 + it.rarity * 8, 0.5f, 0.3f).Col(R.hex).Speed(1.5f, 4).Up(0.6f));
            o.label = Hud.Label(() => g ? g.position : (Vector3?)null, it.name, R.c, it.rarity >= 2 ? 2.2f : 1.6f);
            if (it.rarity == 3) { shake = 0.3f; Hud.Toast($"Rơi đồ HUYỀN THOẠI: {it.name}!", R.c); }
        });
    }

    void Pickup(Loot o)
    {
        loot.Remove(o);
        if (o.label != null) Hud.Drop(o.label);
        var g = o.g; var start = g.position;
        tweens.Add(0.3f, k => { g.position = start + Vector3.up * k * 1.8f; g.localScale = Vector3.one * (1 - k * 0.7f); }, () => Destroy(g.gameObject));
        if (S.bag.Count >= 20) { S.gold += 6 + o.it.rarity * 15; Hud.Toast($"Túi đầy, tự bán {o.it.name}", U.Html("#a8a3b8")); }
        else { S.bag.Add(o.it); Hud.Toast($"Nhặt: {o.it.name}", Items.RAR[o.it.rarity].c); }
        Hud.Vitals();
        Hud.RefreshInv();
    }

    void CoinBurst(Vector3 p, float n, int gold)
    {
        for (int i = 0; i < (int)n; i++)
        {
            var c = Res.Inst("coin").transform;
            c.localScale = Vector3.one * 1.6f;
            float a = U.Rnd * Mathf.PI * 2, r = 0.8f + U.Rnd * 1.6f;
            var to = new Vector3(p.x + Mathf.Cos(a) * r, 0.1f, p.z + Mathf.Sin(a) * r);
            float h = 1.5f + U.Rnd * 1.5f;
            tweens.Add(0.5f + U.Rnd * 0.2f, k =>
            {
                c.position = new Vector3(Mathf.Lerp(p.x, to.x, k), 0.1f + Mathf.Sin(k * Mathf.PI) * h, Mathf.Lerp(p.z, to.z, k));
                c.Rotate(23, 0, 0);
            }, () => After(0.35f + U.Rnd * 0.3f, () =>
            {
                var s = c.position;
                tweens.Add(0.35f, k =>
                {
                    var hp = HP;
                    c.position = new Vector3(Mathf.Lerp(s.x, hp.x, k), Mathf.Lerp(s.y, 1.2f, k) + Mathf.Sin(k * Mathf.PI), Mathf.Lerp(s.z, hp.z, k));
                }, () =>
                {
                    glow.Emit(Emit.At(new Vector3(c.position.x, 1.2f, c.position.z), 3, 0.3f, 0.25f).Col(0xffd36a).Speed(1, 2));
                    Destroy(c.gameObject);
                });
            }));
        }
        S.gold += gold;
        Hud.Dmg(p + Vector3.up * 0.2f, $"+{gold} vàng", "gold");
        After(1.2f, Hud.Vitals);
    }

    void OpenChest(Chest ch)
    {
        ch.opened = true;
        var p = ch.obj.position;
        if (ch.lid)
        {
            var lid0 = ch.lid.localRotation;
            tweens.Add(0.45f, k => { float e = 1 - Mathf.Pow(1 - k, 3); ch.lid.localRotation = Quaternion.AngleAxis(-109f * e, Vector3.right) * lid0; });
        }
        glow.Emit(Emit.At(p + Vector3.up * 0.9f, 50, 0.9f, 0.35f).Col(0xffd36a, 0xfff3c4, 0xffa83a).Speed(2, 6).Up(1.4f).Gravity(3));
        shake = 0.2f;
        CoinBurst(p, 12, U.RInt(25, 45) + ch.boost);
        var fwd = U.Fwd(ch.obj);
        for (int i = 0; i < ch.n; i++)
        {
            float a = (i - (ch.n - 1) / 2f) * 0.55f;
            var dir = Quaternion.AngleAxis(a * Mathf.Rad2Deg, Vector3.up) * fwd;
            After(0.25f + i * 0.16f, () => DropItem(Items.Roll(S.lvl + 1, new Items.Opt { boost = ch.boost }), p + Vector3.up * 0.6f, p + dir * 2.6f));
        }
    }

    // ---------- NPC ----------
    Npc SpawnNpc(string key, float x, float z, float rot, string name, string anim, string[] show, Action<Npc> onTalk)
    {
        var a = new Actor(key);
        a.Hide(Defs.HEROES[key].hide);
        if (show != null) a.Show(show);
        a.root.position = U.P(x, z);
        a.root.rotation = U.Rot(rot);
        a.Play(anim ?? "Idle");
        var n = new Npc { a = a, key = key, name = name, onTalk = onTalk };
        Col(x, z, 0.8f);
        npcs.Add(n);
        return n;
    }

    public void Talk()
    {
        var n = nearNpc;
        if (n == null || Busy) return;
        if (!n.seated) U.Face(n.root, HP);
        n.onTalk(n);
    }

    void SetupNpcs()
    {
        brann = SpawnNpc("Barbarian", 10, 11.5f, Mathf.PI, "Brann Bụng Bia", "Sit_Chair_Idle", new[] { "Mug" }, n =>
            Hud.Dialog(Thumbs.Get("face_Barbarian"), n.name, U.Pick(new[]
            {
                "Hầm dưới kia toàn xương khô biết đi. Ta xuống ba lần, cả ba lần đều quay lên… để uống thêm một ly.",
                "Nghe đồn Vua Xương Morvak canh rương vàng ở hầm mộ phía nam. Ai hạ được hắn thì ta bao rượu cả tháng!",
                "Lăn né đúng lúc là sống. Đứng đỡ đòn của Vua Xương là thành bột xương đấy, nhóc.",
            }), ("Cạn ly!", null, false)));
        brann.seated = true;
        Place("chair", 10, 11.5f, Mathf.PI);
        lyra = SpawnNpc("Mage", 16.5f, 11.6f, -0.65f, "Pháp Sư Lyra", "Idle", new[] { "Spellbook_open" }, LyraTalk);
        foreach (var n in npcs)
        {
            var nn = n;
            n.marker = Hud.Marker(() => nn.root ? nn.root.position : (Vector3?)null, 2.9f);
            n.marker.go.SetActive(n.key == "Mage");
        }
        // Brann thỉnh thoảng nói
        var quips = new[] { "Ê nhóc! Uống một ly đã rồi hẵng xuống hầm.", "Nghe tiếng lạch cạch dưới kia chưa? Xương đấy.", "Rương vàng ở hầm mộ… ta thề là có thật!" };
        int qi = 0;
        void Quip()
        {
            Hud.Bubble(() => brann.root ? brann.root.position : (Vector3?)null, quips[qi++ % quips.Length], 2.6f, 4.5f);
            After(9, Quip);
        }
        After(9, Quip);
    }

    void LyraTalk(Npc n)
    {
        var face = Thumbs.Get("face_Mage");
        if (S.quest == 0)
            Hud.Dialog(face, n.name, "Lũ xương trong Đại Sảnh đang ngủ, nhưng chỉ cần có người bước vào là chúng trồi dậy. Dọn sạch chúng giúp ta, phần thưởng sẽ xứng đáng.",
                ("Nhận nhiệm vụ", () =>
                {
                    S.quest = 1; Hud.Quest(); Hud.Toast("Nhận nhiệm vụ: Dọn sạch Đại Sảnh", U.Html("#9fd0ff"));
                    n.a.Play("Interact", once: true, done: () => n.a.Play("Idle"));
                }, false),
                ("Để sau", null, true));
        else if (S.quest == 1)
            Hud.Dialog(face, n.name, $"Vẫn còn {HallLeft()} bộ xương trong Đại Sảnh. Cửa ở phía đông quán.", ("Đi ngay", null, false));
        else if (S.quest == 2)
            Hud.Dialog(face, n.name, "Tuyệt vời! Đại Sảnh đã yên. Nhận lấy món này, nó từng thuộc về một hiệp sĩ huyền thoại.",
                ("Nhận thưởng", () =>
                {
                    S.quest = 3; Hud.Quest();
                    n.a.Play("Cheer", once: true, done: () => n.a.Play("Idle"));
                    var p = n.root.position;
                    DropItem(Items.Roll(S.lvl + 2, new Items.Opt { kind = "weapon", rarity = 3, legend = Items.LEGEND[0] }), p + Vector3.up, Vector3.Lerp(HP, p, 0.5f) - Vector3.up * Vector3.Lerp(HP, p, 0.5f).y);
                    CoinBurst(p, 10, 120); GainXp(60);
                }, false));
        else
            Hud.Dialog(face, n.name, "Hầm mộ phía nam là nơi Vua Xương Morvak ngự. Chuẩn bị kỹ rồi hẵng xuống.", ("Hiểu rồi", null, false));
    }
}
