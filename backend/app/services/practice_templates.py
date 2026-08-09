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
        "steps": [
            "请人物向前走，和身后的墙面、树木或杂物拉开至少三大步，让背景自然变得简洁。",
            "你再向人物靠近一些，把画面取到腰部或胸部以上，并留意头顶不要空出太多位置。",
            "保持人物和机位不动，连续拍三张；每张都先看一眼画面边缘，确认没有多余的人或物进入。",
        ],
        "criteria": ["人物轮廓清楚", "背景不抢眼"],
        "challenge": "换一个更杂乱的背景再拍一次。",
    },
    ("人像", "光线"): {
        "title": "找到柔和面光",
        "issue": "脸部明暗不够舒服。",
        "goal": "让脸部明亮，并保留自然立体感。",
        "steps": [
            "请人物站在窗边约一臂远的位置，不要紧贴窗户，也不要让阳光直接照在脸上。",
            "让人物的身体和脸稍微转向窗户，大约四十五度，直到两边脸颊呈现柔和的明暗变化。",
            "轻点靠近镜头的眼睛完成对焦，稳住手机或相机后连拍三张，再检查脸部是否自然明亮。",
        ],
        "criteria": ["脸部亮度自然", "眼下没有重阴影"],
        "challenge": "关掉室内顶灯，只用窗光再拍一次。",
    },
    ("人像", "清晰度"): {
        "title": "把眼睛拍清楚",
        "issue": "人物最重要的位置不够清楚。",
        "goal": "让离镜头更近的眼睛清晰。",
        "steps": [
            "先用干净软布擦一下镜头；如果设备支持人眼对焦，请在拍摄设置中打开。",
            "双手握稳设备，手肘贴近身体，再轻点屏幕上离镜头更近的那只眼睛进行对焦。",
            "请人物暂时停住，等对焦框落在眼睛上再连拍三张，拍完放大检查睫毛和眼神是否清楚。",
        ],
        "criteria": ["近侧眼睛清晰", "脸部没有手抖重影"],
        "challenge": "让人物慢慢走近，再完成一组。",
    },
    ("人像", "色彩"): {
        "title": "保留自然肤色",
        "issue": "环境颜色影响了肤色。",
        "goal": "让肤色自然，画面颜色更统一。",
        "steps": [
            "先避开彩色灯牌、彩色窗帘和鲜艳墙面的反光，找一处颜色简单的拍摄位置。",
            "让整张脸只由同一种光照亮，例如只用窗光，避免一边偏黄、一边偏蓝。",
            "关闭美颜和滤镜，用默认色彩连续拍三张，再对照本人肤色选择最自然的一张。",
        ],
        "criteria": ["肤色自然一致", "画面没有突兀偏色"],
        "challenge": "加入一种服装主色，再保持肤色自然。",
    },
    ("风景", "构图"): {
        "title": "理清画面层次",
        "issue": "景物很多，但缺少清楚的观看顺序。",
        "goal": "让画面有前景、中景和远景。",
        "steps": [
            "先确定远处最想表现的主体，例如山峰、建筑或落日，并把它放在画面里清楚可见的位置。",
            "不要急着按快门，向左或向右走几步，寻找树枝、道路、石头等能放在画面下方的前景。",
            "打开网格线，让地平线贴近横向参考线；机位稳定后拍三张，分别比较画面的空间层次。",
        ],
        "criteria": ["地平线保持水平", "画面至少有两层空间"],
        "challenge": "加入一条引导线，让视线走向远景。",
    },
    ("风景", "光线"): {
        "title": "看见光的方向",
        "issue": "光线没有帮助景物形成层次。",
        "goal": "用侧光表现景物的明暗和纹理。",
        "steps": [
            "先看地面或建筑上的影子朝哪边延伸，影子的反方向就是光线照来的方向。",
            "向左右移动机位，让阳光从画面侧面照向景物，而不是正对镜头或从你身后直照过去。",
            "轻点画面最亮的位置测光，适当调暗到高光纹理可见，再稳住设备拍三张进行比较。",
        ],
        "criteria": ["亮部保留细节", "景物明暗层次清楚"],
        "challenge": "在日落前后各拍一张并比较。",
    },
    ("风景", "清晰度"): {
        "title": "稳住远近细节",
        "issue": "远景或前景细节不够稳定。",
        "goal": "让主要景物保持清晰。",
        "steps": [
            "先擦净镜头，并退回设备的原生焦段；尽量不要双指放大，避免数码变焦损失细节。",
            "在画面中从近到远约三分之一的位置轻点对焦，例如道路中段或前方的一排树。",
            "把手臂或设备靠在墙面、栏杆等稳固处，屏住呼吸轻按快门，连续拍三张后放大检查。",
        ],
        "criteria": ["主要景物清晰", "画面没有手抖重影"],
        "challenge": "降低机位，在保留前景时再拍一次。",
    },
    ("风景", "色彩"): {
        "title": "统一风景颜色",
        "issue": "画面颜色很多，主色不明确。",
        "goal": "让一种颜色主导画面。",
        "steps": [
            "先观察现场，并说出最想保留的一种主色，例如天空蓝、草地绿或落日橙。",
            "向前后左右移动机位，把与主色无关的招牌、车辆或鲜艳杂物移出画面边缘。",
            "相机可固定白平衡，手机则关闭滤镜；在同一光线下拍三张，选择主色最明确的一张。",
        ],
        "criteria": ["主色一眼可见", "没有明显突兀杂色"],
        "challenge": "再加入一种互补色作为小面积点缀。",
    },
    ("拍物", "构图"): {
        "title": "排出清楚主次",
        "issue": "物品之间缺少明确主次。",
        "goal": "让主物品最先被看见。",
        "steps": [
            "先把桌面清空，只放最想表现的主物品，并确定它最有特点的一面朝向镜头。",
            "再放入辅助物品，让它们比主物品更靠后或更靠边，并彼此错开，避免轮廓完全重叠。",
            "检查每件物品的边缘都完整、画面四周有呼吸空间，然后保持机位不动拍三张微调版本。",
        ],
        "criteria": ["主物品最突出", "物品边缘不重叠"],
        "challenge": "增加到三件物品，仍保持同样主次。",
    },
    ("拍物", "光线"): {
        "title": "用侧光显质感",
        "issue": "物品看起来偏平，材质不明显。",
        "goal": "用侧面光表现形状和纹理。",
        "steps": [
            "把物品放在离窗户约半米的位置，选择有窗帘或没有阳光直射的柔和窗光。",
            "关掉室内顶灯，让窗户位于物品的左侧或右侧，这样表面会出现自然的明暗过渡。",
            "每次小幅转动物品，观察纹理和轮廓何时最清楚；找到合适角度后稳住设备拍三张。",
        ],
        "criteria": ["表面纹理可见", "亮部没有发白"],
        "challenge": "用白纸补亮暗面，再拍一张。",
    },
    ("拍物", "清晰度"): {
        "title": "拍清关键细节",
        "issue": "物品最重要的细节不够清楚。",
        "goal": "让关键文字或纹理稳定清晰。",
        "steps": [
            "先擦净镜头，再选定唯一的关键细节，例如标签文字、材质纹理或产品标志。",
            "把设备移到能清楚看见细节、又不会贴得无法对焦的距离，然后轻点该位置完成对焦。",
            "将设备靠稳或放上支架，开启两秒倒计时再拍摄；拍完放大检查文字边缘或纹理是否清楚。",
        ],
        "criteria": ["关键细节清晰", "物品边缘没有重影"],
        "challenge": "靠近一步，再稳定拍清同一处细节。",
    },
    ("拍物", "色彩"): {
        "title": "控制物品配色",
        "issue": "背景颜色干扰了物品本身。",
        "goal": "让背景颜色衬托主物品。",
        "steps": [
            "为主物品选一张纯色纸或纯色布做背景，优先选择与物品颜色差异明显、但不过分鲜艳的颜色。",
            "画面里只保留主物品和一种辅助色，把包装、桌面杂物和其他抢眼颜色全部移开。",
            "关闭滤镜；相机可固定白平衡，手机保持同一光线，连续拍三张并比较哪张颜色最接近实物。",
        ],
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
        task["steps"][2] = "换到一个与上周不同的场景，完整重复前两个动作并拍三张，看看自己能否稳定得到相同效果。"
    elif safe_cycle == 3:
        task["steps"][2] = "给自己十分钟，从准备到拍摄都按前两个动作完成；拍三张后只保留最符合完成标准的一张。"
    elif safe_cycle == 4:
        task["steps"][2] = "打开最初上传的照片作参考，在相近主体或场景中重新拍一张，完成后并排比较本周重点的变化。"
    return task


def simplified_task(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": f"{task['title']}·简化版",
        "time_minutes": 10,
        "steps": list(task["steps"][:2]) + ["完成后放大查看照片，只选择最符合本周完成标准的一张提交。"],
    }
