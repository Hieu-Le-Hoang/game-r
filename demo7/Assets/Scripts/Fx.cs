using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

// ---------- tween nhẹ (giống demo2) ----------
public class Tweens
{
    class T { public float t, dur; public Action<float> fn; public Action done; }
    readonly List<T> list = new();
    public void Add(float dur, Action<float> fn, Action done = null) => list.Add(new T { dur = dur, fn = fn, done = done });
    public void Update(float dt)
    {
        for (int i = list.Count - 1; i >= 0; i--)
        {
            var t = list[i];
            t.t += dt;
            float k = Mathf.Min(1, t.t / t.dur);
            t.fn(k);
            if (k >= 1) { list.Remove(t); t.done?.Invoke(); }
        }
    }
}

// Tham số phát hạt — đặt tên giống object `o` trong demo2 để port 1:1
public struct Emit
{
    public Vector3 pos;
    public int count;
    public Color color;
    public Color[] colors;
    public float spMin, spMax, life, s0, s1, alpha, up, spread, drag, gravity;
    public Vector3? dir;
    public bool flat, hasUp;

    public static Emit At(Vector3 p, int count, float life, float s0, float s1 = 0) => new Emit
    {
        pos = p, count = count, color = Color.white, spMin = 1, spMax = 3, life = life, s0 = s0, s1 = s1,
        alpha = 1, spread = 0.2f, drag = 1.5f,
    };
    public Emit Speed(float a, float b) { spMin = a; spMax = b; return this; }
    public Emit Col(params uint[] hex) { if (hex.Length == 1) color = U.Hex(hex[0]); else { colors = new Color[hex.Length]; for (int i = 0; i < hex.Length; i++) colors[i] = U.Hex(hex[i]); } return this; }
    public Emit Col(Color c) { color = c; return this; }
    public Emit Up(float u) { up = u; hasUp = true; return this; }
    public Emit Dir(Vector3 d) { dir = d; return this; }
    public Emit Flat() { flat = true; return this; }
    public Emit Spread(float s) { spread = s; return this; }
    public Emit Alpha(float a) { alpha = a; return this; }
    public Emit Drag(float d) { drag = d; return this; }
    public Emit Gravity(float g) { gravity = g; return this; }
}

// ---------- particle CPU (1 mesh billboard, 1 draw call) — cùng thuật toán với demo2 ----------
public class Particles
{
    readonly int cap;
    int n;
    readonly Vector3[] pos, vel;
    readonly Color[] col;
    readonly float[] life, max, s0, s1, a0, grav, drag;
    readonly Vector3[] verts;
    readonly Color[] vcol;
    readonly Mesh mesh;

    public Particles(string name, Material mat, int cap)
    {
        this.cap = cap;
        pos = new Vector3[cap]; vel = new Vector3[cap]; col = new Color[cap];
        life = new float[cap]; max = new float[cap]; s0 = new float[cap]; s1 = new float[cap];
        a0 = new float[cap]; grav = new float[cap]; drag = new float[cap];
        verts = new Vector3[cap * 4]; vcol = new Color[cap * 4];
        var uv = new Vector2[cap * 4];
        var tri = new int[cap * 6];
        for (int i = 0; i < cap; i++)
        {
            uv[i * 4] = new Vector2(0, 0); uv[i * 4 + 1] = new Vector2(1, 0); uv[i * 4 + 2] = new Vector2(1, 1); uv[i * 4 + 3] = new Vector2(0, 1);
            tri[i * 6] = i * 4; tri[i * 6 + 1] = i * 4 + 2; tri[i * 6 + 2] = i * 4 + 1;
            tri[i * 6 + 3] = i * 4; tri[i * 6 + 4] = i * 4 + 3; tri[i * 6 + 5] = i * 4 + 2;
        }
        mesh = new Mesh { name = name, indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        mesh.MarkDynamic();
        mesh.vertices = verts; mesh.colors = vcol; mesh.uv = uv; mesh.triangles = tri;
        mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 2000);
        var go = new GameObject(name);
        go.AddComponent<MeshFilter>().sharedMesh = mesh;
        var r = go.AddComponent<MeshRenderer>();
        r.sharedMaterial = mat;
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        r.receiveShadows = false;
    }

