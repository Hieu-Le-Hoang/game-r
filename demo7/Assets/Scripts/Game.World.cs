using System.Collections.Generic;
using UnityEngine;

// Dựng hầm ngục từ map ASCII + đặt prop/đuốc/rương (số liệu giữ nguyên demo2, toạ độ three.js)
public partial class Game
{
    class Wall { public Transform t; public Renderer[] rs; public Material[][] orig; public float op = 1; public bool faded; }
    class TorchFx { public Light L; public Vector3 p; public bool teal; public float baseI, ph; }

    readonly List<Wall> walls = new();
    readonly List<TorchFx> torches = new();
    Transform world;
    static MaterialPropertyBlock wallMpb;

    Transform Place(string key, float x, float z, float rot = 0, float y = 0, float r = 0, float scale = 1)
    {
        var o = Res.Inst(key, world).transform;
        o.position = U.P(x, z, y);
        o.rotation = U.Rot(rot);
        if (scale != 1) o.localScale = Vector3.one * scale;
        if (r > 0) colliders.Add(new Vector3(o.position.x, o.position.z, r));
        return o;
    }

    void Col(float x, float z, float r) { var p = U.P(x, z); colliders.Add(new Vector3(p.x, p.z, r)); }

    void BuildWorld()
    {
        world = new GameObject("World").transform;
        var M = Defs.MAP;
        int rows = M.Length, cols = M[0].Length;
        const float C = Defs.C;
        bool Fl(int q, int r) => Defs.Cell(q, r) != '#';

        // sàn
        for (int r = 0; r < rows; r++) for (int q = 0; q < cols; q++)
        {
            if (!Fl(q, r)) continue;
            char ch = M[r][q];
            float v = U.Rnd;
            string key = ch == 'h' && v < 0.08f ? "floor_tile_big_grate" : v < 0.22f ? "floor_tile_large_rocks" : "floor_tile_large";
            Place(key, q * C + 2, r * C + 2, Random.Range(0, 4) * Mathf.PI / 2);
        }
        // tường trên cạnh ô sàn giáp ô đặc
        void WallAt(string key, float x, float z, float rot) => AddWall(Place(key, x, z, rot));
        string Pick(char ch) { float v = U.Rnd; return v < 0.12f ? "wall_cracked" : ch == 'h' && v < 0.2f ? "wall_arched" : "wall"; }
        for (int r = 0; r < rows; r++) for (int q = 0; q < cols; q++)
        {
            if (!Fl(q, r)) continue;
            char ch = M[r][q]; float cx = q * C + 2, cz = r * C + 2;
            if (!Fl(q, r - 1)) WallAt(ch == 't' && q == 1 ? "wall_shelves" : Pick(ch), cx, r * C, 0);
            if (!Fl(q, r + 1)) WallAt(Pick(ch), cx, r * C + C, Mathf.PI);
            if (!Fl(q - 1, r)) WallAt(Pick(ch), q * C, cz, Mathf.PI / 2);
            if (!Fl(q + 1, r)) WallAt(Pick(ch), q * C + C, cz, -Mathf.PI / 2);
        }
        // cột ở góc tường
        bool H(int q, int r) => Fl(q, r) != Fl(q, r - 1);
        bool V(int q, int r) => Fl(q, r) != Fl(q - 1, r);
        for (int r = 0; r <= rows; r++) for (int q = 0; q <= cols; q++)
            if ((H(q - 1, r) || H(q, r)) && (V(q, r - 1) || V(q, r))) AddWall(Place("pillar", q * C, r * C));
        foreach (var d in Defs.DOORS)
        {
            AddWall(Place("wall_doorway", d[0], d[1], d[2]));
            Col(d[0], d[1] - 1.7f, 0.5f); Col(d[0], d[1] + 1.7f, 0.5f);
        }

        // đuốc + đèn
        Torch(7, 4, 0, 1); Torch(15, 4, 0, 1);
        Torch(30, 4, 0, 1); Torch(42, 4, 0, 1); Torch(24, 15, 1, 0); Torch(48, 14, -1, 0);
        Torch(7, 20, 0, 1, true); Torch(17, 20, 0, 1, true);

        // --- quán rượu ---
        Place("banner_patternA_blue", 11, 4); Place("banner_red", 3 * C + 2, 4);
        Place("table_long_decorated_A", 10, 9.6f); Col(8.9f, 9.6f, 1.1f); Col(11.1f, 9.6f, 1.1f);
        Place("stool", 7.4f, 11.4f, 0, 0, 0.4f); Place("stool", 12.6f, 7.7f, 0, 0, 0.4f);
        Place("keg_decorated", 18.2f, 5.8f, 0, 0, 0.9f); Place("barrel_large", 18.6f, 14.6f, 0, 0, 1);
        Place("barrel_small_stack", 5.6f, 14.6f, 0.4f, 0, 0.9f); Place("crates_stacked", 14.5f, 5.8f, 0, 0, 1.1f);
        Place("shelf_large", 5.4f, 8.5f, Mathf.PI / 2, 0, 0.8f);
        Place("candle_triple", 10.4f, 9.4f, 0, 1.0f); Place("plate_food_A", 9.4f, 9.8f, 0, 1.0f);
        // --- đại sảnh ---
        foreach (var (x, z) in new[] { (30f, 10f), (42f, 10f), (30f, 18f), (42f, 18f) }) Place("pillar_decorated", x, z, 0, 0, 1);
        Place("banner_shield_red", 36, 4); Place("banner_red", 26, 4); Place("banner_red", 46, 4);
        Place("crates_stacked", 46.5f, 6.2f, 0.3f, 0, 1.1f); Place("barrel_large", 26, 6.2f, 0, 0, 1);
        Place("box_stacked", 46.8f, 10, 0, 0, 0.9f); Place("rubble_large", 45.5f, 21.8f, 0.6f, 0, 1.2f);
        Place("rubble_half", 27, 22.4f); Place("sword_shield", 35.5f, 22.6f);
        Place("barrel_small_stack", 25.8f, 21.6f, 0, 0, 0.9f);
        // --- hầm mộ ---
        Place("banner_triple_yellow", 12, 20); Place("coin_stack_large", 5.8f, 30.4f, 0, 0, 0.5f);
        Place("coin_stack_small", 10.6f, 30.8f); Place("candle_triple", 5.3f, 21.2f); Place("candle_triple", 18.6f, 30.6f);
        Place("trunk_medium_A", 18.2f, 21.6f, -Mathf.PI / 2, 0, 0.9f); Place("rubble_half", 15.6f, 30.6f, 1.2f);
        Place("column", 6, 25, 0, 0, 0.5f); Place("column", 18, 25, 0, 0, 0.5f);

        // rương
        void ChestAt(string key, float x, float z, float rot, int boost, int n)
        {
            var o = Place(key, x, z, rot, 0, 1);
            chests.Add(new Chest { obj = o, lid = U.Find(o, "chest_lid") ?? U.Find(o, key + "_lid"), boost = boost, n = n });
        }
        ChestAt("chest", 36, 6.2f, 0, 10, 3);
        ChestAt("chest_gold", 8.5f, 30.4f, Mathf.PI, 30, 4);
    }

