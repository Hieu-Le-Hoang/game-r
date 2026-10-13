using System.Collections;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

// Bot chơi hết vertical slice: quán rượu -> nhận quest -> dọn Đại Sảnh -> trả quest -> hạ boss.
// Mọi Debug.LogError / exception trong lúc chạy sẽ làm test fail (mặc định của Unity Test Framework).
// Ảnh chụp lưu ở demo7/Logs/shots/ để soát bằng mắt.
public class PlaythroughTest
{
    Game g;

    [UnityTest, Timeout(600000)]
    public IEnumerator FullSlice()
    {
        SceneManager.LoadScene("Main");
        float t0 = Time.realtimeSinceStartup;
        while (Game.I == null || !Game.I.ready)
        {
            Assert.Less(Time.realtimeSinceStartup - t0, 60, "Game không khởi động được trong 60s");
            yield return null;
        }
        g = Game.I;
        g.god = true;
        Debug.Log($"[test] screen {Screen.width}x{Screen.height}, boot {Time.realtimeSinceStartup - t0:0.0}s");
        Assert.IsNotNull(Thumbs.Get("face_Knight"), "thiếu thumbnail portrait");
        yield return Wait(1.5f);
        yield return Shot("01_tavern");

        // đổi nhân vật
        g.SwitchHero("Barbarian"); yield return Wait(0.6f); Assert.AreEqual("Barbarian", S.hero);
        yield return Shot("02_barbarian");
        g.SwitchHero("Mage"); yield return Wait(0.6f); Assert.AreEqual("Mage", S.hero);
        yield return Shot("02_mage");
        g.SwitchHero("Knight"); yield return Wait(0.3f);

        // túi đồ: trang bị Rìu Khổng Lồ (hiếm) có sẵn trong túi
        Hud.ToggleInv(); yield return Wait(0.2f);
        yield return Shot("03_inventory");
        var axe = S.bag.First(i => i.kind == "weapon");
        int bagBefore = S.bag.Count;
        S.SetEq("weapon", axe); S.bag.Remove(axe); g.EquipChanged(axe); g.Refresh();
        Hud.CloseModals();
        Assert.AreEqual(bagBefore - 1, S.bag.Count);

        // uống bình máu
        int pots = S.bag.Count(i => i.kind == "potion");
        g.Drink(); Assert.AreEqual(pots - 1, S.bag.Count(i => i.kind == "potion"));

        // nhận quest từ Lyra
        g.hero.root.position = g.lyra.root.position + new Vector3(-1.5f, 0, 0);
        yield return Wait(0.3f);
        Assert.IsNotNull(g.nearNpc, "không đứng gần NPC");
        g.Talk(); yield return null;
        Assert.IsTrue(Hud.DialogOpen);
        yield return Shot("04_dialog");
        Hud.DialogConfirm();
        Assert.AreEqual(1, S.quest);

        // Đại Sảnh
        g.hero.root.position = U.P(33, 13);
        yield return Wait(2.5f);
        yield return Shot("05_hall_awaken");
        g.speed = 3;
        yield return Fight(() => g.HallLeft() > 0, 150, "hall", e => e.room == 'h');
        Assert.AreEqual(0, g.HallLeft(), "chưa dọn sạch Đại Sảnh");
        Assert.AreEqual(2, S.quest);
        g.speed = 1;
        yield return Wait(1.0f);
        yield return Shot("06_hall_clear");

        // trả quest
        g.hero.root.position = g.lyra.root.position + new Vector3(-1.5f, 0, 0);
        yield return Wait(0.3f);
        g.Talk(); yield return null; Hud.DialogConfirm();
        Assert.AreEqual(3, S.quest);
        yield return Wait(1.5f);
        yield return Shot("07_reward");
        Debug.Log($"[test] sau quest: lvl {S.lvl}, vàng {S.gold}, túi {S.bag.Count}");

        // hầm mộ + boss
        var boss = g.enemies.First(e => e.def.boss);
        g.hero.root.position = U.P(12, 21.5f);
        yield return Wait(2.0f);
        Assert.AreNotEqual("idle", boss.state, "boss không phát hiện hero");
        yield return Shot("08_boss");
        g.speed = 3;
        yield return Fight(() => boss.alive, 240, "boss", e => e.def.boss);
        g.speed = 1;
        Assert.IsFalse(boss.alive, "chưa hạ được boss");
        yield return Wait(1.2f);
        yield return Shot("09_victory");

        // rương vàng trong hầm mộ
        var gold = g.chests.First(c => !c.opened);
        g.hero.root.position = gold.obj.position + U.Fwd(gold.obj) * 1.8f;
        yield return Wait(1.5f);
        Assert.IsTrue(gold.opened);
        yield return Shot("10_chest");
        Debug.Log($"[test] XONG: lvl {S.lvl}, vàng {S.gold}, túi {S.bag.Count}, {Time.realtimeSinceStartup - t0:0}s");
    }

    // bot: luôn nhắm quái gần nhất còn sống, thỉnh thoảng dùng kỹ năng
    IEnumerator Fight(System.Func<bool> cond, float timeout, string tag, System.Func<Enemy, bool> pick)
    {
        float t0 = Time.realtimeSinceStartup, nextSkill = 0, nextLog = 0;
        while (cond())
        {
            float el = Time.realtimeSinceStartup - t0;
            if (el > timeout) { Assert.Fail($"[{tag}] quá {timeout}s"); yield break; }
            var alive = g.enemies.Where(e => e.alive && pick(e)).OrderBy(e => Vector3.Distance(e.root.position, g.HP)).FirstOrDefault();
            // quái còn ngủ: đi lại gần cho nó dậy; quái đã dậy: nhắm đánh
            if (alive != null && alive.state == "dormant") { g.target = null; g.goal = alive.root.position; }
            else if (alive != null && g.target != alive) g.target = alive;
            if (g.now > nextSkill && S.mp > 30) { g.Skill(); nextSkill = g.now + 3; }
            if (el > nextLog) { nextLog = el + 10; Debug.Log($"[test:{tag}] {el:0}s hp {S.hp:0} trái {g.enemies.Count(e => e.alive)} state {g.state}"); }
            yield return null;
        }
    }

    IEnumerator Wait(float sec) { float t = Time.realtimeSinceStartup + sec; while (Time.realtimeSinceStartup < t) yield return null; }

    // chụp màn hình: camera game + HUD (chuyển canvas sang ScreenSpaceCamera trong 1 lần render)
    IEnumerator Shot(string name)
    {
        yield return null; // batchmode không có WaitForEndOfFrame
        int w = 1280, h = 720;
        var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32);
        var canvas = Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None).First(c => c.isRootCanvas);
        // gán targetTexture để canvas lấy đúng kích thước 1280x720 thay vì màn ảo 640x480 của batchmode
        g.cam.targetTexture = rt;
        canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = g.cam; canvas.planeDistance = 1;
        Canvas.ForceUpdateCanvases();
        var req = new UniversalRenderPipeline.SingleCameraRequest { destination = rt };
        if (RenderPipeline.SupportsRenderRequest(g.cam, req)) RenderPipeline.SubmitRenderRequest(g.cam, req);
        else g.cam.Render();
        g.cam.targetTexture = null;
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var prev = RenderTexture.active; RenderTexture.active = rt;
        var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, w, h), 0, 0); tex.Apply();
        RenderTexture.active = prev;
        Directory.CreateDirectory("Logs/shots");
        File.WriteAllBytes($"Logs/shots/{name}.png", tex.EncodeToPNG());
        Object.Destroy(tex); rt.Release();
    }
}