    public void Emit(Emit o)
    {
        for (int k = 0; k < o.count; k++)
        {
            int i = n < cap ? n++ : UnityEngine.Random.Range(0, cap);
            float sp = o.spread;
            pos[i] = o.pos + new Vector3((U.Rnd - 0.5f) * sp, (U.Rnd - 0.5f) * sp, (U.Rnd - 0.5f) * sp);
            float s = o.spMin + U.Rnd * (o.spMax - o.spMin);
            float dx = U.Rnd - 0.5f, dy = U.Rnd * (o.hasUp ? o.up : 0.6f) + (o.hasUp ? 0 : -0.1f), dz = U.Rnd - 0.5f;
            if (o.dir.HasValue) { dx += o.dir.Value.x; dy += o.dir.Value.y; dz += o.dir.Value.z; }
            if (o.flat) dy = 0;
            var v = new Vector3(dx, dy, dz);
            vel[i] = (v.sqrMagnitude > 0 ? v.normalized : Vector3.up) * s;
            col[i] = o.colors != null ? o.colors[UnityEngine.Random.Range(0, o.colors.Length)] : o.color;
            a0[i] = o.alpha;
            max[i] = life[i] = o.life * (0.7f + U.Rnd * 0.6f);
            s0[i] = o.s0; s1[i] = o.s1;
            grav[i] = o.gravity; drag[i] = o.drag;
        }
    }

    public void Update(float dt, Camera cam)
    {
        var right = cam.transform.right; var up = cam.transform.up;
        for (int i = 0; i < n; i++)
        {
            int b = i * 4;
            if (life[i] <= 0) { verts[b] = verts[b + 1] = verts[b + 2] = verts[b + 3] = Vector3.zero; continue; }
            life[i] -= dt;
            float k = Mathf.Max(0, life[i] / max[i]);
            float dr = Mathf.Max(0, 1 - drag[i] * dt);
            vel[i].x *= dr; vel[i].y = vel[i].y * dr - grav[i] * dt; vel[i].z *= dr;
            pos[i] += vel[i] * dt;
            // kích thước điểm demo2 (gl_PointSize) quy ra world: ~0.6 * size
            float h = (s1[i] + (s0[i] - s1[i]) * k) * 0.3f;
            var c = col[i]; c.a = a0[i] * Mathf.Min(1, k * 2.5f);
            var rx = right * h; var uy = up * h;
            verts[b] = pos[i] - rx - uy; verts[b + 1] = pos[i] + rx - uy; verts[b + 2] = pos[i] + rx + uy; verts[b + 3] = pos[i] - rx + uy;
            vcol[b] = vcol[b + 1] = vcol[b + 2] = vcol[b + 3] = c;
        }
        mesh.vertices = verts;
        mesh.colors = vcol;
    }
}

// ---------- hiệu ứng mesh: shock ring, slash, telegraph, orb, loot beam ----------
public static class Fx
{
    public static Tweens tweens;
    static MaterialPropertyBlock mpb;
    static Mesh quad, sphere;
    static readonly Dictionary<float, Mesh> arcs = new();

    static Mesh Quad()
    {
        if (quad) return quad;
        quad = new Mesh { name = "fxQuad" };
        quad.vertices = new[] { new Vector3(-1, 0, -1), new Vector3(1, 0, -1), new Vector3(1, 0, 1), new Vector3(-1, 0, 1) };
        quad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
        quad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
        quad.triangles = new[] { 0, 2, 1, 0, 3, 2 };
        quad.RecalculateBounds();
        return quad;
    }

    static Mesh Sphere()
    {
        if (sphere) return sphere;
        var tmp = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        sphere = Object.Instantiate(tmp.GetComponent<MeshFilter>().sharedMesh);
        var c = new Color[sphere.vertexCount];
        for (int i = 0; i < c.Length; i++) c[i] = Color.white;
        sphere.colors = c;
        Object.Destroy(tmp);
        return sphere;
    }

    // cung chém: vành khuyên từ r*0.55 tới r, ±66° quanh trục +Z
    static Mesh Arc(float r)
    {
        if (arcs.TryGetValue(r, out var m)) return m;
        const int seg = 32;
        var v = new List<Vector3>(); var c = new List<Color>(); var t = new List<int>();
        for (int i = 0; i <= seg; i++)
        {
            float a = -1.15f + 2.3f * i / seg;
            var d = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
            float edge = 1 - Mathf.Abs(i / (float)seg * 2 - 1);
            v.Add(d * r * 0.55f); c.Add(new Color(1, 1, 1, 0.15f * edge));
            v.Add(d * r); c.Add(new Color(1, 1, 1, Mathf.Sqrt(edge)));
            if (i < seg) { int b = i * 2; t.AddRange(new[] { b, b + 1, b + 3, b, b + 3, b + 2 }); }
        }
        m = new Mesh { name = "fxArc" };
        m.SetVertices(v); m.SetColors(c); m.SetTriangles(t, 0); m.RecalculateBounds();
        arcs[r] = m;
        return m;
    }

    static MeshRenderer Make(string name, Mesh mesh, Material mat, Color color, Transform parent = null)
    {
        var go = new GameObject(name);
        if (parent) go.transform.SetParent(parent, false);
        go.AddComponent<MeshFilter>().sharedMesh = mesh;
        var r = go.AddComponent<MeshRenderer>();
        r.sharedMaterial = mat;
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        r.receiveShadows = false;
        SetColor(r, color);
        return r;
    }

