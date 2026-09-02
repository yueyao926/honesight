import hashlib
import re
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
        "captions": ["人物与环境彼此映照，画面保留了相遇的温度。", "光线靠近主体，日常的一刻因此被认真看见。", "镜头与人物保持距离，也为情绪留下了空间。", "姿态停在画面里，周围的细节继续讲述故事。", "人物置身场景之中，瞬间有了安静的叙事。", "环境围绕主体展开，目光自然找到停留之处。", "一个寻常动作被留下，时间仿佛慢了半拍。", "人物与背景形成呼应，画面显得真实而克制。"],
        "summaries": ["观察人物位置、姿态与背景留白如何共同建立视觉重心。", "留意主体和环境的明暗差异，以及空间信息是否保持完整。", "从人物所处的位置入手，理解环境如何补充画面的叙事。", "观察背景线条与色块是否将视线引向主体。", "留意人物动作方向和画面空间之间的平衡。", "比较主体与周围元素的尺度关系，感受距离带来的情绪变化。", "观察人物轮廓是否从背景中清晰分离，同时保留现场感。", "从取景范围与留白比例入手，学习控制人物在画面中的分量。"],
    },
    "landscape": {
        "captions": ["远近在画面中铺开，风景留下缓慢的回声。", "天地延伸向远方，光影轻轻划分空间。", "自然保持沉默，层次却让视线不断前行。", "景物沿着空间展开，远方成为画面的呼吸。", "光落在大地上，辽阔有了清晰的节奏。", "眼前与远处彼此连接，风景因此拥有深度。", "天气改变了颜色，也改变了观看的速度。", "画面收住一段风景，把空间留给想象。"],
        "summaries": ["观察前景、中景与远景如何形成纵深，并留意天气对层次的影响。", "从地平线位置和明暗分区学习组织开阔场景。", "留意景物尺度和遮挡关系如何传达空间距离。", "观察光线变化如何区分不同层次，并引导视线深入画面。", "比较天空与地面的比例，理解留白对风景节奏的影响。", "从色彩远近和清晰度变化中感受空气透视。", "留意前景元素是否为远处景物提供尺度参照。", "观察画面中的路径、河流或轮廓线如何建立视觉方向。"],
    },
    "street": {
        "captions": ["街道继续向前，镜头留下偶然形成的秩序。", "城市的一瞬被定格，日常显露出自己的节奏。", "建筑、车辆与行人交错，现场感停在画面里。", "街角的颜色彼此相遇，平常场景有了新的关系。", "城市没有停下，照片却替这一刻保留了证据。", "道路与立面构成舞台，偶然成为画面的主角。", "视线穿过街景，在层层细节之间找到落点。", "喧闹被收进取景框，画面重新安排了日常。"],
        "summaries": ["留意道路、建筑和现场元素如何在瞬间形成秩序。", "观察画面中主体与环境信息的平衡，避免杂乱削弱重心。", "从街道的线条和色块入手，寻找引导视线的结构。", "留意前后景遮挡如何增强现场感与空间层次。", "观察重复元素和偶然变化之间形成的节奏。", "比较静止背景与动态元素在画面中的分量。", "从取景边界入手，判断哪些环境细节有助于叙事。", "留意明暗区域如何切分街景，并突出视觉落点。"],
    },
    "architecture": {
        "captions": ["线条向远处延伸，空间在秩序里慢慢展开。", "建筑保持沉默，光影替它标记时间。", "立面收住光线，几何结构显出清晰的节奏。", "空间由线条搭起，也被阴影重新分割。", "重复的形状铺陈开来，秩序成为画面的语言。", "墙面与开口彼此呼应，建筑显露克制的表情。", "透视把视线带向深处，结构因此变得可见。", "材质承接环境的光，空间有了细微的温度。"],
        "summaries": ["观察垂直线、透视与框架如何强调建筑的结构感。", "留意光线在立面上的明暗切割，理解阴影如何表现体积。", "从重复图案和几何关系中寻找稳定的构图。", "观察门窗、墙面和边缘线如何建立视觉节奏。", "留意拍摄角度对透视变形与空间尺度的影响。", "比较建筑材质在不同受光区域呈现的质感变化。", "观察大面积色块与细小结构之间的比例关系。", "从画面边界是否平稳入手，理解建筑摄影中的秩序控制。"],
    },
    "still_life": {
        "captions": ["寻常物件被认真观看，也显露出自己的诗意。", "物件安静地排列，色彩与质地彼此交谈。", "光停在细节上，日常事物有了新的分量。", "一组形状相互陪伴，画面保持简单而完整。", "静止的物件收住时间，也收住一束光。", "细节被放到眼前，熟悉的事物重新变得陌生。", "颜色在物件之间传递，构成温和的节奏。", "背景退到安静处，主体的质感慢慢浮现。"],
        "summaries": ["观察物体之间的间距、质感和色彩呼应。", "留意侧光如何表现表面纹理，并用留白控制画面节奏。", "从主次关系和背景简化中学习建立清晰的视觉中心。", "比较不同形状、大小与方向之间的平衡。", "观察高光与阴影如何共同表现物体的体积。", "留意背景颜色是否衬托主体，同时避免不必要的干扰。", "从摆放密度和画面边界入手，理解静物构图的节奏。", "观察相近色与对比色如何改变物件之间的关系。"],
    },
    "night": {
        "captions": ["夜色压低声音，灯光在画面中标记方向。", "黑暗并非空白，微小的亮处组织着视线。", "城市进入夜晚，冷暖颜色开始彼此回应。", "灯影落在暗处，空间显得安静而深远。", "夜色收起多余细节，让光成为清晰的线索。", "明亮与幽暗相互衬托，画面保留夜的层次。", "有限的光照亮局部，也为未知留下空间。", "颜色从黑暗中浮现，夜晚显出缓慢的节奏。"],
        "summaries": ["比较高光与暗部细节，学习控制夜景的曝光层次。", "观察冷暖人工光源如何共同建立夜晚氛围。", "留意黑色空间的比例，让灯光成为清晰的视觉引导。", "观察亮点的分布是否建立稳定的画面节奏。", "从局部照明与环境暗部的关系理解夜景空间。", "比较不同色温光源在同一场景中的色彩变化。", "留意最亮区域是否与真正的视觉重心一致。", "观察反光、阴影和轮廓如何在低照度中补充细节。"],
    },
    "animals": {
        "captions": ["生命停在画面的一刻，环境也参与了这次相遇。", "它从场景中经过，镜头轻轻留下姿态。", "动作与周围空间相互呼应，瞬间显得自然。", "一段生命的日常，被镜头认真地保存下来。", "主体与环境保持联系，画面因此更有呼吸。", "短暂的停留成为故事，细节让相遇更加真实。", "自然的姿态落进取景框，时间随之慢了一拍。", "环境围绕生命展开，视线找到温柔的落点。"],
        "summaries": ["观察动物姿态、动作方向与环境空间之间的联系。", "留意快门时机和背景简化，学习突出主体形态。", "从视线高度与焦点位置理解动物摄影的亲近感。", "观察主体轮廓与背景色彩是否具有足够区分度。", "留意动作前方保留的空间，以及它对方向感的影响。", "比较环境信息与主体大小，判断画面更强调栖息地还是个体。", "观察光线如何表现毛发、羽毛或轮廓的质感。", "从取景距离入手，在现场感与主体细节之间寻找平衡。"],
    },
    "general": {
        "captions": ["平凡的一刻被认真看见，便有了新的意义。", "画面把时间留住，也把观看变成一次相遇。", "光与影彼此靠近，日常显露出安静的秩序。", "颜色与形状相互回应，视线在其中找到停留之处。", "一段现场被轻轻截取，细节仍在继续说话。", "熟悉的景象换了角度，也带来新的观看方式。", "画面收住片刻，让光线、空间与细节慢慢展开。", "无需预设故事，眼前的关系已经形成节奏。", "视线沿着明暗移动，在画面中发现细微的联系。", "被留下的不只是景物，还有观看发生的那一刻。"],
        "summaries": ["从主体、光线和留白的关系入手，寻找画面的视觉重心。", "观察色彩与明暗如何共同引导视线，并建立整体氛围。", "留意画面中重复、对比与节奏，让观看更有方向。", "从前后景的遮挡与大小变化判断空间层次。", "观察最亮、最清晰或对比最强的位置是否形成视觉中心。", "比较画面边缘与中心的信息密度，理解取景的取舍。", "留意线条、形状和色块之间如何建立秩序。", "观察环境细节是否支持主体，同时保持画面简洁。", "从横竖方向与空间比例入手，感受构图带来的观看速度。", "先描述画面中确实可见的关系，再思考它带来的情绪。"],
    },
}


