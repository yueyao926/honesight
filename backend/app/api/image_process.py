from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User
from app.services.image_generator import ImageGenerationError, generate_edited_image


router = APIRouter(prefix="/image-process", tags=["image-process"])


class ImageProcessRequest(BaseModel):
    image_url: str = Field(max_length=600)
    target_style: str = Field(min_length=1, max_length=80)
    edit_instruction: str | None = Field(default=None, max_length=600)
    reference_image_urls: list[str] = Field(default_factory=list, max_length=3)


class ImageProcessResponse(BaseModel):
    image_url: str
    model: str
    prompt: str


@router.post("/generate", response_model=ImageProcessResponse)
def process_image(
    payload: ImageProcessRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    try:
        return generate_edited_image(
            image_url=payload.image_url,
            user_id=current_user.id,
            target_style=payload.target_style,
            edit_instruction=payload.edit_instruction,
            reference_image_urls=payload.reference_image_urls,
        )
    except ImageGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
