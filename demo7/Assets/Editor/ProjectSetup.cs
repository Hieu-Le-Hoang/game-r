using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Dựng mọi thứ "ngoài code game" bằng script để agent chạy batchmode được:
// texture FX, material FX (đặt trong Resources để không bị strip khi build), scene Main, PlayerSettings WebGL.
// Chạy: tools/unity.ps1 -Method ProjectSetup.Run   (hoặc menu demo7/Setup)
public static class ProjectSetup
{
    const string FX = "Assets/Resources/Fx";

    [MenuItem("demo7/Setup")]
    public static void Run()
    {
        Directory.CreateDirectory(FX);
        Directory.CreateDirectory("Assets/Scenes");

        // --- texture sinh bằng code ---
        MakeTex("dot", 64, (u, v) => { float d = Dist(u, v); float a = Mathf.Clamp01(1 - d); return a * a; });
        MakeTex("ring", 128, (u, v) => { float d = Dist(u, v); return Mathf.Clamp01(1 - Mathf.Abs(d - 0.86f) / 0.12f) * (d < 1 ? 1 : 0); });
        MakeTex("disc", 128, (u, v) => { float d = Dist(u, v); if (d > 1) return 0; return 0.35f + 0.65f * Mathf.Clamp01(1 - Mathf.Abs(d - 0.93f) / 0.07f); });
        MakeTex("beam", 32, (u, v) => { float x = 1 - Mathf.Abs(u * 2 - 1); return Mathf.Pow(x, 1.6f) * Mathf.Pow(1 - v, 1.4f); });
        AssetDatabase.Refresh();

        // --- material FX ---
        var dot = Tex("dot"); var ring = Tex("ring"); var disc = Tex("disc"); var beam = Tex("beam");
        Particle("FxAdd", dot, true);
        Particle("FxAlpha", dot, false);
        Particle("FxRing", ring, true);
        Particle("FxDisc", disc, false);
        Particle("FxBeam", beam, true);
        Particle("FxPlainAdd", null, true);
        Particle("FxPlainAlpha", null, false);
        LitTransparent();

        // --- PlayerSettings ---
        PlayerSettings.companyName = "Wecare R&D";
        PlayerSettings.productName = "Ham Mo Vua Xuong (Unity)";
        PlayerSettings.colorSpace = ColorSpace.Linear;
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true; // Vercel không cần header Content-Encoding
        PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
        PlayerSettings.WebGL.dataCaching = true;
        PlayerSettings.WebGL.nameFilesAsHashes = true;
        PlayerSettings.stripEngineCode = true;
        PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.Low);
        PlayerSettings.runInBackground = true;

        // --- scene Main: chỉ 1 GameObject, mọi thứ còn lại dựng bằng code ---
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        new GameObject("Game").AddComponent<Game>();
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/Main.unity");
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene("Assets/Scenes/Main.unity", true) };

        // model import lại để material ăn shader URP Lit
        AssetDatabase.ImportAsset("Assets/Resources/Models", ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
        AssetDatabase.SaveAssets();
        Debug.Log("SETUP DONE");
    }

    static float Dist(float u, float v) => new Vector2(u * 2 - 1, v * 2 - 1).magnitude;

    static void MakeTex(string name, int n, System.Func<float, float, float> alpha)
    {
        var t = new Texture2D(n, n, TextureFormat.RGBA32, false);
        for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
                t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(alpha((x + 0.5f) / n, (y + 0.5f) / n))));
        t.Apply();
        File.WriteAllBytes($"{FX}/{name}.png", t.EncodeToPNG());
        Object.DestroyImmediate(t);
    }

    static Texture2D Tex(string name)
    {
        var path = $"{FX}/{name}.png";
        var ti = (TextureImporter)AssetImporter.GetAtPath(path);
        ti.alphaIsTransparency = true;
        ti.wrapMode = TextureWrapMode.Clamp;
        ti.mipmapEnabled = false;
        ti.SaveAndReimport();
        return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
    }

    static Material Save(Material m, string name)
    {
        var path = $"{FX}/{name}.mat";
        var old = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (old) { old.shader = m.shader; old.CopyPropertiesFromMaterial(m); old.shaderKeywords = m.shaderKeywords; old.renderQueue = m.renderQueue; EditorUtility.SetDirty(old); return old; }
        AssetDatabase.CreateAsset(m, path);
        return m;
    }

    // URP Particles/Unlit trong suốt, cộng màu (additive) hoặc alpha blend, hai mặt
    static void Particle(string name, Texture2D tex, bool additive)
    {
        var m = new Material(Shader.Find("Universal Render Pipeline/Particles/Unlit"));
        if (tex) m.SetTexture("_BaseMap", tex);
        m.SetColor("_BaseColor", Color.white);
        m.SetFloat("_Surface", 1);
        m.SetFloat("_Blend", additive ? 2 : 0);
        m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
        m.SetFloat("_DstBlend", (float)(additive ? BlendMode.One : BlendMode.OneMinusSrcAlpha));
        m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
        m.SetFloat("_DstBlendAlpha", (float)(additive ? BlendMode.One : BlendMode.OneMinusSrcAlpha));
        m.SetFloat("_ZWrite", 0);
        m.SetFloat("_Cull", 0);
        m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        m.SetOverrideTag("RenderType", "Transparent");
        m.renderQueue = (int)RenderQueue.Transparent;
        Save(m, name);
    }

    // Lit trong suốt: dùng để làm mờ tường che nhân vật (giữ biến thể shader trong build)
    static void LitTransparent()
    {
        var m = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        var tex = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Resources/Models/Dungeon/dungeon_texture.png");
        if (tex) m.SetTexture("_BaseMap", tex);
        m.SetFloat("_Surface", 1);
        m.SetFloat("_Blend", 0);
        m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
        m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
        m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
        m.SetFloat("_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha);
        m.SetFloat("_ZWrite", 0);
        m.SetFloat("_Smoothness", 0.2f);
        m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        m.SetOverrideTag("RenderType", "Transparent");
        m.renderQueue = (int)RenderQueue.Transparent;
        Save(m, "WallFade");
    }
}
