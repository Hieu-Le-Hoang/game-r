using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

// Tool tạm: in ra tên clip, bone, kích thước model để port từ demo2 cho đúng
public static class Probe
{
    public static void Run()
    {
        var sb = new StringBuilder();
        foreach (var path in Directory.GetFiles("Assets/Resources/Models", "*.fbx", SearchOption.AllDirectories).OrderBy(p => p))
        {
            var p = path.Replace('\\', '/');
            var go = AssetDatabase.LoadAssetAtPath<GameObject>(p);
            if (!go) { sb.AppendLine($"MISSING {p}"); continue; }
            var inst = Object.Instantiate(go);
            var rs = inst.GetComponentsInChildren<Renderer>(true);
            var b = rs.Length > 0 ? rs[0].bounds : new Bounds();
            foreach (var r in rs) b.Encapsulate(r.bounds);
            sb.AppendLine($"== {p}  size={b.size}  center={b.center}  rot={go.transform.rotation.eulerAngles} scale={go.transform.localScale}");
            var mats = rs.SelectMany(r => r.sharedMaterials).Where(m => m).Select(m => $"{m.name}[{m.shader.name}|{(m.mainTexture ? m.mainTexture.name : "-")}|met {(m.HasProperty("_Metallic") ? m.GetFloat("_Metallic") : -1)}|col {(m.HasProperty("_BaseColor") ? m.GetColor("_BaseColor").ToString() : "-")}]").Distinct();
            sb.AppendLine("  mats: " + string.Join(", ", mats));
            if (p.Contains("/Chars/"))
            {
                var clips = AssetDatabase.LoadAllAssetsAtPath(p).OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview")).Select(c => $"{c.name}({c.length:0.00})");
                sb.AppendLine("  clips: " + string.Join(", ", clips));
                sb.AppendLine("  nodes: " + string.Join(", ", inst.GetComponentsInChildren<Transform>(true).Select(t => t.name)));
                var hr = inst.GetComponentsInChildren<Transform>(true).FirstOrDefault(t => t.name == "handslot.r");
                if (hr) sb.AppendLine($"  handslot.r lossyScale={hr.lossyScale} fwd={inst.transform.forward}");
                foreach (var w in new[] { "1H_Sword", "Round_Shield", "2H_Staff", "1H_Axe" })
                {
                    var t = inst.GetComponentsInChildren<Transform>(true).FirstOrDefault(x => x.name == w);
                    if (t) sb.AppendLine($"  {w}: parent={t.parent.name} lpos={t.localPosition} lrot={t.localEulerAngles} lscale={t.localScale}");
                }
            }
            Object.DestroyImmediate(inst);
        }
        File.WriteAllText("Logs/probe.txt", sb.ToString());
        Debug.Log("PROBE DONE");
    }
}