FIELD_WEIGHTS = {"title": 2.0, "description": 1.5, "tags": 3.0}
MIN_CATEGORY_SCORE = 3.0
MIN_LEAD_SCORE = 1.5


def _contains_keyword(text: str, keyword: str) -> bool:
    normalized = text.casefold()
    keyword = keyword.casefold()
    if re.fullmatch(r"[a-z0-9 ]+", keyword):
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", normalized))
    return keyword in normalized


def _category_scores(title: str = "", description: str = "", tags: str = "") -> dict[str, float]:
    fields = {"title": title, "description": description, "tags": tags}
    return {
        category: sum(
            FIELD_WEIGHTS[field]
            for field, text in fields.items()
            for keyword in keywords
            if _contains_keyword(text, keyword)
        )
        for category, keywords in CATEGORY_KEYWORDS.items()
    }


def _winner_or_general(scores: dict[str, float]) -> str:
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    winner, score = ranked[0]
    runner_up = ranked[1][1]
    return winner if score >= MIN_CATEGORY_SCORE and score - runner_up >= MIN_LEAD_SCORE else "general"


def detect_category(text: str) -> str:
    """Classify unstructured text conservatively; retained for callers and tests."""
    return _winner_or_general(_category_scores(title=text))


def detect_photo_category(photo: ProviderPhoto | InspirationPhoto) -> str:
    """Use fields independently so a lone, ambiguous hint cannot force specific copy."""
    return _winner_or_general(_category_scores(photo.title or "", photo.description or "", photo.tags or ""))


