using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

// Bọc 1 model KayKit có Legacy Animation: gọi clip theo tên + crossfade + callback khi chạy xong.
// Tương đương class Actor + AnimationMixer của demo2.
public class Actor
{
    public readonly string key;
    public readonly Transform root;
    public readonly GameObject model;
    readonly Animation anim;
    readonly Renderer[] renderers;
    readonly Dictionary<char, GameObject> slots = new();
    static MaterialPropertyBlock mpb;

    public string cur = "";
    float baseSpeed = 1;
    public float timeScale = 1; // làm chậm (Nova Băng)
    Action onDone;
    float flashUntil;

    public Actor(string key, float scale = 1)
    {
        this.key = key;
        root = new GameObject(key).transform;
        model = Res.Inst(key, root);
        model.transform.localScale = Vector3.one * scale;
        anim = model.GetComponent<Animation>();
        if (anim) { anim.cullingType = AnimationCullingType.AlwaysAnimate; anim.playAutomatically = false; }
        renderers = model.GetComponentsInChildren<Renderer>(true);
    }

    public bool Has(string n) => anim && anim[n] != null;
    public float Length(string n) => Has(n) ? anim[n].length : 0;

    public float Play(string n, bool once = false, float speed = 1, float fade = 0.15f, Action done = null, bool restart = false)
    {
        if (!Has(n)) return 0;
        var st = anim[n];
        if (cur == n && !once && !restart) { baseSpeed = speed; st.speed = speed * timeScale; return st.length; }
        st.wrapMode = once ? WrapMode.ClampForever : WrapMode.Loop;
        baseSpeed = speed;
        st.speed = speed * timeScale;
        if (cur == n) anim.Rewind(n);
        else st.time = 0;
        anim.CrossFade(n, fade, PlayMode.StopAll);
        cur = n;
        onDone = done;
        return st.length / speed;
    }

    public void Tick()
    {
        if (!anim || cur == "") return;
        var st = anim[cur];
        if (st == null) return;
        st.speed = baseSpeed * timeScale;
        if (onDone != null && st.wrapMode == WrapMode.ClampForever && st.normalizedTime >= 1)
        {
            var f = onDone; onDone = null; f();
        }
        if (flashUntil > 0 && Time.time > flashUntil) { flashUntil = 0; SetTint(null); }
    }

    // chớp trắng khi trúng đòn
    public void Flash(float dur = 0.08f)
    {
        flashUntil = Time.time + dur;
        SetTint(new Color(2.6f, 2.6f, 2.6f, 1));
    }

    void SetTint(Color? c)
    {
        mpb ??= new MaterialPropertyBlock();
        foreach (var r in renderers)
        {
            if (!r) continue;
            if (c == null) { r.SetPropertyBlock(null); continue; }
            r.GetPropertyBlock(mpb);
            mpb.SetColor("_BaseColor", c.Value);
            r.SetPropertyBlock(mpb);
        }
    }

    public void Hide(IEnumerable<string> names) { foreach (var n in names) { var t = U.Find(model.transform, n); if (t) t.gameObject.SetActive(false); } }
    public void Show(IEnumerable<string> names) { foreach (var n in names) { var t = U.Find(model.transform, n); if (t) t.gameObject.SetActive(true); } }

    // gắn vũ khí/khiên vào bone handslot.r / handslot.l, căn theo mesh vũ khí gốc (ref) của nhân vật
    public void Attach(char slot, string itemKey, string refName = null)
    {
        var bone = U.Find(model.transform, slot == 'r' ? "handslot.r" : "handslot.l");
        if (!bone) return;
        if (slots.TryGetValue(slot, out var old) && old) Object.Destroy(old);
        slots[slot] = null;
        if (string.IsNullOrEmpty(itemKey)) return;
        var m = Res.Inst(itemKey, bone);
        var r = refName != null ? U.Find(model.transform, refName) : null;
        if (r) { m.transform.localPosition = r.localPosition; m.transform.localRotation = r.localRotation; m.transform.localScale = r.localScale; }
        else { m.transform.localPosition = Vector3.zero; m.transform.localRotation = Quaternion.identity; }
        slots[slot] = m;
    }

    public void Dispose() { if (root) Object.Destroy(root.gameObject); }
}
