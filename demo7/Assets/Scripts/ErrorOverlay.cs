using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

// Hiện lỗi / exception ngay trên màn hình game (góc trên, chữ đỏ).
// Bản WebGL lỗi chỉ in ra console trình duyệt; overlay này để anh test tay thấy nguyên nhân mà không cần mở F12.
public static class ErrorOverlay
{
    const int MAX = 6;
    static readonly List<string> lines = new();
    static Text text;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Init()
    {
        lines.Clear(); text = null;
        Application.logMessageReceived -= OnLog;
        Application.logMessageReceived += OnLog;
    }

    static void OnLog(string msg, string stack, LogType type)
    {
        if (type != LogType.Error && type != LogType.Exception && type != LogType.Assert) return;
        string first = string.IsNullOrEmpty(stack) ? "" : stack.Split('\n')[0];
        lines.Add($"[{type}] {msg}{(first.Length > 0 ? "  @ " + first : "")}");
        if (lines.Count > MAX) lines.RemoveAt(0);
        if (!text) Build();
        if (text) text.text = string.Join("\n", lines);
    }

    static void Build()
    {
        var font = Resources.Load<Font>("Fonts/BeVietnamPro-Medium");
        if (!font) return;
        var cg = new GameObject("ErrorOverlay");
        Object.DontDestroyOnLoad(cg);
        var canvas = cg.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 32767;
        var go = new GameObject("Text", typeof(RectTransform));
        go.transform.SetParent(cg.transform, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = new Vector2(0, 1); rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0.5f, 1);
        rt.offsetMin = new Vector2(8, -220); rt.offsetMax = new Vector2(-8, -8);
        text = go.AddComponent<Text>();
        text.font = font; text.fontSize = 14; text.color = new Color(1f, 0.45f, 0.4f);
        text.raycastTarget = false;
        text.horizontalOverflow = HorizontalWrapMode.Wrap; text.verticalOverflow = VerticalWrapMode.Truncate;
        var sh = go.AddComponent<Shadow>(); sh.effectColor = Color.black; sh.effectDistance = new Vector2(1, -1);
    }
}
