using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Lõi game: trạng thái, vòng lặp, input, camera, boot. Port từ demo2/src/main.js.
// Logic tách thành các file partial: Game.World / Game.Combat / Game.Loot.
public partial class Game : MonoBehaviour
{
    public static Game I;

    // ---------- ánh sáng / màu (quy đổi từ cường độ three.js ~ chia π) ----------
    static readonly Color BG = U.Hex(0x07080d);
    const float MOON = 0.55f, AMBIENT = 0.42f, TORCH = 14f, TORCH_TEAL = 7f;

    public Camera cam;
    Light moon;
    Volume volume;
    public Particles glow, dust;
    public readonly Tweens tweens = new();

    // ---------- trạng thái (G trong demo2) ----------
    public Stats ST;
    public HeroDef def;
    public Actor hero;
    public string state = "idle";
    public Enemy target;
    public Vector3? goal;
    bool holding;
    public float atkReady, invuln, cancelAt, dashEnd;
    Vector3 dashV;
    int combo;
    public float cdQ, cdE, cdR;
    public float shake;
    public int hallTotal;
    char area;
    readonly HashSet<char> areaSeen = new();
    public readonly HashSet<Vector2Int> seen = new();
    public readonly List<Enemy> enemies = new();
    public readonly List<Npc> npcs = new();
    public readonly List<Chest> chests = new();
    public readonly List<Loot> loot = new();
    readonly List<Bolt> bolts = new();
    readonly List<Vector3> colliders = new(); // (x, z, r) toạ độ Unity
    readonly List<(float t, Action fn)> timers = new();
    public Npc nearNpc, brann, lyra;
    public bool ready;
    public bool god; // chỉ dùng trong test tự động
    public float speed = 1; // test tự động tua nhanh
    float stopUntil;

    public float now => Time.time;
    public Vector3 HP => hero.root.position;

    void Awake()
    {
        I = this;
        Application.targetFrameRate = 60;
        Time.maximumDeltaTime = 1 / 20f;
    }

    IEnumerator Start()
    {
        S.Reset();
        SetupRender();
        Fx.tweens = tweens;
        glow = new Particles("glow", Res.Mat("FxAdd"), 2500);
        dust = new Particles("dust", Res.Mat("FxAlpha"), 800);
        Hud.Build(this);
        Hud.Loading("Dựng hầm ngục…");
        yield return null;

        Thumbs.Build(); // chụp icon/portrait trước khi bật fog
        RenderSettings.fog = true;
        BuildWorld();
        SetupNpcs();
        var hall = new (string type, float x, float z)[] { ("minion", 28.5f, 8), ("warrior", 35, 9.5f), ("minion", 45, 13), ("mage", 36, 14.5f), ("warrior", 39.5f, 21), ("minion", 27.5f, 19.5f), ("mage", 45.5f, 18) };
        foreach (var (type, x, z) in hall) SpawnEnemy(type, U.P(x, z), dormant: true, room: 'h', lvl: 2);
        hallTotal = HallLeft();
        SpawnEnemy("boss", U.P(12.5f, 26.5f), rot: 2.1f, room: 'c', lvl: 4);
        ST = S.Calc(); S.hp = ST.maxHp; S.mp = ST.maxMp;
        Hud.HeroButtons();
        SpawnHero("Knight", U.P(8.5f, 13.5f), Mathf.PI * 0.85f);
        // vài món mẫu dưới sàn quán để xem hiệu ứng độ hiếm
        for (int i = 0; i < 4; i++)
        {
            int rar = i;
            var it = Items.Roll(2, new Items.Opt { rarity = rar, kind = rar == 0 ? "shield" : "weapon" });
            var to = U.P(6.5f + i * 2.2f, 7);
            After(0.6f + i * 0.25f, () => DropItem(it, to + Vector3.up * 1.5f, to));
        }
        camLook = HP;
        Hud.Vitals(); Hud.Quest();
        Hud.Loading(null);
        ready = true;
    }

