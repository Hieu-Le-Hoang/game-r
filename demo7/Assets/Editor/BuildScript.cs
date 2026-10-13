using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

// Build WebGL headless: tools/unity.ps1 -Method BuildScript.WebGL  -> demo7/Builds/WebGL
public static class BuildScript
{
    [MenuItem("demo7/Build WebGL")]
    public static void WebGL()
    {
        const string outDir = "Builds/WebGL";
        // chỉ xoá output cũ, giữ .vercel/ (link project wcg-game-r-demo7) để deploy lại được ngay
        foreach (var d in new[] { "Build", "TemplateData" }) if (Directory.Exists($"{outDir}/{d}")) Directory.Delete($"{outDir}/{d}", true);
        if (File.Exists($"{outDir}/index.html")) File.Delete($"{outDir}/index.html");
        var opt = new BuildPlayerOptions
        {
            scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray(),
            locationPathName = outDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.None,
        };
        var r = BuildPipeline.BuildPlayer(opt);
        var s = r.summary;
        if (s.result == BuildResult.Succeeded) FullWindow($"{outDir}/index.html");
        long bytes = Directory.GetFiles(outDir, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);
        Debug.Log($"BUILD {s.result} in {s.totalTime.TotalSeconds:0}s, {bytes / 1048576f:0.0} MB on disk, {s.totalErrors} errors");
        foreach (var f in Directory.GetFiles(outDir + "/Build")) Debug.Log($"BUILD file {Path.GetFileName(f)} {new FileInfo(f).Length / 1048576f:0.00} MB");
        if (Application.isBatchMode) EditorApplication.Exit(s.result == BuildResult.Succeeded ? 0 : 1);
    }

    // Template Default của Unity khoá canvas 960x600 trên desktop -> cho tràn cả cửa sổ như bản mobile, ẩn footer
    static void FullWindow(string index)
    {
        var html = File.ReadAllText(index);
        html = html.Replace("        canvas.style.width = \"960px\";\n        canvas.style.height = \"600px\";",
            "        document.querySelector(\"#unity-container\").className = \"unity-mobile\";\n        canvas.className = \"unity-mobile\";");
        if (!html.Contains("overflow:hidden"))
            html = html.Replace("</head>", "    <style>html,body{height:100%;overflow:hidden;background:#000}</style>\n  </head>");
        File.WriteAllText(index, html);
    }
}
