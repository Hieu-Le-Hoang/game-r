using UnityEngine;

// Hero, quái, chiêu thức, đạn phép, sát thương, XP (port demo2)
public partial class Game
{
    // ---------- hero ----------
    void SpawnHero(string key, Vector3 pos, float rotRad, Quaternion? rot = null)
    {
        hero?.Dispose();
        def = Defs.HEROES[key];
        hero = new Actor(key);
        hero.Hide(def.hide);
        hero.root.position = pos;
        hero.root.rotation = rot ?? U.Rot(rotRad);
        S.hero = key;
        EquipVisual();
        hero.Play(def.idle);
        state = "idle";
        Hud.Hero(def);
    }

    void EquipVisual()
    {
        string wm = S.weapon?.m;
        bool two = wm == "sword_2handed" || wm == "axe_2handed" || wm == "staff";
        string refR = def.key switch { "Knight" => two ? "2H_Sword" : "1H_Sword", "Barbarian" => two ? "2H_Axe" : "1H_Axe", _ => two ? "2H_Staff" : "1H_Wand" };
        string refL = def.key switch { "Knight" => "Round_Shield", "Barbarian" => "Barbarian_Round_Shield", _ => null };
        hero.Attach('r', wm, refR);
        hero.Attach('l', S.shield?.m, refL);
    }

    public void SwitchHero(string key)
    {
        if (key == S.hero || state == "dead") return;
        var p = HP; var r = hero.root.rotation;
        SpawnHero(key, p, 0, r);
        glow.Emit(Emit.At(p + Vector3.up, 40, 0.8f, 0.4f).Col(0xffe08a).Speed(2, 6).Up(1.2f));
        Fx.Shock(p, 0xffd27a, 3.2f, 0.5f);
        Hud.Toast($"Đổi sang {Defs.HEROES[key].name}", U.Html("#f5c451"));
    }

    public void EquipChanged(Item it)
    {
        EquipVisual();
        var p = HP;
        glow.Emit(Emit.At(p + Vector3.up * 1.2f, 26, 0.7f, 0.35f).Col(Items.RAR[it.rarity].hex).Speed(1.5f, 4).Up(1));
        Hud.Toast($"Trang bị: {it.name}", Items.RAR[it.rarity].c);
    }

    public void Refresh() { ST = S.Calc(); S.hp = Mathf.Min(S.hp, ST.maxHp); S.mp = Mathf.Min(S.mp, ST.maxMp); Hud.Vitals(); }

    // ---------- quái ----------
    Enemy SpawnEnemy(string type, Vector3 pos, float? rot = null, bool dormant = false, char room = ' ', int lvl = 1)
    {
        var d = Defs.ENEMIES[type];
        var a = new Actor(d.key, d.scale);
        if (d.weapon != null) a.Attach('r', d.weapon);
        if (d.shield != null) a.Attach('l', d.shield);
        a.root.position = pos;
        a.root.rotation = rot.HasValue ? U.Rot(rot.Value) : Quaternion.Euler(0, U.Rnd * 360, 0);
        int hp = Mathf.RoundToInt(d.hp * (1 + (lvl - 1) * 0.15f));
        var e = new Enemy { a = a, def = d, type = type, hp = hp, max = hp, lvl = lvl, state = dormant ? "dormant" : "idle", room = room };
        if (dormant) a.Play("Skeletons_Inactive_Floor_Pose", once: true);
        else a.Play("Idle");
        enemies.Add(e);
        return e;
    }

