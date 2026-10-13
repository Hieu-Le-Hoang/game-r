using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

// HUD dựng bằng uGUI từ code (không prefab) — bố cục + màu theo demo2 (index.html + style.css)
public static class Hud
{
    // ---------- màu demo2 ----------
    static readonly Color GLASS = new(14 / 255f, 17 / 255f, 27 / 255f, 0.72f);
    static readonly Color LINE = new(1, 1, 1, 0.14f);
    static readonly Color TEXT = U.Html("#f2ecdf"), MUTED = U.Html("#a8a3b8"), GOLD = U.Html("#f5c451");
    static readonly Color HP = U.Html("#e8394d"), MP = U.Html("#3f7ff0"), XP = U.Html("#f5c451");
    static readonly Color GOOD = U.Html("#7be38a"), BAD = U.Html("#ff7a6b");

    static Game G;
    static Canvas canvas;
    static RectTransform root, worldLayer, toastBox;
    static Sprite round, circle;

    // ---------- khởi tạo ----------
    public static void Build(Game g)
    {
        G = g;
        anchors.Clear();
        round = MakeRounded(32, 12);
        circle = MakeRounded(64, 32);

        var cg = new GameObject("HUD");
        canvas = cg.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 10;
        var scaler = cg.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1600, 900);
        scaler.matchWidthOrHeight = 0.5f;
        cg.AddComponent<GraphicRaycaster>();
        root = (RectTransform)cg.transform;

        hurt = Img(root, "hurt", new Color(0.75f, 0.05f, 0.1f, 0), null);
        Stretch(hurt.rectTransform); hurt.raycastTarget = false;
        worldLayer = Rect(root, "world"); Stretch(worldLayer);