    public static void SetColor(Renderer r, Color c)
    {
        mpb ??= new MaterialPropertyBlock();
        mpb.SetColor("_BaseColor", c);
        r.SetPropertyBlock(mpb);
    }

    public static void Shock(Vector3 p, uint color, float r1, float dur = 0.4f, float y = 0.08f)
    {
        var r = Make("shock", Quad(), Res.Mat("FxRing"), U.Hex(color));
        r.transform.position = new Vector3(p.x, y, p.z);
        var c = U.Hex(color);
        tweens.Add(dur, k =>
        {
            float e = 1 - Mathf.Pow(1 - k, 3);
            r.transform.localScale = Vector3.one * (0.2f + e * r1);
            c.a = 1 - k; SetColor(r, c);
        }, () => Object.Destroy(r.gameObject));
    }

    // angleYaw: yaw Unity (độ) của người chém
    public static void Slash(Vector3 p, float yaw, uint color = 0xfff0c8, float rad = 1.7f)
    {
        var r = Make("slash", Arc(rad), Res.Mat("FxPlainAdd"), U.Hex(color));
        r.transform.position = new Vector3(p.x, 1.0f, p.z);
        var c = U.Hex(color);
        tweens.Add(0.22f, k =>
        {
            c.a = (1 - k) * 0.95f; SetColor(r, c);
            r.transform.localScale = Vector3.one * (0.85f + k * 0.3f);
            r.transform.rotation = Quaternion.Euler(0, yaw + 30 - k * 60, 0);
        }, () => Object.Destroy(r.gameObject));
    }

    public static void Telegraph(Vector3 p, float radius, float dur)
    {
        var col = U.Hex(0xff3a2a, 0);
        var r = Make("telegraph", Quad(), Res.Mat("FxDisc"), col);
        r.transform.position = new Vector3(p.x, 0.06f, p.z);
        tweens.Add(dur, k =>
        {
            r.transform.localScale = Vector3.one * radius * (0.3f + 0.7f * k);
            col.a = 0.25f + k * 0.5f; SetColor(r, col);
        }, () => Object.Destroy(r.gameObject));
    }

    public static Transform Orb(uint color, float size)
    {
        var r = Make("orb", Sphere(), Res.Mat("FxPlainAdd"), U.Hex(color) * 2.2f);
        r.transform.localScale = Vector3.one * size * 2;
        return r.transform;
    }

    // cột sáng + vòng dưới chân cho loot, trả về renderer cột sáng (để nhấp nháy)
    public static Renderer LootBeam(Transform parent, Color color, int rarity)
    {
        float h = new[] { 0f, 3.2f, 5f, 8f }[rarity];
        Renderer beam = null;
        if (h > 0)
        {
            beam = Make("beam", Cylinder(0.32f + rarity * 0.06f, 0.18f + rarity * 0.05f, h), Res.Mat("FxPlainAdd"), color * 1.6f, parent);
        }
        var ring = Make("ring", Quad(), Res.Mat("FxRing"), new Color(color.r, color.g, color.b, 0.85f), parent);
        ring.transform.localPosition = new Vector3(0, 0.04f, 0);
        ring.transform.localScale = Vector3.one * 0.6f;
        return beam;
    }

    static readonly Dictionary<string, Mesh> cyl = new();
    static Mesh Cylinder(float r0, float r1, float h)
    {
        string k = $"{r0}/{r1}/{h}";
        if (cyl.TryGetValue(k, out var m)) return m;
        const int seg = 20, rows = 4;
        var v = new List<Vector3>(); var c = new List<Color>(); var t = new List<int>();
        for (int j = 0; j <= rows; j++)
        {
            float f = j / (float)rows, rr = Mathf.Lerp(r0, r1, f);
            float a = Mathf.Pow(1 - f, 1.6f);
            for (int i = 0; i <= seg; i++)
            {
                float ang = i / (float)seg * Mathf.PI * 2;
                v.Add(new Vector3(Mathf.Cos(ang) * rr, f * h, Mathf.Sin(ang) * rr));
                c.Add(new Color(1, 1, 1, a));
            }
        }
        for (int j = 0; j < rows; j++)
            for (int i = 0; i < seg; i++)
            {
                int b = j * (seg + 1) + i, n = b + seg + 1;
                t.AddRange(new[] { b, n, b + 1, b + 1, n, n + 1 });
            }
        m = new Mesh { name = "fxCyl" };
        m.SetVertices(v); m.SetColors(c); m.SetTriangles(t, 0); m.RecalculateBounds();
        cyl[k] = m;
        return m;
    }
}
