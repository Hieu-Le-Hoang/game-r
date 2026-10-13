using UnityEditor;

// Bật "Auto-Start on Editor Load" của MCP for Unity (HTTP, localhost:8080/mcp)
// để Claude Code nối được ngay khi mở Editor, khỏi bấm Start Server.
[InitializeOnLoad]
static class McpAutoStart
{
    static McpAutoStart()
    {
        if (!EditorPrefs.GetBool("MCPForUnity.AutoStartOnLoad", false))
            EditorPrefs.SetBool("MCPForUnity.AutoStartOnLoad", true);
    }
}