    void AddWall(Transform t)
    {
        var rs = t.GetComponentsInChildren<Renderer>();
        var w = new Wall { t = t, rs = rs, orig = new Material[rs.Length][] };
        for (int i = 0; i < rs.Length; i++) w.orig[i] = rs[i].sharedMaterials;
        walls.Add(w);
    }

    void Torch(float x, float z, float nx, float nz, bool teal = false)
    {
        Place("torch_mounted", x + nx * 0.5f, z + nz * 0.5f, Mathf.Atan2(nx, nz), 2.4f);
        float fx = x + nx * 0.95f, fz = z + nz * 0.95f, fy = 3.15f;
        var lg = new GameObject("TorchLight");
        lg.transform.SetParent(world);
        lg.transform.position = U.P(fx + nx * 0.3f, fz + nz * 0.3f, fy);
        var L = lg.AddComponent<Light>();
        L.type = LightType.Point;
        L.color = teal ? U.Hex(0x3cf0c0) : U.Hex(0xff8a3c);
        L.range = teal ? 9.5f : 12;
        L.intensity = teal ? TORCH_TEAL : TORCH;
        L.shadows = LightShadows.None;
        L.cullingMask = ~(1 << Thumbs.LAYER);
        torches.Add(new TorchFx { L = L, p = U.P(fx, fz, fy), teal = teal, baseI = L.intensity, ph = U.Rnd * 10 });
    }

