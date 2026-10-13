using UnityEditor;

// Cấu hình import FBX KayKit: nhân vật dùng Legacy Animation để code gọi clip theo tên
// (giống AnimationMixer của three.js ở demo2), prop/vũ khí không cần animation.
public class KayKitImport : AssetPostprocessor
{
    public override uint GetVersion() => 2; // tăng khi đổi rule -> Unity tự import lại model

    void OnPreprocessModel()
    {
        if (!assetPath.StartsWith("Assets/Resources/Models/")) return;
        var mi = (ModelImporter)assetImporter;
        mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
        mi.importCameras = false;
        mi.importLights = false;
        mi.importBlendShapes = false;
        mi.isReadable = false;
        mi.meshCompression = ModelImporterMeshCompression.Medium;
        if (assetPath.Contains("/Chars/"))
        {
            mi.animationType = ModelImporterAnimationType.Legacy;
            mi.importAnimation = true;
            mi.animationCompression = ModelImporterAnimationCompression.Optimal;
            mi.optimizeGameObjects = false; // cần tìm bone handslot.r/l + mesh vũ khí theo tên
        }
        else
        {
            mi.animationType = ModelImporterAnimationType.None;
            mi.importAnimation = false;
        }
    }

    // KayKit là art phẳng tô texture: ép metallic = 0, ít bóng. Một số FBX (Barbarian) import ra metallic cao
    // -> trong hầm không có skybox để phản chiếu nên cả model đen thui.
    void OnPostprocessMaterial(UnityEngine.Material m)
    {
        if (!assetPath.StartsWith("Assets/Resources/Models/")) return;
        if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0);
        if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.2f);
        if (m.HasProperty("_WorkflowMode")) m.SetFloat("_WorkflowMode", 1);
        m.DisableKeyword("_METALLICSPECGLOSSMAP");
        m.DisableKeyword("_SPECULAR_SETUP");
        if (m.HasProperty("_SpecColor")) m.SetColor("_SpecColor", UnityEngine.Color.black);
    }

    // chỉ giữ các clip game thực sự dùng (Defs.CLIPS) -> build WebGL nhẹ hơn nhiều
    void OnPreprocessAnimation()
    {
        if (!assetPath.StartsWith("Assets/Resources/Models/Chars/")) return;
        var mi = (ModelImporter)assetImporter;
        var keep = new System.Collections.Generic.List<ModelImporterClipAnimation>();
        foreach (var c in mi.defaultClipAnimations)
            if (Defs.CLIPS.Contains(c.name)) keep.Add(c);
        mi.clipAnimations = keep.ToArray();
    }
}
