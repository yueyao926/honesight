import json

from app.models.portfolio import PortfolioItem
from app.models.preference import Preference


def build_analysis_report(item: PortfolioItem, preference: Preference | None) -> dict[str, str]:
    style = (item.target_style or (preference.preferred_styles if preference else None) or "清新自然").strip()
    platform = (item.target_platform or (preference.target_platform if preference else None) or "作品集").strip()

    editing_params = {
        "exposure": "+0.2",
        "contrast": "-8",
        "highlights": "-18",
        "shadows": "+16",
        "temperature": "0",
        "saturation": "+4",
    }
    summary = f"这张作品适合向“{style}”方向统一表达，发布到“{platform}”时建议突出主体、控制背景干扰，并让画面信息更集中。"
    composition = "建议把主体放在画面中心或三分线附近，裁掉边缘弱信息，让第一眼视觉重点更明确。"
    lighting = "建议优先使用柔和自然光，保留主体亮部层次，同时避免阴影区域过重。"
    color = "建议保持色彩统一，减少杂色干扰，让目标风格更稳定。"

    if "清新自然" in style or "日系" in style:
        editing_params.update(
            {
                "exposure": "+0.3",
                "contrast": "-12",
                "highlights": "-20",
                "shadows": "+20",
                "temperature": "-2",
                "saturation": "-2",
            }
        )
        lighting = "清新或日系方向适合略微提亮、降低对比，并用柔和光线保留干净肤色和空气感。"
        color = "色彩建议降低杂色饱和度，让绿色、蓝色更轻，整体不要过度浓艳。"
    elif "胶片感" in style or "复古" in style:
        editing_params.update(
            {
                "exposure": "+0.1",
                "contrast": "+6",
                "highlights": "-24",
                "shadows": "+12",
                "temperature": "+6",
                "grain": "+12",
            }
        )
        lighting = "胶片或复古方向可以保留一点暖色高光，并让暗部有层次，不要把阴影压死。"
        color = "色彩建议偏暖、略降清晰度，加少量颗粒强化氛围。"
    elif "高级灰" in style:
        editing_params.update(
            {
                "exposure": "+0.1",
                "contrast": "+8",
                "highlights": "-22",
                "shadows": "+6",
                "saturation": "-18",
            }
        )
        composition = "高级灰风格更依赖留白和秩序感，建议减少画面元素，让主体和空间关系更克制。"
        color = "色彩建议低饱和、保留黑白灰层次，避免局部颜色过艳。"

    if platform == "小红书":
        summary += " 作为小红书内容，封面感和生活方式表达很重要。"
        composition = "建议按封面思路处理构图：主体更突出，背景更干净，标题或文字区域预留留白。"
    elif platform == "作品集":
        summary += " 作为作品集内容，需要更强调系列感、一致性和视觉表达。"
        composition = "建议统一裁切比例和主体距离，让这张照片能和其他作品形成稳定系列。"

    if preference and preference.improvement_goals:
        summary += f" 结合你的提升目标（{preference.improvement_goals}），本次建议优先关注构图、光线和调色的可执行动作。"

    return {
        "summary": summary,
        "composition_advice": composition,
        "lighting_advice": lighting,
        "color_advice": color,
        "editing_params": json.dumps(editing_params, ensure_ascii=False),
        "model_used": "template-v1",
    }