def stable_index(seed: str, size: int) -> int:
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16) % size


def build_content(photo: ProviderPhoto | InspirationPhoto) -> InspirationContent:
    category = detect_photo_category(photo)
    content = CONTENT[category]
    seed = f"{photo.source_type}:{photo.external_id or photo.title}"
    return InspirationContent(
        poetic_caption=content["captions"][stable_index(seed + ":caption", len(content["captions"]))],
        appreciation_summary=content["summaries"][stable_index(seed + ":summary", len(content["summaries"]))],
    )


def build_recommendation_reason(photo: InspirationPhoto, recommendation_date: date, personalized: bool) -> str:
    category = detect_photo_category(photo)
    labels = {
        "portrait": "观察人物与环境在画面中的关系",
        "landscape": "学习风景中的空间层次与尺度",
        "street": "观察街头元素形成的秩序与节奏",
        "architecture": "观察建筑线条、透视与光影结构",
        "still_life": "学习静物的质感、色彩与留白",
        "night": "体会夜色中明暗与冷暖光线的层次",
        "animals": "观察生命姿态与环境之间的联系",
        "general": "从主体、光线与色彩中寻找新的观看方式",
    }
    prefixes = ["今日练习", "今日观察", "今日灵感", "镜头提示"]
    prefix = prefixes[stable_index(f"{photo.id}:{recommendation_date.isoformat()}", len(prefixes))]
    suffix = "，与你的摄影偏好相呼应" if personalized else ""
    return f"{prefix}：{labels[category]}{suffix}"