        BuildTopLeft();
        BuildTopRight();
        BuildTopCenter();
        BuildBottom();
        toastBox = Rect(root, "toasts");
        Place(toastBox, new Vector2(0, 0.5f), new Vector2(24, 40), new Vector2(560, 220), new Vector2(0, 0));
        var vl = toastBox.gameObject.AddComponent<VerticalLayoutGroup>();
        vl.childAlignment = TextAnchor.LowerLeft; vl.spacing = 6; vl.childControlHeight = true; vl.childControlWidth = true; vl.childForceExpandHeight = false;
        BuildDialog();
        BuildInventory();
        loading = Img(root, "loading", U.Hex(0x0b0d14), null); Stretch(loading.rectTransform);
        loadingTxt = Txt(loading.transform, "Đang tải…", 22, TEXT, TextAnchor.MiddleCenter); Stretch(loadingTxt.rectTransform);
    }

    static Image loading; static Text loadingTxt;
    public static void Loading(string msg)
    {
        loading.gameObject.SetActive(msg != null);
        if (msg != null) loadingTxt.text = msg;
    }

    // ---------- top-left: portrait + máu/mana/xp ----------
    static RawImage portrait; static Text lvl, heroName, hpTxt, mpTxt;
    static Image hpFill, mpFill, xpFill;

    static void BuildTopLeft()
    {
        var box = Rect(root, "hud-tl");
        Place(box, new Vector2(0, 1), new Vector2(18, -18), new Vector2(420, 110), new Vector2(0, 1));
        var pf = Img(box, "pframe", GLASS, circle); Place(pf.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(96, 96), new Vector2(0, 1));
        var mask = pf.gameObject.AddComponent<Mask>(); mask.showMaskGraphic = true;
        portrait = Raw(pf.transform, "portrait"); Place(portrait.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(96, 96), new Vector2(0.5f, 0.5f));
        var lb = Img(box, "lvl", GOLD, circle); Place(lb.rectTransform, new Vector2(0, 1), new Vector2(68, -70), new Vector2(32, 32), new Vector2(0, 1));
        lvl = Txt(lb.transform, "1", 17, U.Hex(0x1a1206), TextAnchor.MiddleCenter, true); Stretch(lvl.rectTransform);
        heroName = Txt(box, "Hiệp Sĩ", 20, TEXT, TextAnchor.UpperLeft, true);
        Place(heroName.rectTransform, new Vector2(0, 1), new Vector2(110, -4), new Vector2(300, 28), new Vector2(0, 1));
        hpFill = Bar(box, new Vector2(110, -34), new Vector2(290, 22), HP, out hpTxt);
        mpFill = Bar(box, new Vector2(110, -60), new Vector2(290, 18), MP, out mpTxt);
        xpFill = Bar(box, new Vector2(110, -82), new Vector2(290, 7), XP, out _);
    }

    static Image Bar(Transform parent, Vector2 pos, Vector2 size, Color fill, out Text label)
    {
        var bg = Img(parent, "bar", new Color(0, 0, 0, 0.55f), round);
        Place(bg.rectTransform, new Vector2(0, 1), pos, size, new Vector2(0, 1));
        var f = Img(bg.transform, "fill", fill, round);
        var rt = f.rectTransform; rt.anchorMin = Vector2.zero; rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0, 0.5f);
        rt.offsetMin = new Vector2(2, 2); rt.offsetMax = new Vector2(-2, -2);
        label = null;
        if (size.y >= 16)
        {
            label = Txt(bg.transform, "", Mathf.RoundToInt(size.y * 0.62f), Color.white, TextAnchor.MiddleCenter, true);
            Stretch(label.rectTransform); Shadow(label);
        }
        return f;
    }

    static void SetFill(Image f, float k) { k = Mathf.Clamp01(k); var rt = f.rectTransform; rt.anchorMax = new Vector2(k, 1); f.enabled = k > 0.001f; }

    // ---------- top-right: minimap, quest, chọn hero ----------
    static RawImage mini; static Texture2D miniTex; static Color32[] miniPx;
    static GameObject questBox; static Text qTitle, qStep;
    static RectTransform heroesBox;
    const int MW = 156, MH = 108;

    static void BuildTopRight()
    {
        var box = Rect(root, "hud-tr");
        Place(box, new Vector2(1, 1), new Vector2(-18, -18), new Vector2(240, 360), new Vector2(1, 1));
        var mw = Img(box, "mini-wrap", GLASS, round); Place(mw.rectTransform, new Vector2(1, 1), Vector2.zero, new Vector2(232, 162), new Vector2(1, 1));
        mini = Raw(mw.transform, "minimap"); Place(mini.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(220, 152), new Vector2(0.5f, 0.5f));
        miniTex = new Texture2D(MW, MH, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
        miniPx = new Color32[MW * MH];
        mini.texture = miniTex;

        var q = Img(box, "quest", GLASS, round); questBox = q.gameObject;
        Place(q.rectTransform, new Vector2(1, 1), new Vector2(0, -172), new Vector2(232, 62), new Vector2(1, 1));
        qTitle = Txt(q.transform, "", 16, GOLD, TextAnchor.UpperLeft, true); Place(qTitle.rectTransform, new Vector2(0, 1), new Vector2(12, -8), new Vector2(210, 22), new Vector2(0, 1));
        qStep = Txt(q.transform, "", 14, TEXT, TextAnchor.UpperLeft); Place(qStep.rectTransform, new Vector2(0, 1), new Vector2(12, -32), new Vector2(210, 22), new Vector2(0, 1));
        questBox.SetActive(false);

        heroesBox = Rect(box, "heroes");
        Place(heroesBox, new Vector2(1, 1), new Vector2(0, -244), new Vector2(232, 64), new Vector2(1, 1));
        var hl = heroesBox.gameObject.AddComponent<HorizontalLayoutGroup>();
        hl.childAlignment = TextAnchor.MiddleRight; hl.spacing = 10; hl.childControlWidth = false; hl.childControlHeight = false;
    }

    static readonly Dictionary<string, Image> heroBtns = new();
    public static void HeroButtons()
    {
        heroBtns.Clear();
        foreach (var k in Defs.HERO_ORDER)
        {
            var key = k;
            var b = Img(heroesBox, "hero-" + k, GLASS, circle);
            b.rectTransform.sizeDelta = new Vector2(60, 60);
            b.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            var face = Raw(b.transform, "face"); face.texture = Thumbs.Get("face_" + k);
            Place(face.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(60, 60), new Vector2(0.5f, 0.5f));
            face.raycastTarget = false;
            var btn = b.gameObject.AddComponent<Button>();
            btn.onClick.AddListener(() => G.SwitchHero(key));
            heroBtns[k] = b;
        }
    }

    // ---------- top-center: boss + banner ----------
    static GameObject bossBox; static Text bossName; static Image bossFill;
    static CanvasGroup bannerCg; static Text bannerTitle, bannerSub; static float bannerT;

    static void BuildTopCenter()
    {
        var b = Rect(root, "boss"); bossBox = b.gameObject;
        Place(b, new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(560, 60), new Vector2(0.5f, 1));
        bossName = Txt(b, "Vua Xương", 20, U.Html("#ffb08a"), TextAnchor.UpperCenter, true); Place(bossName.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(560, 26), new Vector2(0.5f, 1)); Shadow(bossName);
        bossFill = Bar(b, new Vector2(0, -30), new Vector2(560, 16), U.Html("#d8402a"), out var t);
        bossFill.transform.parent.GetComponent<RectTransform>().anchorMin = new Vector2(0, 1);
        if (t) t.text = "";
        bossBox.SetActive(false);

        var bn = Rect(root, "banner");
        Place(bn, new Vector2(0.5f, 1), new Vector2(0, -130), new Vector2(900, 110), new Vector2(0.5f, 1));
        bannerCg = bn.gameObject.AddComponent<CanvasGroup>(); bannerCg.alpha = 0; bannerCg.blocksRaycasts = false;
        bannerSub = Txt(bn, "", 18, MUTED, TextAnchor.UpperCenter, true); Place(bannerSub.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(900, 26), new Vector2(0.5f, 1)); Shadow(bannerSub);
        bannerTitle = Txt(bn, "", 44, U.Html("#f7e3b5"), TextAnchor.UpperCenter, true); Place(bannerTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -28), new Vector2(900, 60), new Vector2(0.5f, 1)); Shadow(bannerTitle, 2);
    }

    // ---------- bottom: túi đồ, kỹ năng, nói chuyện, gợi ý ----------
    static Text goldTxt, potN, hint; static float hintT;
    static Button talkBtn;
    static Image cdQ, cdE, cdR, icoAtk, icoQ, icoR; static Image skQ;

    static void BuildBottom()
    {
        var bag = Img(root, "b-bag", GLASS, round);
        Place(bag.rectTransform, new Vector2(0, 0), new Vector2(18, 18), new Vector2(230, 48), new Vector2(0, 0));
        goldTxt = Txt(bag.transform, "", 18, TEXT, TextAnchor.MiddleCenter, true); Stretch(goldTxt.rectTransform);
        bag.gameObject.AddComponent<Button>().onClick.AddListener(ToggleInv);

        var sk = Rect(root, "skills");
        Place(sk, new Vector2(1, 0), new Vector2(-24, 24), new Vector2(420, 130), new Vector2(1, 0));
        icoAtk = Skill(sk, "J", new Vector2(-0, 0), 112, () => G.Attack(null), out _, null);
        icoQ = Skill(sk, "Q", new Vector2(-128, 0), 76, G.Skill, out cdQ, "20");
        skQ = icoQ.transform.parent.GetComponent<Image>();
        var icoE = Skill(sk, "Space", new Vector2(-214, 0), 76, G.Dodge, out cdE, null);
        icoE.color = U.Html("#9fd0ff"); icoE.sprite = circle; icoE.rectTransform.sizeDelta = new Vector2(22, 22);
        icoR = Skill(sk, "R", new Vector2(-300, 0), 76, G.Drink, out cdR, "3");
        potN = icoR.transform.parent.Find("cost").GetComponent<Text>();

        var tb = Img(root, "talk", U.Html("#f5c451"), round);
        Place(tb.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(220, 46), new Vector2(0.5f, 0));
        var tt = Txt(tb.transform, "Nói chuyện  [F]", 18, U.Hex(0x1a1206), TextAnchor.MiddleCenter, true); Stretch(tt.rectTransform);
        talkBtn = tb.gameObject.AddComponent<Button>(); talkBtn.onClick.AddListener(G.Talk);
        tb.gameObject.SetActive(false);

        hint = Txt(root, "WASD / click chuột để chạy · click quái hoặc J để đánh · Q kỹ năng · Space lăn né · R bình máu · F nói chuyện · I túi đồ · 1-3 đổi nhân vật", 15, MUTED, TextAnchor.MiddleCenter);
        Place(hint.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(1100, 26), new Vector2(0.5f, 0)); Shadow(hint);
        hintT = 12;
    }

    static Image Skill(RectTransform parent, string key, Vector2 pos, float size, Action fn, out Image cd, string cost)
    {
        var b = Img(parent, "sk-" + key, GLASS, circle);
        Place(b.rectTransform, new Vector2(1, 0), pos, new Vector2(size, size), new Vector2(1, 0));
        var o = Img(b.transform, "ring", LINE, circle); Stretch(o.rectTransform); o.raycastTarget = false;
        var ico = Img(b.transform, "ico", Color.white, null); ico.preserveAspect = true; ico.raycastTarget = false;
        Place(ico.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(size * 0.72f, size * 0.72f), new Vector2(0.5f, 0.5f));
        cd = Img(b.transform, "cd", new Color(0, 0, 0, 0.62f), circle); Stretch(cd.rectTransform); cd.raycastTarget = false;
        cd.type = Image.Type.Filled; cd.fillMethod = Image.FillMethod.Radial360; cd.fillOrigin = 2; cd.fillClockwise = false; cd.fillAmount = 0;
        var kb = Txt(b.transform, key, 13, TEXT, TextAnchor.LowerCenter, true); Place(kb.rectTransform, new Vector2(0.5f, 0), new Vector2(0, -20), new Vector2(80, 20), new Vector2(0.5f, 0)); Shadow(kb);
        if (cost != null)
        {
            var c = Txt(b.transform, cost, 14, U.Html("#9fd0ff"), TextAnchor.UpperRight, true); c.name = "cost";
            Place(c.rectTransform, new Vector2(1, 1), new Vector2(4, 4), new Vector2(40, 20), new Vector2(1, 1)); Shadow(c);
        }
        b.gameObject.AddComponent<Button>().onClick.AddListener(() => fn());
        return ico;
    }

    public static void TalkButton(bool on) { if (talkBtn.gameObject.activeSelf != on) talkBtn.gameObject.SetActive(on); }

    // ---------- cập nhật HUD ----------
    public static void Vitals()
    {
        var ST = G.ST; if (ST == null) return;
        SetFill(hpFill, S.hp / ST.maxHp); SetFill(mpFill, S.mp / ST.maxMp); SetFill(xpFill, (float)S.xp / S.XpNeed);
        hpTxt.text = $"{Mathf.Max(0, Mathf.CeilToInt(S.hp))}/{ST.maxHp}";
        mpTxt.text = $"{Mathf.FloorToInt(S.mp)}/{ST.maxMp}";
        lvl.text = S.lvl.ToString();
        goldTxt.text = $"<color=#f5c451>●</color> {S.gold}   <color=#a8a3b8>|</color>   Túi đồ  [I]";
        potN.text = S.bag.Count(i => i.kind == "potion").ToString();
    }

    public static void Hero(HeroDef def)
    {
        heroName.text = def.name;
        portrait.texture = Thumbs.Get("face_" + def.key);
        SetIco(icoAtk, def.atkIcon); SetIco(icoQ, def.skillIcon); SetIco(icoR, "bottle_A_green");
        foreach (var kv in heroBtns) kv.Value.color = kv.Key == def.key ? GOLD : GLASS;
    }

    static void SetIco(Image img, string id)
    {
        var t = Thumbs.Get(id);
        img.sprite = t ? Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(0.5f, 0.5f)) : null;
    }

    public static void Cooldowns()
    {
        float now = G.now;
        cdQ.fillAmount = Mathf.Max(0, G.cdQ - now) / 4f;
        cdE.fillAmount = Mathf.Max(0, G.cdE - now) / 1.2f;
        cdR.fillAmount = Mathf.Max(0, G.cdR - now) / 5f;
        bool costOk = S.mp >= (G.ST.powers.Contains("freeSkill") ? 0 : 20);
        skQ.color = costOk ? GLASS : new Color(0.35f, 0.08f, 0.1f, 0.8f);
    }

    public static void Toast(string msg, Color color)
    {
        var bg = Img(toastBox, "toast", new Color(0.05f, 0.06f, 0.1f, 0.7f), round);
        var le = bg.gameObject.AddComponent<LayoutElement>(); le.preferredHeight = 34;
        var t = Txt(bg.transform, msg, 16, color, TextAnchor.MiddleLeft, true);
        Stretch(t.rectTransform); t.rectTransform.offsetMin = new Vector2(14, 0);
        var fitter = bg.gameObject.AddComponent<CanvasGroup>();
        while (toastBox.childCount > 5) UnityEngine.Object.DestroyImmediate(toastBox.GetChild(0).gameObject);
        toasts.Add((fitter, Time.unscaledTime));
    }
    static readonly List<(CanvasGroup cg, float t0)> toasts = new();

    public static void Banner(string title, string sub)
    {
        bannerTitle.text = title; bannerSub.text = sub.ToUpperInvariant();
        bannerT = 2.6f;
    }

    public static void Boss(Enemy e)
    {
        if (e == null || !e.alive) { bossBox.SetActive(false); return; }
        bossBox.SetActive(true);
        bossName.text = e.def.name;
        SetFill(bossFill, (float)e.hp / e.max);
    }

    public static void Quest()
    {
        if (S.quest == 0 || S.quest == 3) { questBox.SetActive(false); return; }
        questBox.SetActive(true);
        qTitle.text = "Dọn sạch Đại Sảnh";
        int left = G.HallLeft();
        qStep.text = S.quest == 2 ? "Quay lại gặp Pháp Sư Lyra" : $"Hạ bộ xương: {G.hallTotal - left}/{G.hallTotal}";
        qStep.color = S.quest == 2 ? GOOD : TEXT;
    }

    static Image hurt; static float hurtT;
    public static void Hurt() => hurtT = 0.16f;

    // ---------- world-anchored: số sát thương, thanh máu quái, nhãn loot, marker, bong bóng ----------
    public class Anchor
    {
        public GameObject go; public RectTransform rt; public Text text; public Image fill; public CanvasGroup cg;
        public Func<Vector3?> pos; public float dy, life, t, rise; public bool fade;
    }
    static readonly List<Anchor> anchors = new();

    static Anchor Add(GameObject go, Func<Vector3?> pos, float dy, float life = 0, float rise = 0, bool fade = false)
    {
        var a = new Anchor { go = go, rt = (RectTransform)go.transform, pos = pos, dy = dy, life = life, rise = rise, fade = fade };
        a.cg = go.AddComponent<CanvasGroup>(); a.cg.blocksRaycasts = false; a.cg.interactable = false;
        anchors.Add(a);
        return a;
    }

    public static void Drop(Anchor a) { anchors.Remove(a); if (a.go) UnityEngine.Object.Destroy(a.go); }

    public static void Dmg(Vector3 pos, string txt, string cls)
    {
        var (col, size) = cls switch
        {
            "crit" => (U.Html("#ffd34d"), 34), "big" => (U.Html("#ffd34d"), 32), "fire" => (U.Html("#ff9a3a"), 24),
            "hurt" => (U.Html("#ff5a6a"), 24), "heal" => (GOOD, 22), "gold" => (GOLD, 20), _ => (Color.white, 24),
        };
        var t = Txt(worldLayer, txt, size, col, TextAnchor.LowerCenter, true);
        t.rectTransform.sizeDelta = new Vector2(320, 50); t.rectTransform.pivot = new Vector2(0.5f, 0);
        Shadow(t, 2);
        var p = pos + new Vector3((U.Rnd - 0.5f) * 0.6f, 0, 0);
        bool pop = cls == "crit" || cls == "big";
        var a = Add(t.gameObject, () => p, 2.3f, pop ? 1.1f : 0.8f, 46, true);
        a.text = t;
        if (pop) t.transform.localScale = Vector3.one * 1.8f;
    }

    public static Anchor HpBar(Func<Vector3?> pos, float dy)
    {
        var bg = Img(worldLayer, "ehp", new Color(0, 0, 0, 0.6f), round);
        bg.rectTransform.sizeDelta = new Vector2(64, 9); bg.rectTransform.pivot = new Vector2(0.5f, 0);
        var f = Img(bg.transform, "fill", U.Html("#e8394d"), round);
        var rt = f.rectTransform; rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.pivot = new Vector2(0, 0.5f); rt.offsetMin = new Vector2(1, 1); rt.offsetMax = new Vector2(-1, -1);
        var a = Add(bg.gameObject, pos, dy);
        a.fill = f;
        return a;
    }
    public static void SetBar(Anchor a, float k) => SetFill(a.fill, k);

    public static Anchor Label(Func<Vector3?> pos, string txt, Color col, float dy)
    {
        var t = Txt(worldLayer, txt, 15, col, TextAnchor.LowerCenter, true);
        t.rectTransform.sizeDelta = new Vector2(300, 24); t.rectTransform.pivot = new Vector2(0.5f, 0); Shadow(t, 2);
        var a = Add(t.gameObject, pos, dy); a.text = t; return a;
    }

    public static Anchor Marker(Func<Vector3?> pos, float dy)
    {
        var t = Txt(worldLayer, "!", 36, GOLD, TextAnchor.LowerCenter, true);
        t.rectTransform.sizeDelta = new Vector2(40, 48); t.rectTransform.pivot = new Vector2(0.5f, 0); Shadow(t, 2);
        var a = Add(t.gameObject, pos, dy); a.text = t; return a;
    }

    public static void Bubble(Func<Vector3?> pos, string txt, float dy, float life)
    {
        var bg = Img(worldLayer, "bubble", new Color(0.96f, 0.93f, 0.86f, 0.95f), round);
        bg.rectTransform.pivot = new Vector2(0.5f, 0);
        var t = Txt(bg.transform, txt, 15, U.Hex(0x1a1206), TextAnchor.MiddleCenter, true);
        Stretch(t.rectTransform); t.rectTransform.offsetMin = new Vector2(12, 6); t.rectTransform.offsetMax = new Vector2(-12, -6);
        bg.rectTransform.sizeDelta = new Vector2(Mathf.Min(360, t.preferredWidth + 28), 40);
        Add(bg.gameObject, pos, dy, life, 0, true);
    }

    public static void UpdateAnchors(Camera cam, float dt)
    {
        float scale = canvas.scaleFactor;
        for (int i = anchors.Count - 1; i >= 0; i--)
        {
            var a = anchors[i];
            if (!a.go) { anchors.RemoveAt(i); continue; }
            a.t += dt;
            if (a.life > 0 && a.t >= a.life) { UnityEngine.Object.Destroy(a.go); anchors.RemoveAt(i); continue; }
            var p = a.pos();
            if (!p.HasValue) continue;
            var s = cam.WorldToScreenPoint(p.Value + Vector3.up * a.dy);
            bool vis = s.z > 0 && s.x > -100 && s.x < Screen.width + 100 && s.y > -100 && s.y < Screen.height + 100;
            if (!vis) { a.cg.alpha = 0; continue; }
            float k = a.life > 0 ? a.t / a.life : 0;
            s.y += a.rise * scale * (1 - (1 - k) * (1 - k));
            a.rt.position = new Vector3(s.x, s.y, 0);
            a.cg.alpha = a.fade && k > 0.6f ? 1 - (k - 0.6f) / 0.4f : 1;
            if (a.text && a.go.transform.localScale.x > 1) a.go.transform.localScale = Vector3.one * Mathf.Max(1, a.go.transform.localScale.x - dt * 5);
        }
        // banner, toast, hurt, gợi ý
        if (bannerT > 0) { bannerT -= dt; bannerCg.alpha = Mathf.Clamp01(Mathf.Min(bannerT / 0.4f, (2.6f - bannerT) / 0.25f)); }
        else bannerCg.alpha = 0;
        for (int i = toasts.Count - 1; i >= 0; i--)
        {
            var (cg, t0) = toasts[i];
            if (!cg) { toasts.RemoveAt(i); continue; }
            float age = Time.unscaledTime - t0;
            if (age > 3.5f) { UnityEngine.Object.Destroy(cg.gameObject); toasts.RemoveAt(i); continue; }
            cg.alpha = age > 3 ? (3.5f - age) / 0.5f : 1;
        }
        if (hurtT > 0) { hurtT -= dt; hurt.color = new Color(0.75f, 0.05f, 0.1f, 0.28f); } else if (hurt.color.a > 0) hurt.color = new Color(0.75f, 0.05f, 0.1f, Mathf.Max(0, hurt.color.a - dt * 2));
        if (hintT > 0) { hintT -= dt; if (hintT < 1) hint.color = new Color(MUTED.r, MUTED.g, MUTED.b, Mathf.Max(0, hintT)); }
    }

    // ---------- hội thoại ----------
    static GameObject dialog; static RawImage dlgFace; static Text dlgName, dlgText; static RectTransform dlgActs;
    static readonly List<Action> dlgFns = new();
    public static bool DialogOpen => dialog.activeSelf;
    public static bool Busy => dialog.activeSelf || inv.activeSelf;

    static void BuildDialog()
    {
        var d = Img(root, "dialog", new Color(0.04f, 0.05f, 0.09f, 0.9f), round);
        dialog = d.gameObject;
        Place(d.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(860, 210), new Vector2(0.5f, 0));
        var o = d.gameObject.AddComponent<Outline>(); o.effectColor = new Color(0.96f, 0.77f, 0.32f, 0.35f); o.effectDistance = new Vector2(1, -1);
        var ff = Img(d.transform, "face-frame", GLASS, circle); Place(ff.rectTransform, new Vector2(0, 1), new Vector2(20, -20), new Vector2(120, 120), new Vector2(0, 1));
        ff.gameObject.AddComponent<Mask>().showMaskGraphic = true;
        dlgFace = Raw(ff.transform, "face"); Place(dlgFace.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(120, 120), new Vector2(0.5f, 0.5f));
        dlgName = Txt(d.transform, "", 20, GOLD, TextAnchor.UpperLeft, true); Place(dlgName.rectTransform, new Vector2(0, 1), new Vector2(160, -18), new Vector2(660, 28), new Vector2(0, 1));
        dlgText = Txt(d.transform, "", 18, TEXT, TextAnchor.UpperLeft); Place(dlgText.rectTransform, new Vector2(0, 1), new Vector2(160, -52), new Vector2(670, 90), new Vector2(0, 1));
        dlgText.horizontalOverflow = HorizontalWrapMode.Wrap; dlgText.lineSpacing = 1.15f;
        dlgActs = Rect(d.transform, "acts"); Place(dlgActs, new Vector2(1, 0), new Vector2(-20, 18), new Vector2(660, 44), new Vector2(1, 0));
        var hl = dlgActs.gameObject.AddComponent<HorizontalLayoutGroup>(); hl.childAlignment = TextAnchor.MiddleRight; hl.spacing = 12; hl.childControlWidth = false; hl.childControlHeight = false;
        dialog.SetActive(false);
    }

    public static void Dialog(Texture face, string name, string text, params (string label, Action fn, bool ghost)[] acts)
    {
        dialog.SetActive(true);
        dlgFace.texture = face;
        dlgName.text = name; dlgText.text = text;
        foreach (Transform c in dlgActs) UnityEngine.Object.Destroy(c.gameObject);
        dlgFns.Clear();
        foreach (var (label, fn, ghost) in acts)
        {
            var f = fn;
            var b = Button(dlgActs, label, ghost, () => { dialog.SetActive(false); f?.Invoke(); });
            dlgFns.Add(() => { dialog.SetActive(false); f?.Invoke(); });
        }
    }

    public static void DialogConfirm() { if (dlgFns.Count > 0) dlgFns[0](); else dialog.SetActive(false); }

    public static void CloseModals() { dialog.SetActive(false); inv.SetActive(false); }

    // ---------- túi đồ ----------
    static GameObject inv; static RectTransform equipBox, bagBox, detailBox; static Text statsTxt; static int sel = -1;

    static void BuildInventory()
    {
        var shade = Img(root, "inv", new Color(0, 0, 0, 0.55f), null); inv = shade.gameObject; Stretch(shade.rectTransform);
        shade.gameObject.AddComponent<Button>().onClick.AddListener(() => inv.SetActive(false));
        var p = Img(shade.transform, "panel", new Color(0.05f, 0.06f, 0.1f, 0.96f), round);
        Place(p.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(980, 560), new Vector2(0.5f, 0.5f));
        p.gameObject.AddComponent<Button>().transition = Selectable.Transition.None; // chặn click xuyên xuống nền
        var title = Txt(p.transform, "Túi đồ", 26, GOLD, TextAnchor.UpperLeft, true); Place(title.rectTransform, new Vector2(0, 1), new Vector2(28, -20), new Vector2(300, 36), new Vector2(0, 1));
        Button(p.transform, "Đóng  [Esc]", true, () => inv.SetActive(false)).GetComponent<RectTransform>().Also(r => Place(r, new Vector2(1, 1), new Vector2(-24, -20), new Vector2(140, 40), new Vector2(1, 1)));
        var eqT = Txt(p.transform, "Đang mặc", 15, MUTED, TextAnchor.UpperLeft, true); Place(eqT.rectTransform, new Vector2(0, 1), new Vector2(28, -70), new Vector2(200, 22), new Vector2(0, 1));
        equipBox = Rect(p.transform, "equip"); Place(equipBox, new Vector2(0, 1), new Vector2(28, -96), new Vector2(220, 100), new Vector2(0, 1));
        var eh = equipBox.gameObject.AddComponent<HorizontalLayoutGroup>(); eh.spacing = 12; eh.childControlWidth = false; eh.childControlHeight = false;
        statsTxt = Txt(p.transform, "", 15, TEXT, TextAnchor.UpperLeft); Place(statsTxt.rectTransform, new Vector2(0, 1), new Vector2(28, -214), new Vector2(230, 200), new Vector2(0, 1));
        statsTxt.lineSpacing = 1.35f;
        var bagT = Txt(p.transform, "Hành trang (20 ô)", 15, MUTED, TextAnchor.UpperLeft, true); Place(bagT.rectTransform, new Vector2(0, 1), new Vector2(280, -70), new Vector2(300, 22), new Vector2(0, 1));
        bagBox = Rect(p.transform, "bag"); Place(bagBox, new Vector2(0, 1), new Vector2(280, -96), new Vector2(380, 310), new Vector2(0, 1));
        var gl = bagBox.gameObject.AddComponent<GridLayoutGroup>(); gl.cellSize = new Vector2(66, 66); gl.spacing = new Vector2(8, 8); gl.constraint = GridLayoutGroup.Constraint.FixedColumnCount; gl.constraintCount = 5;
        detailBox = Rect(p.transform, "detail"); Place(detailBox, new Vector2(0, 1), new Vector2(690, -70), new Vector2(270, 470), new Vector2(0, 1));
        inv.SetActive(false);
    }

    public static void ToggleInv() { inv.SetActive(!inv.activeSelf); if (inv.activeSelf) RefreshInv(true); }

    public static void RefreshInv(bool force = false)
    {
        if (!inv.activeSelf && !force) return;
        foreach (Transform c in equipBox) UnityEngine.Object.Destroy(c.gameObject);
        foreach (Transform c in bagBox) UnityEngine.Object.Destroy(c.gameObject);
        Cell(equipBox, S.weapon, 100); Cell(equipBox, S.shield, 100);
        for (int i = 0; i < 20; i++) Cell(bagBox, i < S.bag.Count ? S.bag[i] : null, 66);
        var ST = G.ST;
        statsTxt.text =
            $"<color=#a8a3b8>Sát thương</color>   {Mathf.RoundToInt(ST.dmg[0] * ST.mult)}–{Mathf.RoundToInt(ST.dmg[1] * ST.mult)}{(ST.fire > 0 ? $" (+{ST.fire} lửa)" : "")}\n" +
            $"<color=#a8a3b8>Giáp</color>   {ST.armor}\n<color=#a8a3b8>Chí mạng</color>   {ST.crit:0.0}%\n" +
            $"<color=#a8a3b8>Máu / Mana</color>   {ST.maxHp} / {ST.maxMp}\n<color=#a8a3b8>Vàng</color>   {S.gold}";
        Detail(Find(sel) ?? S.weapon);
    }

    static Item Find(int id) => new[] { S.weapon, S.shield }.Concat(S.bag).FirstOrDefault(x => x != null && x.id == id);

    static void Cell(RectTransform parent, Item it, float size)
    {
        var c = Img(parent, "cell", new Color(1, 1, 1, 0.05f), round);
        c.rectTransform.sizeDelta = new Vector2(size, size);
        if (it == null) return;
        var R = Items.RAR[it.rarity];
        var o = c.gameObject.AddComponent<Outline>(); o.effectColor = new Color(R.c.r, R.c.g, R.c.b, sel == it.id ? 1 : 0.55f); o.effectDistance = new Vector2(2, -2);
        c.color = new Color(R.c.r * 0.25f, R.c.g * 0.25f, R.c.b * 0.25f, 0.6f);
        var ico = Raw(c.transform, "ico"); ico.texture = Thumbs.Get(it.m); ico.raycastTarget = false;
        Place(ico.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(size * 0.85f, size * 0.85f), new Vector2(0.5f, 0.5f));
        var item = it;
        c.gameObject.AddComponent<Button>().onClick.AddListener(() => { sel = item.id; RefreshInv(); });
    }

    static void Detail(Item it)
    {
        foreach (Transform c in detailBox) UnityEngine.Object.Destroy(c.gameObject);
        if (it == null) return;
        var R = Items.RAR[it.rarity];
        bool worn = S.weapon == it || S.shield == it;
        var lines = new List<string>();
        lines.Add($"<size=21><b><color=#{ColorUtility.ToHtmlStringRGB(R.c)}>{it.name}</color></b></size>");
        lines.Add($"<color=#a8a3b8>{R.n}{(it.baseName != null && it.rarity >= 2 ? $" · {it.baseName}" : "")} · cấp {it.ilvl}{(worn ? " · đang mặc" : "")}</color>");
        if (it.dmg != null) lines.Add($"<b>{it.dmg[0]}–{it.dmg[1]} sát thương</b>");
        if (it.armor > 0) lines.Add($"<b>{it.armor} giáp</b>");
        if (it.kind == "potion") lines.Add("<b>Hồi 45% máu (phím R)</b>");
        foreach (var a in it.affixes) lines.Add($"<color=#9fd0ff>• {a.t}</color>");
        if (it.power != null) lines.Add($"<color=#ff8a2a>{it.power.p}</color>");
        if (!worn && it.kind != "potion")
        {
            var cur = S.Eq(it.kind);
            float Val(Item x) => x == null ? 0 : x.dmg != null ? (x.dmg[0] + x.dmg[1]) / 2f : x.armor;
            float diff = Mathf.Round((Val(it) - Val(cur)) * 10) / 10;
            lines.Add($"<color=#{(diff >= 0 ? "7be38a" : "ff7a6b")}>{(diff >= 0 ? "▲" : "▼")} {Mathf.Abs(diff)} {(it.dmg != null ? "sát thương TB" : "giáp")} so với đồ đang mặc</color>");
        }
        var t = Txt(detailBox, string.Join("\n", lines), 16, TEXT, TextAnchor.UpperLeft);
        t.supportRichText = true; t.lineSpacing = 1.25f;
        Place(t.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(270, 380), new Vector2(0, 1));
        if (!worn)
        {
            var acts = Rect(detailBox, "acts"); Place(acts, new Vector2(0, 0), Vector2.zero, new Vector2(270, 44), new Vector2(0, 0));
            var hl = acts.gameObject.AddComponent<HorizontalLayoutGroup>(); hl.spacing = 10; hl.childControlWidth = false; hl.childControlHeight = false;
            if (it.kind == "potion") Button(acts, "Uống", false, () => Act(it, "use"));
            else Button(acts, "Trang bị", false, () => Act(it, "eq"));
            Button(acts, $"Bán {Items.SellPrice(it)} vàng", true, () => Act(it, "sell"));
        }
    }

    static void Act(Item it, string a)
    {
        int i = S.bag.IndexOf(it);
        if (i < 0) return;
        if (a == "eq")
        {
            var old = S.Eq(it.kind); S.SetEq(it.kind, it); S.bag.RemoveAt(i); if (old != null) S.bag.Insert(i, old);
            G.EquipChanged(it);
        }
        if (a == "sell") { S.bag.RemoveAt(i); S.gold += Items.SellPrice(it); sel = -1; }
        if (a == "use") G.Drink();
        G.Refresh();
        RefreshInv();
    }

    // ---------- minimap ----------
    public static void Minimap()
    {
        var M = Defs.MAP; int cols = M[0].Length, rows = M.Length;
        float s = Mathf.Min(MW / (float)cols, MH / (float)rows), ox = (MW - cols * s) / 2, oy = (MH - rows * s) / 2;
        var bg = new Color32(4, 5, 10, 140);
        for (int i = 0; i < miniPx.Length; i++) miniPx[i] = bg;
        for (int r = 0; r < rows; r++) for (int q = 0; q < cols; q++)
        {
            char ch = M[r][q];
            if (ch == '#' || !G.seen.Contains(new Vector2Int(q, r))) continue;
            Color32 c = ch == 'c' ? new Color32(0x3c, 0x33, 0x52, 255) : ch == 't' ? new Color32(0x4d, 0x3a, 0x26, 255) : new Color32(0x3a, 0x3f, 0x4f, 255);
            FillRect(ox + q * s + 0.5f, oy + r * s + 0.5f, s - 1, s - 1, c);
        }
        Vector2 P(Vector3 w) => new(ox + w.x / Defs.C * s, oy + -w.z / Defs.C * s);
        foreach (var e in G.enemies) if (e.alive && e.state != "dormant") Dot(P(e.root.position), e.def.boss ? 3.5f : 2.2f, e.def.boss ? new Color32(0xff, 0x8a, 0x3a, 255) : new Color32(0xff, 0x5a, 0x6a, 255));
        foreach (var n in G.npcs) Dot(P(n.root.position), 2.6f, new Color32(0x9f, 0xd0, 0xff, 255));
        foreach (var ch in G.chests) if (!ch.opened) { var p = P(ch.obj.position); FillRect(p.x - 2, p.y - 2, 4, 4, new Color32(0xf5, 0xc4, 0x51, 255)); }
        var hp = P(G.HP); var f = U.Fwd(G.hero.root);
        Dot(hp, 3, new Color32(255, 255, 255, 255));
        Dot(hp + new Vector2(f.x, -f.z) * 4, 1.4f, new Color32(255, 255, 255, 255));
        miniTex.SetPixels32(miniPx);
        miniTex.Apply(false);
    }

    // toạ độ minimap: y đi xuống như canvas 2D của demo2 -> lật khi ghi pixel
    static void Px(int x, int y, Color32 c) { y = MH - 1 - y; if (x >= 0 && x < MW && y >= 0 && y < MH) miniPx[y * MW + x] = c; }
    static void FillRect(float x, float y, float w, float h, Color32 c) { for (int j = Mathf.RoundToInt(y); j < Mathf.RoundToInt(y + h); j++) for (int i = Mathf.RoundToInt(x); i < Mathf.RoundToInt(x + w); i++) Px(i, j, c); }
    static void Dot(Vector2 p, float r, Color32 c) { for (int j = -Mathf.CeilToInt(r); j <= Mathf.CeilToInt(r); j++) for (int i = -Mathf.CeilToInt(r); i <= Mathf.CeilToInt(r); i++) if (i * i + j * j <= r * r) Px(Mathf.RoundToInt(p.x) + i, Mathf.RoundToInt(p.y) + j, c); }

    // ---------- helper dựng UI ----------
    static RectTransform Rect(Transform parent, string name)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        return (RectTransform)go.transform;
    }

    static void Stretch(RectTransform rt) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero; }

    static void Place(RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size, Vector2 pivot)
    {
        rt.anchorMin = rt.anchorMax = anchor; rt.pivot = pivot; rt.anchoredPosition = pos; rt.sizeDelta = size;
    }

    static Image Img(Transform parent, string name, Color c, Sprite sprite)
    {
        var rt = Rect(parent, name);
        var i = rt.gameObject.AddComponent<Image>();
        i.color = c; i.sprite = sprite;
        if (sprite) i.type = Image.Type.Sliced;
        return i;
    }

    static RawImage Raw(Transform parent, string name) { var rt = Rect(parent, name); return rt.gameObject.AddComponent<RawImage>(); }

    static Text Txt(Transform parent, string s, int size, Color c, TextAnchor align, bool bold = false)
    {
        var rt = Rect(parent, "txt");
        var t = rt.gameObject.AddComponent<Text>();
        t.font = bold ? Res.Bold : Res.Font; t.fontSize = size; t.color = c; t.alignment = align; t.text = s;
        t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
        t.raycastTarget = false; t.supportRichText = true;
        return t;
    }

    static void Shadow(Text t, float d = 1.5f) { var s = t.gameObject.AddComponent<Shadow>(); s.effectColor = new Color(0, 0, 0, 0.85f); s.effectDistance = new Vector2(d, -d); }

    static GameObject Button(Transform parent, string label, bool ghost, Action fn)
    {
        var b = Img(parent, "btn", ghost ? new Color(1, 1, 1, 0.08f) : GOLD, round);
        var t = Txt(b.transform, label, 16, ghost ? TEXT : U.Hex(0x1a1206), TextAnchor.MiddleCenter, true);
        Stretch(t.rectTransform);
        b.rectTransform.sizeDelta = new Vector2(Mathf.Max(120, t.preferredWidth + 36), 42);
        b.gameObject.AddComponent<Button>().onClick.AddListener(() => fn());
        return b.gameObject;
    }

    static T Also<T>(this T x, Action<T> f) { f(x); return x; }

    // sprite bo góc 9-slice sinh bằng code (runtime không dùng được sprite UI có sẵn của editor)
    static Sprite MakeRounded(int n, int radius)
    {
        var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
        for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
        {
            float cx = Mathf.Clamp(x + 0.5f, radius, n - radius), cy = Mathf.Clamp(y + 0.5f, radius, n - radius);
            float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
            t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(radius - d + 0.5f)));
        }
        t.Apply();
        return Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(radius, radius, radius, radius));
    }
}
