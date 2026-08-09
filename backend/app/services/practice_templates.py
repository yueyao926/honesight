from __future__ import annotations

from copy import deepcopy
from typing import Any


CATEGORIES = ("人像", "风景", "拍物")
ABILITIES = ("构图", "光线", "清晰度", "色彩")


# Twelve coach-written ability blueprints are expanded across the four long-term
# levels below. The result is a fixed library of 48 controllable task templates;
# AI is only used to select and personalize one of them.
ABILITY_BLUEPRINTS: dict[tuple[str, str], dict[str, Any]] = {
    ("人像", "构图"): {
        "title": "让人物更突出",
        "issue": "背景比人物更抢眼。",
        "goal": "让人物成为第一视觉中心。",
        "steps": ["人物离背景至少三步。", "靠近人物，保持半身构图。", "同一位置拍三张。"],
        "criteria": ["人物轮廓清楚", "背景不抢眼"],
        "challenge": "换一个更杂乱的背景再拍一次。",
    },
    ("人像", "光线"): {
        "title": "找到柔和面光",
        "issue": "脸部明暗不够舒服。",
        "goal": "让脸部明亮，并保留自然立体感。",
        "steps": ["让人物站在窗边一臂远。", "身体侧向窗户约四十五度。", "眼睛对焦后连拍三张。"],
        "criteria": ["脸部亮度自然", "眼下没有重阴影"],
        "challenge": "关掉室内顶灯，只用窗光再拍一次。",
    },
    ("人像", "清晰度"): {
        "title": "把眼睛拍清楚",
        "issue": "人物最重要的位置不够清楚。",
        "goal": "让离镜头更近的眼睛清晰。",
        "steps": ["擦净镜头并打开眼部对焦。", "双手稳定设备，轻点近侧眼睛。", "人物停住后连拍三张。"],
        "criteria": ["近侧眼睛清晰", "脸部没有手抖重影"],
        "challenge": "让人物慢慢走近，再完成一组。",
    },
    ("人像", "色彩"): {
        "title": "保留自然肤色",
        "issue": "环境颜色影响了肤色。",
        "goal": "让肤色自然，画面颜色更统一。",
        "steps": ["避开彩色灯和反光墙。", "选择同一种光照亮全脸。", "关闭滤镜拍三张。"],
        "criteria": ["肤色自然一致", "画面没有突兀偏色"],
        "challenge": "加入一种服装主色，再保持肤色自然。",
    },
    ("风景", "构图"): {
        "title": "理清画面层次",
        "issue": "景物很多，但缺少清楚的观看顺序。",
        "goal": "让画面有前景、中景和远景。",
        "steps": ["先找到一个明确远景。", "向两侧移动寻找前景。", "保持地平线水平拍三张。"],
        "criteria": ["地平线保持水平", "画面至少有两层空间"],
        "challenge": "加入一条引导线，让视线走向远景。",
    },
    ("风景", "光线"): {
        "title": "看见光的方向",
        "issue": "光线没有帮助景物形成层次。",
        "goal": "用侧光表现景物的明暗和纹理。",
        "steps": ["观察影子指向，确认光线方向。", "让光从画面侧面照来。", "保住最亮处细节拍三张。"],
        "criteria": ["亮部保留细节", "景物明暗层次清楚"],
        "challenge": "在日落前后各拍一张并比较。",
    },
    ("风景", "清晰度"): {
        "title": "稳住远近细节",
        "issue": "远景或前景细节不够稳定。",
        "goal": "让主要景物保持清晰。",
        "steps": ["擦净镜头并关闭数码变焦。", "对焦画面约三分之一处。", "靠墙或栏杆稳定后拍三张。"],
        "criteria": ["主要景物清晰", "画面没有手抖重影"],
        "challenge": "降低机位，在保留前景时再拍一次。",
    },
    ("风景", "色彩"): {
        "title": "统一风景颜色",
        "issue": "画面颜色很多，主色不明确。",
        "goal": "让一种颜色主导画面。",
        "steps": ["先说出场景里最想保留的颜色。", "移动机位排除无关杂色。", "固定白平衡拍三张。"],
        "criteria": ["主色一眼可见", "没有明显突兀杂色"],
        "challenge": "再加入一种互补色作为小面积点缀。",
    },
    ("拍物", "构图"): {
        "title": "排出清楚主次",
        "issue": "物品之间缺少明确主次。",
        "goal": "让主物品最先被看见。",
        "steps": ["先只放一个主物品。", "其他物品与它错开半个位置。", "保持边缘完整拍三张。"],
        "criteria": ["主物品最突出", "物品边缘不重叠"],
        "challenge": "增加到三件物品，仍保持同样主次。",
    },
    ("拍物", "光线"): {
        "title": "用侧光显质感",
        "issue": "物品看起来偏平，材质不明显。",
        "goal": "用侧面光表现形状和纹理。",
        "steps": ["把物品放到窗边。", "关闭顶灯，让光从侧面照来。", "转动物品找到质感最强的位置。"],
        "criteria": ["表面纹理可见", "亮部没有发白"],
        "challenge": "用白纸补亮暗面，再拍一张。",
    },
    ("拍物", "清晰度"): {
        "title": "拍清关键细节",
        "issue": "物品最重要的细节不够清楚。",
        "goal": "让关键文字或纹理稳定清晰。",
        "steps": ["擦净镜头并找到关键细节。", "轻点细节完成对焦。", "设备固定后用两秒倒计时拍摄。"],
        "criteria": ["关键细节清晰", "物品边缘没有重影"],
        "challenge": "靠近一步，再稳定拍清同一处细节。",
    },
    ("拍物", "色彩"): {
        "title": "控制物品配色",
        "issue": "背景颜色干扰了物品本身。",
        "goal": "让背景颜色衬托主物品。",
        "steps": ["选一张纯色纸作为背景。", "保留主物品和一种辅助色。", "关闭滤镜并固定白平衡拍三张。"],
        "criteria": ["物品颜色准确", "背景颜色不抢眼"],
        "challenge": "更换一张对比色背景，再保持主物品突出。",
    },
}