    // ---------- chiến đấu ----------
    Enemy NearestEnemy(float range)
    {
        Enemy best = null; float bd = range;
        foreach (var e in enemies)
        {
            if (!e.alive || e.state == "dormant" || e.state == "awaken") continue;
            float d = Vector3.Distance(e.root.position, HP);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    static bool Active(Enemy e) => e.alive && e.state != "dormant" && e.state != "awaken";

    void DamageEnemy(Enemy e, float baseDmg, bool fire = false, bool noFire = false, float slow = 0)
    {
        if (!e.alive) return;
        bool crit = U.Rnd * 100 < ST.crit;
        int d = Mathf.Max(1, Mathf.RoundToInt(baseDmg * ST.mult * (crit ? 1 + ST.critDmg / 100 : 1)) + (noFire ? 0 : Mathf.RoundToInt(ST.fire)));
        e.hp -= d;
        var p = e.root.position;
        Hud.Dmg(p + Vector3.up * e.def.scale * 0.6f, crit ? $"{d}!" : $"{d}", crit ? "crit" : fire ? "fire" : "");
        glow.Emit(Emit.At(new Vector3(p.x, 1.2f * e.def.scale, p.z), crit ? 22 : 12, 0.35f, 0.28f)
            .Col(fire ? new uint[] { 0xff9a3a, 0xffd36a } : new uint[] { 0xfff2c0, 0xffffff }).Speed(3, 7).Up(0.8f));
        e.a.Flash();
        if (crit) { shake = Mathf.Max(shake, 0.25f); Hitstop(0.05f); }
        if (!e.def.boss) { var dir = U.FlatDir(HP, p); Move(e.root, dir.x * 0.45f, dir.z * 0.45f, 0.7f); }
        if (ST.ls > 0) S.hp = Mathf.Min(ST.maxHp, S.hp + Mathf.Max(1, Mathf.RoundToInt(d * ST.ls / 100)));
        if (slow > 0) { e.slow = now + slow; }
        if (e.hp <= 0) { KillEnemy(e); return; }
        if (e.state == "dormant" || e.state == "awaken") return;
        if (!e.def.boss && e.state != "attack")
        {
            e.state = "hit";
            e.a.Play(U.Rnd < 0.5f ? "Hit_A" : "Hit_B", once: true, speed: 1.4f, done: () => { if (e.alive) e.state = "chase"; });
        }
        if (e.bar == null && !e.def.boss) e.bar = Hud.HpBar(() => e.root ? e.root.position : (Vector3?)null, 2.6f * e.def.scale);
        if (e.bar != null) Hud.SetBar(e.bar, (float)e.hp / e.max);
        if (e.def.boss) Hud.Boss(e);
    }

    void KillEnemy(Enemy e)
    {
        e.alive = false; e.state = "dead";
        if (e.bar != null) { Hud.Drop(e.bar); e.bar = null; }
        var p = e.root.position;
        e.a.Play(e.a.Has("Death_C_Skeletons") ? "Death_C_Skeletons" : "Death_A", once: true);
        dust.Emit(Emit.At(p + Vector3.up * 0.4f, e.def.boss ? 60 : 24, 1.2f, 0.9f, 0.2f).Col(0x6b6478, 0x4a4456, 0x8a8296).Speed(0.5f, 2.5f).Alpha(0.55f).Up(0.4f).Drag(2));
        GainXp(e.def.xp + e.lvl * 2);
        if (ST.powers.Contains("boom")) Explode(p, 3, 14, 0xff7a2a);
        int n = e.def.boss ? 4 : U.Rnd < 0.6f ? 1 : 0;
        for (int i = 0; i < n; i++)
        {
            float ang = U.Rnd * Mathf.PI * 2; int idx = i;
            After(0.25f + i * 0.15f, () => DropItem(Items.Roll(e.lvl + 1, new Items.Opt { boost = e.def.boss ? 30 : ST.mf / 2, rarity = e.def.boss && idx == 0 ? 3 : null }),
                p, new Vector3(p.x + Mathf.Cos(ang) * 1.6f, 0, p.z + Mathf.Sin(ang) * 1.6f)));
        }
        int gold = U.RInt(3, 9) * (e.def.boss ? 8 : 1);
        After(0.3f, () => CoinBurst(p, Mathf.Min(14, 3 + gold / 3), gold));
        if (e.def.boss) { Hud.Boss(null); shake = 0.6f; Hud.Banner("Vua Xương đã ngã", "Chiến thắng"); }
        if (e.room == 'h' && S.quest == 1 && HallLeft() == 0) { S.quest = 2; Hud.Toast("Đại Sảnh đã sạch! Quay lại gặp Pháp Sư Lyra.", U.Html("#7be38a")); }
        Hud.Quest();
        After(3.2f, () => tweens.Add(1.2f, k => { if (e.root) { var q = e.root.position; q.y = -k * 1.4f; e.root.position = q; } }, () => { e.a.Dispose(); enemies.Remove(e); }));
    }

    void Explode(Vector3 p, float rad, int dmg, uint color)
    {
        Fx.Shock(p, color, rad, 0.4f);
        glow.Emit(Emit.At(p + Vector3.up * 0.8f, 40, 0.5f, 0.5f).Col(color, 0xffd36a, 0xffffff).Speed(3, 9).Up(0.9f));
        foreach (var e in enemies.ToArray()) if (e.alive && e.state != "dormant" && Vector3.Distance(e.root.position, p) < rad) DamageEnemy(e, dmg, fire: true, noFire: true);
    }

    void HurtHero(int d)
    {
        if (state == "dead" || now < invuln) return;
        d = Mathf.Max(1, Mathf.RoundToInt(d * (1 - Mathf.Min(0.6f, ST.armor / 70f))));
        S.hp -= d;
        if (god) S.hp = Mathf.Max(S.hp, ST.maxHp * 0.5f);
        Hud.Dmg(HP + Vector3.up * 0.3f, $"-{d}", "hurt");
        shake = Mathf.Max(shake, 0.2f);
        Hud.Hurt();
        if (S.hp <= 0) { HeroDie(); return; }
        if (state == "idle" || state == "run")
        {
            state = "hit";
            hero.Play("Hit_A", once: true, speed: 1.6f, done: () => { if (state == "hit") state = "idle"; });
        }
        Hud.Vitals();
    }

    void HeroDie()
    {
        state = "dead"; S.hp = 0;
        hero.Play("Death_A", once: true);
        Hud.Banner("Bạn đã gục ngã", "Hồi sinh tại quán rượu");
        After(3, () =>
        {
            S.hp = ST.maxHp; S.mp = ST.maxMp; S.gold = Mathf.FloorToInt(S.gold * 0.85f);
            hero.root.position = U.P(8.5f, 13.5f);
            state = "idle"; hero.Play(def.idle);
            invuln = now + 2;
            Hud.Vitals();
        });
    }

    void GainXp(int n)
    {
        S.xp += n;
        while (S.xp >= S.XpNeed)
        {
            S.xp -= S.XpNeed; S.lvl++;
            ST = S.Calc(); S.hp = ST.maxHp; S.mp = ST.maxMp;
            var p = HP;
            Fx.Shock(p, 0xffd27a, 4, 0.6f); After(0.15f, () => Fx.Shock(HP, 0xfff0b0, 2.6f, 0.5f));
            for (int i = 0; i < 6; i++)
                After(i * 0.08f, () => glow.Emit(Emit.At(HP + Vector3.up * 0.2f, 14, 0.9f, 0.35f).Col(0xffd27a, 0xfff3c4).Speed(3, 6).Dir(new Vector3(0, 3, 0)).Spread(1.2f)));
            Hud.Dmg(p + Vector3.up * 0.6f, $"LÊN CẤP {S.lvl}!", "big");
            Hud.Toast($"Lên cấp {S.lvl}: +12 máu, +8 mana", U.Html("#f5c451"));
        }
        Hud.Vitals();
    }

    // ---------- hành động của hero ----------
    bool HeroBusy => state == "attack" || state == "skill" || state == "dodge" || state == "dead";

    public void Attack(Enemy tgt)
    {
        if (HeroBusy || now < atkReady || Busy) return;
        var h = hero;
        tgt = tgt != null && tgt.alive ? tgt : NearestEnemy(def.magic ? 14 : 3.4f);
        if (tgt != null) U.Face(h.root, tgt.root.position);
        state = "attack";
        combo = (combo + 1) % def.atk.Length;
        float sp = ST.speed * (def.magic ? 1.25f : 1.15f);
        float dur = h.Play(def.atk[combo], once: true, speed: sp, fade: 0.08f, done: () => { if (state == "attack") state = "idle"; });
        atkReady = now + dur * 0.62f;
        cancelAt = now + dur * 0.6f;
        var heroAtStart = h;
        After(dur * (def.magic ? 0.42f : 0.36f), () =>
        {
            if (state == "dead" || hero != heroAtStart) return;
            var p = HP; var fwd = U.Fwd(h.root);
            if (def.magic)
            {
                var dir = tgt != null && tgt.alive ? U.FlatDir(p, tgt.root.position) : fwd;
                FireBolt(p + dir * 0.9f + Vector3.up * 1.4f, dir, true, U.RInt(ST.dmg[0], ST.dmg[1]) + 3, 0x7fc8ff);
            }
            else
            {
                Fx.Slash(p + fwd * 0.6f, h.root.eulerAngles.y, 0xfff0c8, 2.0f);
                bool hit = false;
                foreach (var e in enemies.ToArray())
                {
                    if (!Active(e)) continue;
                    var v = e.root.position - p; v.y = 0;
                    if (v.magnitude < 2.9f + (e.def.boss ? 1 : 0) && Vector3.Dot(v.normalized, fwd) > 0.2f) { DamageEnemy(e, U.RInt(ST.dmg[0], ST.dmg[1])); hit = true; }
                }
                if (hit) shake = Mathf.Max(shake, 0.12f);
            }
            if (ST.powers.Contains("fireProc") && U.Rnd < 0.25f) FireBolt(p + fwd * 0.8f + Vector3.up * 1.3f, fwd, true, 12, 0xff8a2a, true);
        });
    }

    public void Skill()
    {
        if (HeroBusy || now < cdQ || Busy) return;
        int cost = ST.powers.Contains("freeSkill") ? 0 : 20;
        if (S.mp < cost) { Hud.Dmg(HP, "Hết mana", "heal"); return; }
        S.mp -= cost; cdQ = now + 4;
        var h = hero;
        state = "skill";
        if (def.magic)
        {
            float dur = h.Play(def.skill, once: true, speed: 1.6f, done: () => { if (state == "skill") state = "idle"; });
            After(dur * 0.5f, () =>
            {
                var q = HP;
                Fx.Shock(q, 0x8fd8ff, 6, 0.55f); Fx.Shock(q, 0xffffff, 4, 0.35f);
                glow.Emit(Emit.At(q + Vector3.up * 0.4f, 90, 0.6f, 0.45f).Col(0x8fd8ff, 0xd8f4ff, 0x5aa2ff).Speed(6, 12).Flat());
                shake = 0.3f;
                foreach (var e in enemies.ToArray()) if (Active(e) && Vector3.Distance(e.root.position, q) < 6) DamageEnemy(e, U.RInt(ST.dmg[0], ST.dmg[1]) * 1.4f + 6, slow: 2.5f);
            });
        }
        else
        {
            float dur = h.Play(def.skill, once: true, speed: 1.35f, done: () => { if (state == "skill") state = "idle"; });
            foreach (var k in new[] { 0.3f, 0.6f })
                After(dur * k, () =>
                {
                    var q = HP;
                    Fx.Shock(q, 0xcfe6ff, 3.6f, 0.35f);
                    glow.Emit(Emit.At(q + Vector3.up, 30, 0.35f, 0.3f).Col(0xcfe6ff, 0xffffff).Speed(4, 8).Flat());
                    dust.Emit(Emit.At(q + Vector3.up * 0.2f, 14, 0.8f, 0.9f, 0.3f).Col(0x5a5048, 0x766a5e).Speed(2, 4).Alpha(0.45f).Flat());
                    shake = Mathf.Max(shake, 0.18f);
                    foreach (var e in enemies.ToArray()) if (Active(e) && Vector3.Distance(e.root.position, q) < 3.6f) DamageEnemy(e, U.RInt(ST.dmg[0], ST.dmg[1]) * 0.9f + 2);
                });
        }
        Hud.Vitals();
    }

    public void Dodge()
    {
        if (state == "dead" || state == "dodge" || now < cdE || Busy) return;
        var h = hero;
        var dir = InputDir() ?? U.Fwd(h.root);
        h.root.rotation = Quaternion.LookRotation(dir);
        state = "dodge"; cdE = now + 1.2f; invuln = now + 0.45f;
        dashV = dir * 13; dashEnd = now + 0.32f;
        h.Play("Dodge_Forward", once: true, speed: 1.5f, fade: 0.05f, done: () => { if (state == "dodge") state = "idle"; });
        dust.Emit(Emit.At(HP + Vector3.up * 0.2f, 12, 0.7f, 0.8f, 0.3f).Col(0x5a5048, 0x766a5e).Speed(1, 2.5f).Alpha(0.5f).Up(0.3f));
    }

    public void Drink()
    {
        if (state == "dead" || now < cdR) return;
        int i = S.bag.FindIndex(it => it.kind == "potion");
        if (i < 0) { Hud.Toast("Hết bình máu", U.Html("#ff7a6b")); return; }
        S.bag.RemoveAt(i); cdR = now + 5;
        int heal = Mathf.RoundToInt(ST.maxHp * 0.45f);
        S.hp = Mathf.Min(ST.maxHp, S.hp + heal);
        Hud.Dmg(HP + Vector3.up * 0.4f, $"+{heal}", "heal");
        for (int k = 0; k < 5; k++)
            After(k * 0.07f, () => glow.Emit(Emit.At(HP + Vector3.up * 0.3f, 10, 0.8f, 0.3f).Col(0x7be38a, 0xc8ffd0).Speed(1, 2).Dir(new Vector3(0, 2.5f, 0)).Spread(1.4f)));
        Hud.Vitals();
        Hud.RefreshInv();
    }

    // ---------- đạn phép ----------
    void FireBolt(Vector3 pos, Vector3 dir, bool byHero, int dmg, uint color, bool fire = false)
    {
        var m = Fx.Orb(color, byHero ? 0.22f : 0.26f);
        m.position = pos;
        bolts.Add(new Bolt { m = m, v = dir * (byHero ? 17 : 10), byHero = byHero, dmg = dmg, color = color, life = 1.6f, fire = fire });
    }

    void UpdateBolts(float dt)
    {
        for (int i = bolts.Count - 1; i >= 0; i--)
        {
            var b = bolts[i];
            b.m.position += b.v * dt;
            b.life -= dt;
            var p = b.m.position;
            glow.Emit(Emit.At(p, 2, 0.35f, 0.32f).Col(b.color, 0xffffff).Speed(0.2f, 0.8f).Spread(0.15f));
            Enemy hitE = null; bool hitHero = false;
            if (b.byHero) { foreach (var e in enemies) if (Active(e) && U.FlatDist(e.root.position, p) < 0.9f * e.def.scale) { hitE = e; break; } }
            else if (U.FlatDist(HP, p) < 0.8f) hitHero = true;
            if (hitE != null || hitHero || b.life <= 0 || !Defs.FloorAt(p.x, -p.z))
            {
                glow.Emit(Emit.At(p, 26, 0.4f, 0.35f).Col(b.color, 0xffffff).Speed(2, 6));
                Fx.Shock(p, b.color, 1.4f, 0.25f, 0.1f);
                if (hitHero) HurtHero(b.dmg);
                else if (hitE != null) DamageEnemy(hitE, b.dmg, fire: b.fire);
                Destroy(b.m.gameObject);
                bolts.RemoveAt(i);
            }
        }
    }

    // ---------- cập nhật hero ----------
    void UpdateHero(float dt)
    {
        var h = hero; var t = h.root;
        S.mp = Mathf.Min(ST.maxMp, S.mp + dt * (4 + ST.intel * 0.15f));
        if (state == "dead") return;
        if (state == "dodge")
        {
            if (now < dashEnd)
            {
                Move(t, dashV.x * dt, dashV.z * dt);
                if (U.Rnd < 0.5f) dust.Emit(Emit.At(HP + Vector3.up * 0.15f, 1, 0.5f, 0.6f, 0.2f).Col(0x6a5f55).Speed(0.3f, 1).Alpha(0.4f));
            }
            return;
        }
        var dir = InputDir();
        if (dir.HasValue) { goal = null; target = null; }
        if (state == "attack" || state == "skill")
        {
            if (dir.HasValue && state == "attack" && now > cancelAt) state = "idle";
            else return;
        }
        var p = t.position;
        if (!dir.HasValue && target != null)
        {
            if (!target.alive) target = null;
            else
            {
                var tp = target.root.position; float d = U.FlatDist(tp, p);
                float reach = def.magic ? 11 : 2.4f + (target.def.boss ? 1 : 0);
                if (d <= reach) { Attack(target); return; }
                dir = U.FlatDir(p, tp);
            }
        }
        else if (!dir.HasValue && goal.HasValue)
        {
            float d = U.FlatDist(goal.Value, p);
            if (d < 0.35f) goal = null; else dir = U.FlatDir(p, goal.Value);
        }
        if (dir.HasValue)
        {
            const float sp = 6.4f;
            var o = t.position;
            Move(t, dir.Value.x * sp * dt, dir.Value.z * sp * dt);
            if (goal.HasValue && U.FlatDist(t.position, o) < sp * dt * 0.2f) goal = null;
            t.rotation = Quaternion.Slerp(t.rotation, Quaternion.LookRotation(dir.Value), 1 - Mathf.Exp(-14 * dt));
            if (state != "hit") { state = "run"; h.Play("Running_A", speed: 1.05f); }
        }
        else if (state == "run") { state = "idle"; h.Play(def.idle); }
        else if (state == "idle" && h.cur != def.idle) h.Play(def.idle);
    }

    // ---------- AI quái ----------
    void UpdateEnemies(float dt)
    {
        var hp = HP;
        char hc = CellOf(hp);
        bool inCrypt = hc == 'c' || (hc == '.' && -hp.z > 20);
        foreach (var e in enemies.ToArray())
        {
            e.a.timeScale = e.slow > now ? 0.5f : 1;
            e.a.Tick();
            if (!e.alive) continue;
            var t = e.root; var p = t.position; float d = U.FlatDist(hp, p);
            var dd = e.def; float sc = dd.scale;
            if (e.state == "dormant")
            {
                if (d < 9 && state != "dead" && (hc == 'h' || hc == '.'))
                {
                    e.state = "awaken";
                    e.a.Play("Skeletons_Awaken_Floor", once: true, speed: 1.35f, done: () => { if (e.alive) e.state = "chase"; });
                    dust.Emit(Emit.At(p + Vector3.up * 0.2f, 18, 1.1f, 1, 0.3f).Col(0x5a5048, 0x766a5e).Speed(1, 3).Alpha(0.5f).Up(0.5f));
                }
                continue;
            }
            if (e.state == "idle")
            {
                if (d < 11 && state != "dead" && inCrypt)
                {
                    e.state = "taunt"; U.Face(t, hp);
                    if (dd.boss) { Hud.Boss(e); Hud.Banner(dd.name, "Trùm xuất hiện"); shake = 0.35f; }
                    e.a.Play("Taunt", once: true, speed: 1.2f, done: () => { if (e.alive) e.state = "chase"; });
                }
                continue;
            }
            if (e.state == "awaken" || e.state == "taunt" || e.state == "hit") continue;
            if (dd.boss && e.state == "chase" && !inCrypt) { e.state = "idle"; e.a.Play("Idle"); Hud.Boss(null); continue; }
            if (e.state == "attack") continue;
            if (state == "dead") { if (e.a.cur != "Idle") e.a.Play("Idle"); continue; }
            float range = dd.range;
            if (d > range)
            {
                float spd = dd.spd * (e.slow > now ? 0.45f : 1);
                float vx = (hp.x - p.x) / d, vz = (hp.z - p.z) / d;
                foreach (var o in enemies)
                {
                    if (o == e || !o.alive) continue;
                    float ox = p.x - o.root.position.x, oz = p.z - o.root.position.z, od = Mathf.Sqrt(ox * ox + oz * oz);
                    if (od < 1.4f * Mathf.Max(sc, o.def.scale) && od > 0.001f) { vx += ox / od * 0.8f; vz += oz / od * 0.8f; }
                }
                float l = Mathf.Sqrt(vx * vx + vz * vz); if (l < 1e-4f) l = 1;
                Move(t, vx / l * spd * dt, vz / l * spd * dt, 0.6f * sc);
                t.rotation = Quaternion.Slerp(t.rotation, Quaternion.LookRotation(new Vector3(vx, 0, vz)), 1 - Mathf.Exp(-10 * dt));
                e.a.Play(dd.run, speed: dd.run == "Running_A" ? 0.95f : 1.25f);
            }
            else if (now > e.atkReady)
            {
                e.state = "attack"; U.Face(t, hp);
                float dur = e.a.Play(dd.atk, once: true, speed: dd.boss ? 0.9f : 1.1f, fade: 0.1f, done: () => { if (e.alive) e.state = "chase"; });
                e.atkReady = now + dd.cd;
                if (dd.boss) Fx.Telegraph(p + U.Fwd(t) * 1.8f, 2.8f, dur * dd.hitT);
                After(dur * dd.hitT, () =>
                {
                    if (!e.alive || e.state != "attack") return;
                    var q = HP; var ep = e.root.position; var fwd = U.Fwd(e.root);
                    if (dd.ranged)
                    {
                        var dir = U.FlatDir(ep, q);
                        FireBolt(ep + dir * 0.8f + Vector3.up * 1.5f, dir, false, U.RInt(dd.dmg[0], dd.dmg[1]), 0xb46bff);
                    }
                    else
                    {
                        var v = q - ep; v.y = 0;
                        if (dd.boss)
                        {
                            Fx.Shock(ep + fwd * 1.8f, 0xff6a3a, 3, 0.35f); shake = 0.35f;
                            dust.Emit(Emit.At(ep + fwd * 1.8f + Vector3.up * 0.2f, 20, 0.9f, 1, 0.3f).Col(0x5a5048, 0x766a5e).Speed(2, 4).Alpha(0.5f).Flat());
                        }
                        if (v.magnitude < range + 0.9f && Vector3.Dot(v.normalized, fwd) > 0.1f) HurtHero(U.RInt(dd.dmg[0], dd.dmg[1]) + e.lvl);
                    }
                });
            }
            else
            {
                U.Face(t, hp);
                if (e.a.Has("Idle_Combat")) e.a.Play("Idle_Combat"); else e.a.Play("Idle");
            }
        }
    }
}