    // ---------- render: camera, đèn, fog, post-process ----------
    void SetupRender()
    {
        var cg = new GameObject("Camera");
        cam = cg.AddComponent<Camera>();
        cam.fieldOfView = 36; cam.nearClipPlane = 0.1f; cam.farClipPlane = 200;
        cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = BG;
        cam.cullingMask = ~(1 << Thumbs.LAYER);
        var cd = cg.AddComponent<UniversalAdditionalCameraData>();
        cd.renderPostProcessing = true;
        cd.antialiasing = AntialiasingMode.FastApproximateAntialiasing;
        cg.AddComponent<AudioListener>();
        cg.tag = "MainCamera";

        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = U.Hex(0x8090c8) * AMBIENT * 1.3f;
        RenderSettings.ambientEquatorColor = Color.Lerp(U.Hex(0x8090c8), U.Hex(0x2a1d14), 0.5f) * AMBIENT;
        RenderSettings.ambientGroundColor = U.Hex(0x2a1d14) * AMBIENT;
        RenderSettings.fog = false;
        RenderSettings.fogMode = FogMode.Linear;
        RenderSettings.fogColor = BG;
        RenderSettings.fogStartDistance = 30; RenderSettings.fogEndDistance = 60;
        RenderSettings.skybox = null;

        var lg = new GameObject("Moon");
        moon = lg.AddComponent<Light>();
        moon.type = LightType.Directional;
        moon.color = U.Hex(0xb4c2ff);
        moon.intensity = MOON;
        moon.shadows = LightShadows.Soft;
        moon.shadowBias = 0.05f; moon.shadowNormalBias = 0.4f;
        moon.cullingMask = ~(1 << Thumbs.LAYER);
        // three: từ (hp.x-9, 22, hp.z-6) chiếu xuống hero -> hướng (9,-22,6) -> lật z
        lg.transform.rotation = Quaternion.LookRotation(new Vector3(9, -22, -6));

        var vg = new GameObject("PostFX");
        volume = vg.AddComponent<Volume>();
        volume.isGlobal = true;
        var prof = ScriptableObject.CreateInstance<VolumeProfile>();
        var bloom = prof.Add<Bloom>(true);
        bloom.threshold.Override(0.9f); bloom.intensity.Override(0.7f); bloom.scatter.Override(0.6f);
        var tm = prof.Add<Tonemapping>(true);
        tm.mode.Override(TonemappingMode.ACES);
        var ca = prof.Add<ColorAdjustments>(true);
        ca.postExposure.Override(0.35f);
        var vig = prof.Add<Vignette>(true);
        vig.intensity.Override(0.28f); vig.smoothness.Override(0.5f);
        volume.profile = prof;

        if (!FindAnyObjectByType<EventSystem>())
        {
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
            es.AddComponent<StandaloneInputModule>();
        }
    }

    public void After(float sec, Action fn) => timers.Add((now + sec, fn));
    public void Hitstop(float t) => stopUntil = Time.unscaledTime + t;

    // ---------- input ----------
    bool Busy => Hud.Busy;

    void ReadKeys()
    {
        if (Input.GetKeyDown(KeyCode.Space)) Dodge();
        if (Input.GetKeyDown(KeyCode.J)) Attack(null);
        if (Input.GetKeyDown(KeyCode.Q)) Skill();
        if (Input.GetKeyDown(KeyCode.R)) Drink();
        if (Input.GetKeyDown(KeyCode.F)) { if (Hud.DialogOpen) Hud.DialogConfirm(); else Talk(); }
        if (Input.GetKeyDown(KeyCode.I)) Hud.ToggleInv();
        if (Input.GetKeyDown(KeyCode.Escape)) Hud.CloseModals();
        if (Input.GetKeyDown(KeyCode.Alpha1)) SwitchHero("Knight");
        if (Input.GetKeyDown(KeyCode.Alpha2)) SwitchHero("Barbarian");
        if (Input.GetKeyDown(KeyCode.Alpha3)) SwitchHero("Mage");

        bool overUI = EventSystem.current && EventSystem.current.IsPointerOverGameObject();
        if (Input.GetMouseButtonDown(0) && !overUI && !Busy)
        {
            var hit = PickAt(Input.mousePosition, out var p);
            if (hit != null) { target = hit; goal = null; }
            else if (p.HasValue) { target = null; goal = p; holding = true; }
        }
        if (!Input.GetMouseButton(0)) holding = false;
        else if (holding && goal.HasValue) { PickAt(Input.mousePosition, out var p, enemiesToo: false); if (p.HasValue) goal = p; }
    }