LEVEL_SPECS: dict[int, dict[str, Any]] = {
    1: {"name": "观察", "time": 10, "prefix": "先在简单环境里", "challenge": "只改变一个变量。"},
    2: {"name": "控制", "time": 20, "prefix": "主动安排位置后", "challenge": "换一个场景稳定完成。"},
    3: {"name": "应变", "time": 20, "prefix": "在较复杂的现场", "challenge": "加入复杂光线或时间限制。"},
    4: {"name": "表达", "time": 40, "prefix": "围绕同一表达", "challenge": "完成三张风格一致的组图。"},
}

CYCLE_LABELS = {1: "看见问题", 2: "稳定做到", 3: "增加限制", 4: "重拍原图"}


def _build_library() -> dict[tuple[str, str, int], dict[str, Any]]:
    library: dict[tuple[str, str, int], dict[str, Any]] = {}
    for (category, ability), blueprint in ABILITY_BLUEPRINTS.items():
        for level, level_spec in LEVEL_SPECS.items():
            task = deepcopy(blueprint)
            task.update(
                {
                    "category": category,
                    "ability": ability,
                    "level": level,
                    "level_name": level_spec["name"],
                    "time_minutes": level_spec["time"],
                    "goal": f"{level_spec['prefix']}，{str(task['goal']).rstrip('。')}。",
                    "challenge": f"{task['challenge']} {level_spec['challenge']}",
                }
            )
            library[(category, ability, level)] = task
    return library


TASK_LIBRARY = _build_library()


def get_task(category: str, ability: str, level: int, cycle_week: int) -> dict[str, Any]:
    safe_category = category if category in CATEGORIES else "人像"
    safe_ability = ability if ability in ABILITIES else "构图"
    safe_level = max(1, min(4, int(level or 1)))
    safe_cycle = max(1, min(4, int(cycle_week or 1)))
    task = deepcopy(TASK_LIBRARY[(safe_category, safe_ability, safe_level)])
    task["cycle_week"] = safe_cycle
    task["cycle_label"] = CYCLE_LABELS[safe_cycle]
    if safe_cycle == 2:
        task["steps"][2] = "换一个场景，按同样方法拍三张。"
    elif safe_cycle == 3:
        task["steps"][2] = "限时十分钟，按同样方法拍三张。"
    elif safe_cycle == 4:
        task["steps"][2] = "参考最初照片，完成一张重拍。"
    return task


def simplified_task(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": f"{task['title']}·简化版",
        "time_minutes": 10,
        "steps": list(task["steps"][:2]) + ["只选最满意的一张提交。"],
    }
