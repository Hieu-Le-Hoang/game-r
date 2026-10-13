using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Chụp thumbnail 3D (icon vũ khí, portrait nhân vật) ra Texture2D lúc khởi động — giống makeThumbs của demo2.
// Nền trong suốt bằng "difference matting": chụp 2 lần nền đen/trắng rồi suy ra alpha
// (vì buffer HDR của URP không giữ kênh alpha).
public static class Thumbs
{
    public const int LAYER = 31;
    const int SIZE = 160;
    static readonly Dictionary<string, Texture2D> map = new();

    public static Texture2D Get(string id) => map.TryGetValue(id, out var t) ? t : null;

    public static void Build()
    {
        var go = new GameObject("ThumbCam");
        var cam = go.AddComponent<Camera>();
        cam.enabled = false;
        cam.cullingMask = 1 << LAYER;
        cam.fieldOfView = 28; cam.nearClipPlane = 0.01f; cam.farClipPlane = 100;
        cam.clearFlags = CameraClearFlags.SolidColor;
        var cd = go.AddComponent<UniversalAdditionalCameraData>();
        cd.renderPostProcessing = false;
        cd.renderShadows = false;
        var rt = new RenderTexture(SIZE, SIZE, 24, RenderTextureFormat.ARGB32);
        cam.targetTexture = rt;

        // đèn riêng cho layer thumbnail
        var origin = new Vector3(0, -200, 0);
        var key = MakeLight(new Vector3(-2, -4, -5), 1.0f, Color.white);
        var rim = MakeLight(new Vector3(4, -2, 3), 0.6f, U.Hex(0x88aaff));

        var items = new[] { "sword_1handed", "axe_1handed", "axe_2handed", "sword_2handed", "staff", "wand", "dagger", "shield_round", "shield_spikes", "shield_badge" };
        foreach (var k in items)
        {
            bool shield = k.StartsWith("shield");
            var o = Res.Inst(k);
            if (!shield) o.transform.rotation = Quaternion.Euler(0, 0, -45);
            Shot(cam, rt, k, o, origin, shield ? new Vector3(0.3f, 0.2f, 1) : new Vector3(0.2f, 0.2f, 1), false);
        }
        Shot(cam, rt, "bottle_A_green", Res.Inst("bottle_A_green"), origin, new Vector3(0.4f, 0.4f, 1), false);
        foreach (var k in Defs.HERO_ORDER)
        {
            var o = Res.Inst(k);
            foreach (var n in Defs.HEROES[k].hide) { var x = U.Find(o.transform, n); if (x) x.gameObject.SetActive(false); }
            var anim = o.GetComponent<Animation>();
            if (anim && anim["Idle"] != null) { anim.Play("Idle"); anim["Idle"].time = 0.3f; anim.Sample(); anim.Stop(); }
            Shot(cam, rt, "face_" + k, o, origin, new Vector3(0.35f, 0.1f, 1), true);
        }

        Object.Destroy(key.gameObject); Object.Destroy(rim.gameObject);
        cam.targetTexture = null;
        rt.Release();
        Object.Destroy(go);
    }

    static Light MakeLight(Vector3 dir, float intensity, Color c)
    {
        var l = new GameObject("ThumbLight").AddComponent<Light>();
        l.type = LightType.Directional; l.intensity = intensity; l.color = c;
        l.cullingMask = 1 << LAYER; l.shadows = LightShadows.None;
        l.transform.rotation = Quaternion.LookRotation(dir);
        return l;
    }

    static void Shot(Camera cam, RenderTexture rt, string id, GameObject o, Vector3 origin, Vector3 dir, bool face)
    {
        U.SetLayer(o, LAYER);
        o.transform.position = origin;
        var rs = o.GetComponentsInChildren<Renderer>();
        foreach (var r in rs) if (r is SkinnedMeshRenderer s) s.updateWhenOffscreen = true;
        var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds);
        var c = b.center; var sz = b.size;
        float span = Mathf.Max(sz.x, sz.y, sz.z);
        if (face) { c.y = b.max.y - sz.y * 0.27f; span = sz.y * 0.5f; }
        float d = span / 2 / Mathf.Tan(14 * Mathf.Deg2Rad) * 1.15f;
        cam.transform.position = c + dir.normalized * d;
        cam.transform.LookAt(c);

        var black = Render(cam, rt, Color.black);
        var white = Render(cam, rt, Color.white);
        var outp = new Color32[SIZE * SIZE];
        for (int i = 0; i < outp.Length; i++)
        {
            Color cb = black[i], cw = white[i];
            float a = 1 - ((cw.r - cb.r) + (cw.g - cb.g) + (cw.b - cb.b)) / 3f;
            a = Mathf.Clamp01(a);
            var col = a > 0.003f ? new Color(cb.r / a, cb.g / a, cb.b / a, a) : Color.clear;
            outp[i] = col;
        }
        var tex = new Texture2D(SIZE, SIZE, TextureFormat.RGBA32, false) { name = id };
        tex.SetPixels32(outp); tex.Apply();
        map[id] = tex;
        Object.DestroyImmediate(o); // phải xoá ngay: các thumbnail chụp liền nhau trong cùng 1 frame
    }

    static Color[] Render(Camera cam, RenderTexture rt, Color bg)
    {
        cam.backgroundColor = bg;
        var req = new UniversalRenderPipeline.SingleCameraRequest { destination = rt };
        if (RenderPipeline.SupportsRenderRequest(cam, req)) RenderPipeline.SubmitRenderRequest(cam, req);
        else cam.Render();
        var prev = RenderTexture.active;
        RenderTexture.active = rt;
        var t = new Texture2D(SIZE, SIZE, TextureFormat.RGBA32, false);
        t.ReadPixels(new Rect(0, 0, SIZE, SIZE), 0, 0);
        t.Apply();
        RenderTexture.active = prev;
        var px = t.GetPixels();
        Object.Destroy(t);
        return px;
    }
}