    Vector3? InputDir()
    {
        float x = (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) ? 1 : 0) - (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) ? 1 : 0);
        float z = (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow) ? 1 : 0) - (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow) ? 1 : 0);
        if (testDir.HasValue) { x = testDir.Value.x; z = testDir.Value.z; }
        float l = Mathf.Sqrt(x * x + z * z);
        if (l < 0.15f) return null;
        return new Vector3(x, 0, z) / Mathf.Max(1, l);
    }
    public Vector3? testDir; // test tự động "giữ phím"

    Enemy PickAt(Vector3 screen, out Vector3? point, bool enemiesToo = true)
    {
        point = null;
        if (enemiesToo)
        {
            Enemy best = null; float bd = 50 * Mathf.Max(1, Screen.height / 900f);
            foreach (var e in enemies)
            {
                if (!e.alive || e.state == "dormant") continue;
                var s = cam.WorldToScreenPoint(e.root.position + Vector3.up * 1.1f * e.def.scale);
                if (s.z < 0) continue;
                float d = Vector2.Distance(s, screen);
                if (d < bd) { bd = d; best = e; }
            }
            if (best != null) return best;
        }
        var ray = cam.ScreenPointToRay(screen);
        if (new Plane(Vector3.up, 0).Raycast(ray, out float t)) point = ray.GetPoint(t);
        return null;
    }

    // ---------- vòng lặp ----------
    int frames; float ftAcc; bool qualityChecked; float uiT, mmT;

    void Update()
    {
        Time.timeScale = (Time.unscaledTime < stopUntil ? 0.08f : 1) * speed;
        if (!ready) return;
        float dt = Time.deltaTime;
        for (int i = timers.Count - 1; i >= 0; i--)
            if (now >= timers[i].t) { var f = timers[i].fn; timers.RemoveAt(i); f(); }
        if (!Busy) ReadKeys(); else if (Input.GetKeyDown(KeyCode.F) && Hud.DialogOpen) Hud.DialogConfirm(); else if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.I)) Hud.CloseModals();
        hero.Tick();
        UpdateHero(dt);
        UpdateEnemies(dt);
        UpdateBolts(dt);
        UpdateWorld(dt);
        tweens.Update(dt);
    }

    void LateUpdate()
    {
        if (!ready) return;
        float dt = Time.deltaTime;
        UpdateCamera(dt);
        glow.Update(dt, cam); dust.Update(dt, cam);
        Hud.UpdateAnchors(cam, Time.unscaledDeltaTime);
        if ((uiT += dt) > 0.15f) { uiT = 0; Hud.Vitals(); Hud.Cooldowns(); }
        if ((mmT += dt) > 0.25f) { mmT = 0; Hud.Minimap(); }
        // tự hạ chất lượng nếu máy yếu (giống demo2)
        if (!qualityChecked && Time.unscaledTime > 3)
        {
            frames++; ftAcc += Time.unscaledDeltaTime;
            if (frames == 150)
            {
                qualityChecked = true;
                float avg = ftAcc / frames;
                if (avg > 1 / 35f && volume.profile.TryGet<Bloom>(out var b)) b.active = false;
            }
        }
    }

    Vector3 camLook;
    void UpdateCamera(float dt)
    {
        var hp = HP;
        bool portrait = (float)Screen.width / Screen.height < 0.8f;
        var off = portrait ? new Vector3(0, 21, -13.5f) : new Vector3(0, 15, -11);
        camLook.x = U.Damp(camLook.x, hp.x, 7, dt); camLook.z = U.Damp(camLook.z, hp.z, 7, dt); camLook.y = 1;
        var pos = camLook + off;
        if (shake > 0)
        {
            float s = shake * 0.35f;
            pos += new Vector3((U.Rnd - 0.5f) * s, (U.Rnd - 0.5f) * s, (U.Rnd - 0.5f) * s);
            shake = Mathf.Max(0, shake - dt * 1.6f);
        }
        cam.transform.position = pos;
        cam.transform.LookAt(camLook);
    }

    public int HallLeft() { int n = 0; foreach (var e in enemies) if (e.room == 'h' && e.alive) n++; return n; }
}

// ---------- kiểu dữ liệu runtime ----------
public class Enemy
{
    public Actor a; public EnemyDef def; public string type, state;
    public int hp, max, lvl; public bool alive = true; public float atkReady, slow; public char room;
    public Hud.Anchor bar;
    public Transform root => a.root;
}

public class Npc
{
    public Actor a; public string key, name; public bool seated;
    public Action<Npc> onTalk; public Hud.Anchor marker;
    public Transform root => a.root;
}

public class Chest { public Transform obj, lid; public bool opened; public int boost, n; }

public class Loot { public Item it; public Transform g, holder; public Renderer beam; public bool ready; public Hud.Anchor label; }

public class Bolt { public Transform m; public Vector3 v; public bool byHero, fire; public int dmg; public uint color; public float life; }