    // ---------- cập nhật thế giới mỗi frame ----------
    void UpdateWorld(float dt)
    {
        var hp = HP; float t = now;
        // fade tường che nhân vật (tường nằm giữa hero và camera)
        var fadeMat = Res.Mat("WallFade");
        wallMpb ??= new MaterialPropertyBlock();
        foreach (var w in walls)
        {
            float dz = hp.z - w.t.position.z, dx = Mathf.Abs(w.t.position.x - hp.x);
            bool hide = dz > 0.3f && dz < 7.5f && dx < 3.6f;
            float target = hide ? 0 : 1;
            if (Mathf.Abs(w.op - target) <= 0.01f) continue;
            w.op = U.Damp(w.op, target, 12, dt);
            if (Mathf.Abs(w.op - target) < 0.02f) w.op = target;
            bool fade = w.op < 0.99f;
            for (int i = 0; i < w.rs.Length; i++)
            {
                var r = w.rs[i];
                r.enabled = w.op > 0.04f;
                if (fade != w.faded)
                {
                    if (fade) { var arr = new Material[w.orig[i].Length]; for (int j = 0; j < arr.Length; j++) arr[j] = fadeMat; r.sharedMaterials = arr; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
                    else { r.sharedMaterials = w.orig[i]; r.SetPropertyBlock(null); r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On; }
                }
                if (fade) { wallMpb.SetColor("_BaseColor", new Color(1, 1, 1, w.op)); r.SetPropertyBlock(wallMpb); }
            }
            w.faded = fade;
        }
        // đuốc chập chờn
        foreach (var T in torches)
        {
            float f = 0.82f + Mathf.Sin(t * 9 + T.ph) * 0.08f + Mathf.Sin(t * 23 + T.ph * 2) * 0.06f + U.Rnd * 0.05f;
            T.L.intensity = T.baseI * f;
            if (U.Rnd < 0.55f)
                glow.Emit(Emit.At(T.p, 1, 0.55f, 0.45f, 0.05f).Col(T.teal ? new uint[] { 0x5cf5d0, 0x2ad8b0, 0xc8fff0 } : new uint[] { 0xffb347, 0xff7a1a, 0xffe08a })
                    .Speed(0.2f, 0.7f).Dir(new Vector3(0, 1.4f, 0)).Spread(0.18f).Drag(0.5f));
        }
        // bụi lơ lửng quanh nhân vật
        if (U.Rnd < 0.25f)
            glow.Emit(Emit.At(new Vector3(hp.x + (U.Rnd - 0.5f) * 16, 0.5f + U.Rnd * 3, hp.z + (U.Rnd - 0.5f) * 12), 1, 4, 0.09f, 0.04f).Col(0xffe2b0).Speed(0.05f, 0.25f).Alpha(0.5f).Drag(0));
        // loot
        foreach (var o in loot.ToArray())
        {
            o.holder.Rotate(0, dt * 1.6f * Mathf.Rad2Deg, 0, Space.World);
            var lp = o.holder.localPosition; lp.y = 0.75f + Mathf.Sin(t * 2.4f + o.it.id) * 0.12f; o.holder.localPosition = lp;
            if (o.beam) { var c = Items.RAR[o.it.rarity].hex * 1.6f; c.a = 0.65f + Mathf.Sin(t * 3 + o.it.id) * 0.3f; Fx.SetColor(o.beam, c); }
            if (o.ready && U.FlatDist(o.g.position, hp) < 1.4f) Pickup(o);
        }
        // rương
        foreach (var ch in chests) if (!ch.opened && Vector3.Distance(ch.obj.position, hp) < 2.4f) OpenChest(ch);
        // NPC gần
        Npc near = null;
        foreach (var n in npcs) { n.a.Tick(); if (Vector3.Distance(n.root.position, hp) < 3.2f) near = n; }
        nearNpc = near;
        Hud.TalkButton(near != null && !Busy && state != "dead");
        if (lyra != null && lyra.marker != null)
        {
            lyra.marker.text.text = S.quest == 2 ? "?" : "!";
            lyra.marker.go.SetActive(S.quest == 0 || S.quest == 2);
        }
        // khu vực
        int q = Mathf.FloorToInt(hp.x / Defs.C), rr = Mathf.FloorToInt(-hp.z / Defs.C);
        char cch = Defs.Cell(q, rr);
        if (cch != '.' && cch != '#' && cch != area)
        {
            area = cch;
            for (int r2 = 0; r2 < Defs.MAP.Length; r2++) for (int q2 = 0; q2 < Defs.MAP[0].Length; q2++) if (Defs.MAP[r2][q2] == cch) seen.Add(new Vector2Int(q2, r2));
            if (areaSeen.Add(cch)) Hud.Banner(Defs.AREAS[cch][0], Defs.AREAS[cch][1]);
        }
        if (cch == '.') seen.Add(new Vector2Int(q, rr));
    }

    // ---------- va chạm (lưới map + vòng tròn), toạ độ Unity ----------
    bool Free(float x, float z, float r)
    {
        bool F(float a, float b) => Defs.FloorAt(a, -b);
        if (!F(x - r, z) || !F(x + r, z) || !F(x, z - r) || !F(x, z + r)) return false;
        float d = r * 0.7f;
        if (!F(x - d, z - d) || !F(x + d, z - d) || !F(x - d, z + d) || !F(x + d, z + d)) return false;
        foreach (var c in colliders) if ((x - c.x) * (x - c.x) + (z - c.y) * (z - c.y) < (r + c.z) * (r + c.z)) return false;
        return true;
    }

    void Move(Transform t, float dx, float dz, float r = 0.95f)
    {
        var p = t.position;
        if (Free(p.x + dx, p.z, r)) p.x += dx;
        if (Free(p.x, p.z + dz, r)) p.z += dz;
        t.position = p;
    }

    char CellOf(Vector3 p) => Defs.CellAt(p.x, -p.z);
}
