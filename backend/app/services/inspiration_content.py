import hashlib
from dataclasses import dataclass
from datetime import date

from app.models.inspiration import InspirationPhoto
from app.services.photo_providers import ProviderPhoto


GENERIC_CAPTION = "光线经过的地方，日常也有了新的轮廓。"
GENERIC_SUMMARY = "从主体与环境的关系进入画面，感受摄影师如何组织观看。"


@dataclass(frozen=True)
class InspirationContent:
    poetic_caption: str
    appreciation_summary: str


CATEGORY_KEYWORDS = {
    "portrait": ("portrait", "people", "person", "woman", "man", "girl", "boy", "人像", "人物"),
    "landscape": ("landscape", "mountain", "ocean", "forest", "nature", "lake", "风景", "自然"),
    "street": ("street", "city", "urban", "road", "街拍", "城市", "街道"),
    "architecture": ("architecture", "building", "interior", "house", "建筑", "室内"),
    "still_life": ("still life", "food", "flower", "object", "product", "静物", "花", "食物"),
    "night": ("night", "neon", "dark", "moon", "star", "夜景", "夜晚", "霓虹"),
    "animals": ("animal", "animals", "dog", "cat", "bird", "wildlife", "动物", "猫", "狗", "鸟"),
}


CONTENT = {
    "portrait": {
        "captions": ["目光停驻的一刻，人物与世界交换了安静的秘密。", "一束光落在脸上，也照见了未说出口的情绪。", "镜头靠近人物，时间便慢成了一次呼吸。"],
        "summaries": ["观察人物目光、姿态与背景留白如何共同建立情绪。", "留意面部受光与环境色之间的关系，学习突出人物而不割裂空间。", "从人物位置与视线方向入手，理解人像画面的叙事张力。"],
    },
    "landscape": {
        "captions": ["山川不言，远近的层次替风景写下了回声。", "天地铺展开来，光影把辽阔轻轻分成几层。", "远方留在画面里，也留下一条通往想象的路。"],
        "summaries": ["观察前景、中景与远景如何形成纵深，并留意天气对层次的影响。", "从地平线位置和明暗分区学习组织辽阔场景。", "感受自然光如何勾勒地貌，让尺度与空间在画面中成立。"],
    },
    "street": {
        "captions": ["街角的一瞬，被光线从匆忙里轻轻取出。", "城市继续向前，镜头替偶然留下了证据。", "人群与街道交错，日常忽然有了电影的节奏。"],
        "summaries": ["留意人物、道路和建筑线条如何在瞬间形成秩序。", "观察决定性瞬间中主体动作与环境信息的平衡。", "从街道的光影分区学习预判人物进入画面的时机。"],
    },
    "architecture": {
        "captions": ["墙面接住斜阳，几何也有了温度。", "线条向远处延伸，空间在秩序里慢慢呼吸。", "建筑沉默地站着，光替它说出了时间。"],
        "summaries": ["观察垂直线、透视与框架如何强调建筑的结构感。", "留意光线在立面上的明暗切割，学习用阴影表现体积。", "从重复图案和几何关系中寻找稳定而克制的构图。"],
    },
    "still_life": {
        "captions": ["寻常物件被认真观看，也会显露自己的诗意。", "静物没有声音，色彩与质地却在彼此交谈。", "一桌一物之间，光把细节擦得明亮。"],
        "summaries": ["观察物体之间的间距、质感和色彩呼应。", "留意侧光如何表现表面纹理，并用留白控制画面节奏。", "从主次关系和背景简化中学习让普通物件成为视觉中心。"],
    },
    "night": {
        "captions": ["夜色压低声音，灯光把故事留在街上。", "黑暗并非空白，每一盏灯都在标记方向。", "城市进入蓝调时刻，冷暖光线开始彼此回应。"],
        "summaries": ["比较高光与暗部细节，学习控制夜景的曝光层次。", "观察冷暖人工光源如何共同建立夜晚氛围。", "留意黑色空间的比例，让灯光成为清晰的视觉引导。"],
    },
    "animals": {
        "captions": ["生命望向镜头的一刻，野性与温柔同时停驻。", "它从自然里经过，镜头只轻轻留下相遇。", "羽毛与目光之间，藏着另一种观看世界的方式。"],
        "summaries": ["观察动物眼神、动作方向与环境空间之间的联系。", "留意快门时机和背景简化，学习突出生命姿态。", "从视线高度与焦点位置理解动物摄影的亲近感。"],
    },
    "general": {
        "captions": ["平凡的一刻被认真看见，便有了新的意义。", "画面把时间留住，也把观看变成了一次相遇。", "光与影彼此靠近，日常因此显露出安静的秩序。"],
        "summaries": ["从主体、光线和留白的关系入手，寻找画面的视觉重心。", "观察色彩与明暗如何共同引导视线，并建立情绪。", "留意画面中重复、对比与节奏，让观看变得更有方向。"],
    },
}


def detect_category(text: str) -> str:
    normalized = text.lower()
    scores = {category: sum(keyword in normalized for keyword in keywords) for category, keywords in CATEGORY_KEYWORDS.items()}
    category, score = max(scores.items(), key=lambda item: item[1])
    return category if score else "general"


def stable_index(seed: str, size: int) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16) % size


def build_content(photo: ProviderPhoto | InspirationPhoto) -> InspirationContent:
    searchable = " ".join(filter(None, [photo.title, photo.description or "", photo.tags]))
    category = detect_category(searchable)
    content = CONTENT[category]
    seed = f"{photo.source_type}:{photo.external_id or photo.title}"
    return InspirationContent(
        poetic_caption=content["captions"][stable_index(seed + ":caption", len(content["captions"]))],
        appreciation_summary=content["summaries"][stable_index(seed + ":summary", len(content["summaries"]))],
    )


def build_recommendation_reason(photo: InspirationPhoto, recommendation_date: date, personalized: bool) -> str:
    searchable = " ".join(filter(None, [photo.title, photo.description or "", photo.tags]))
    category = detect_category(searchable)
    labels = {
        "portrait": "观察人物情绪与环境留白",
        "landscape": "学习风景中的空间层次与尺度",
        "street": "捕捉街头秩序与决定性瞬间",
        "architecture": "观察建筑线条、透视与光影结构",
        "still_life": "学习静物的质感、色彩与留白",
        "night": "体会夜色中冷暖光线的层次",
        "animals": "观察生命姿态与环境之间的联系",
        "general": "从主体、光线与色彩中寻找新的观看方式",
    }
    prefixes = ["今日练习", "今日观察", "今日灵感", "镜头提示"]
    prefix = prefixes[stable_index(f"{photo.id}:{recommendation_date.isoformat()}", len(prefixes))]
    suffix = "，与你的摄影偏好相呼应" if personalized else ""
    return f"{prefix}：{labels[category]}{suffix}"
