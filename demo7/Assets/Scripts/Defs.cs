using System.Collections.Generic;

// Dữ liệu tĩnh port nguyên từ demo2/src/main.js
public static class Defs
{
    // mỗi ô = 4 đơn vị (floor_tile_large)
    public const float C = 4;
    public static readonly string[] MAP =
    {
        "#############",
        "#tttt#hhhhhh#",
        "#tttt.hhhhhh#",
        "#tttt#hhhhhh#",
        "######hhhhhh#",
        "#cccc.hhhhhh#",
        "#cccc########",
        "#cccc########",
        "#############",
    };
    // (x, z, rotation.y) theo toạ độ demo2
    public static readonly float[][] DOORS = { new[] { 24f, 10f, UnityEngine.Mathf.PI / 2 }, new[] { 20f, 22f, UnityEngine.Mathf.PI / 2 } };
    public static readonly Dictionary<char, string[]> AREAS = new()
    {
        ['t'] = new[] { "Quán Rượu Đầu Hầm", "Khu an toàn" },
        ['h'] = new[] { "Đại Sảnh Xương Khô", "Cẩn thận phía trước" },
        ['c'] = new[] { "Hầm Mộ Vua Xương", "Trùm cuối" },
    };

    public static char Cell(int q, int r) => r >= 0 && r < MAP.Length && q >= 0 && q < MAP[r].Length ? MAP[r][q] : '#';
    // x, z theo toạ độ demo2
    public static char CellAt(float x, float z) => Cell(UnityEngine.Mathf.FloorToInt(x / C), UnityEngine.Mathf.FloorToInt(z / C));
    public static bool FloorAt(float x, float z) => CellAt(x, z) != '#';

    public static readonly Dictionary<string, HeroDef> HEROES = new()
    {
        ["Knight"] = new HeroDef
        {
            key = "Knight", name = "Hiệp Sĩ Aldric", magic = false, idle = "Idle",
            hide = new[] { "1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Spike_Shield", "1H_Sword", "2H_Sword", "Round_Shield" },
            atk = new[] { "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop" }, skill = "2H_Melee_Attack_Spin", skillName = "Lốc Xoáy",
            atkIcon = "sword_1handed", skillIcon = "axe_2handed",
        },
        ["Barbarian"] = new HeroDef
        {
            key = "Barbarian", name = "Chiến Binh Brann", magic = false, idle = "2H_Melee_Idle",
            hide = new[] { "1H_Axe_Offhand", "Barbarian_Round_Shield", "1H_Axe", "2H_Axe", "Mug" },
            atk = new[] { "2H_Melee_Attack_Chop", "1H_Melee_Attack_Chop" }, skill = "2H_Melee_Attack_Spin", skillName = "Lốc Xoáy",
            atkIcon = "axe_2handed", skillIcon = "axe_1handed",
        },
        ["Mage"] = new HeroDef
        {
            key = "Mage", name = "Pháp Sư Lyra", magic = true, idle = "Idle",
            hide = new[] { "Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff" },
            atk = new[] { "Spellcast_Shoot" }, skill = "Spellcast_Long", skillName = "Nova Băng",
            atkIcon = "wand", skillIcon = "staff",
        },
    };
    public static readonly string[] HERO_ORDER = { "Knight", "Barbarian", "Mage" };

    public static readonly Dictionary<string, EnemyDef> ENEMIES = new()
    {
        ["minion"] = new EnemyDef { key = "Skeleton_Minion", name = "Lính Xương", hp = 34, dmg = new[] { 4, 7 }, spd = 3.4f, range = 1.7f, atk = "Unarmed_Melee_Attack_Punch_A", hitT = 0.4f, cd = 1.3f, xp = 9, run = "Running_A" },
        ["warrior"] = new EnemyDef { key = "Skeleton_Warrior", name = "Chiến Binh Xương", hp = 60, dmg = new[] { 6, 10 }, spd = 2.9f, range = 1.9f, atk = "1H_Melee_Attack_Chop", hitT = 0.45f, cd = 1.6f, xp = 15, weapon = "Skeleton_Blade", shield = "Skeleton_Shield_Small_A", run = "Walking_D_Skeletons" },
        ["mage"] = new EnemyDef { key = "Skeleton_Mage", name = "Pháp Sư Xương", hp = 40, dmg = new[] { 7, 11 }, spd = 2.6f, range = 8, atk = "Spellcast_Shoot", hitT = 0.5f, cd = 2.2f, xp = 16, weapon = "Skeleton_Staff", ranged = true, run = "Walking_D_Skeletons" },
        ["boss"] = new EnemyDef { key = "Skeleton_Warrior", name = "Vua Xương Morvak", hp = 520, dmg = new[] { 12, 18 }, spd = 2.7f, range = 2.9f, atk = "2H_Melee_Attack_Chop", hitT = 0.55f, cd = 2.0f, xp = 150, weapon = "Skeleton_Axe", scale = 1.65f, boss = true, run = "Running_A" },
    };

    // clip thực sự dùng: importer chỉ giữ các clip này để build WebGL nhẹ hơn
    public static readonly HashSet<string> CLIPS = new()
    {
        "Idle", "2H_Melee_Idle", "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop", "2H_Melee_Attack_Chop", "2H_Melee_Attack_Spin",
        "Spellcast_Shoot", "Spellcast_Long", "Running_A", "Dodge_Forward", "Hit_A", "Hit_B", "Death_A", "Sit_Chair_Idle", "Interact", "Cheer",
        "Idle_Combat", "Unarmed_Melee_Attack_Punch_A", "Walking_D_Skeletons", "Death_C_Skeletons", "Skeletons_Inactive_Floor_Pose",
        "Skeletons_Awaken_Floor", "Taunt",
    };
}

public class HeroDef
{
    public string key, name, idle, skill, skillName, atkIcon, skillIcon;
    public bool magic;
    public string[] hide, atk;
}

public class EnemyDef
{
    public string key, name, atk, run, weapon, shield;
    public int hp, xp;
    public int[] dmg;
    public float spd, range, hitT, cd, scale = 1;
    public bool ranged, boss;
}
