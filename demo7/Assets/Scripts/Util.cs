using System.Collections.Generic;
using UnityEngine;

// Hàm tiện ích + quy đổi toạ độ từ demo2 (three.js, tay phải) sang Unity (tay trái).
// Quy ước: giữ nguyên số liệu map/prop của demo2, lật trục z khi đặt vào thế giới Unity.
public static class U
{
    public static float Rnd => Random.value;
    public static int RInt(int a, int b) => Random.Range(a, b + 1);
    public static float Range(float a, float b) => a + Random.value * (b - a);
    public static T Pick<T>(IList<T> a) => a[Random.Range(0, a.Count)];
    public static float Damp(float a, float b, float l, float dt) => a + (b - a) * (1 - Mathf.Exp(-l * dt));

    // toạ độ demo2 (x, z) -> Unity
    public static Vector3 P(float x, float z, float y = 0) => new Vector3(x, y, -z);
    // rotation.y của three.js (radian) -> yaw Unity (độ). Model KayKit nhìn về +Z ở cả hai engine.
    public static float Yaw(float rad) => 180f - rad * Mathf.Rad2Deg;
    public static Quaternion Rot(float rad) => Quaternion.Euler(0, Yaw(rad), 0);

    public static Color Hex(uint h, float a = 1) => new Color(((h >> 16) & 255) / 255f, ((h >> 8) & 255) / 255f, (h & 255) / 255f, a);
    public static Color Html(string s) { ColorUtility.TryParseHtmlString(s, out var c); return c; }

    public static float FlatDist(Vector3 a, Vector3 b) { float dx = a.x - b.x, dz = a.z - b.z; return Mathf.Sqrt(dx * dx + dz * dz); }
    public static Vector3 FlatDir(Vector3 from, Vector3 to) { var v = to - from; v.y = 0; return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.forward; }
    public static Vector3 Fwd(Transform t) { var f = t.forward; f.y = 0; return f.normalized; }
    public static void Face(Transform t, Vector3 target) { var d = target - t.position; d.y = 0; if (d.sqrMagnitude > 1e-6f) t.rotation = Quaternion.LookRotation(d); }

    public static Transform Find(Transform root, string name)
    {
        if (root.name == name) return root;
        foreach (Transform c in root) { var r = Find(c, name); if (r) return r; }
        return null;
    }

    public static void SetLayer(GameObject go, int layer)
    {
        foreach (var t in go.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = layer;
    }
}

// Tải model / material / font từ Resources (Resources luôn được đóng vào build)
public static class Res
{
    static readonly Dictionary<string, GameObject> models = new();
    static readonly string[] dirs = { "Models/Chars/", "Models/Dungeon/", "Models/Items/" };

    public static GameObject Model(string key)
    {
        if (models.TryGetValue(key, out var g)) return g;
        foreach (var d in dirs) { g = Resources.Load<GameObject>(d + key); if (g) break; }
        if (!g) throw new System.Exception($"Thiếu model: {key}");
        models[key] = g;
        return g;
    }

    public static GameObject Inst(string key, Transform parent = null)
    {
        var o = Object.Instantiate(Model(key), parent);
        o.name = key;
        return o;
    }

    static readonly Dictionary<string, Material> mats = new();
    public static Material Mat(string name)
    {
        if (!mats.TryGetValue(name, out var m)) { m = Resources.Load<Material>("Fx/" + name); mats[name] = m; }
        return m;
    }

    static Font regular, bold;
    public static Font Font => regular ??= Resources.Load<Font>("Fonts/BeVietnamPro-Medium");
    public static Font Bold => bold ??= Resources.Load<Font>("Fonts/BeVietnamPro-Bold");
}
