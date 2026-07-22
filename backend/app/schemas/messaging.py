from pydantic import BaseModel, Field, model_validator

class ConversationCreate(BaseModel): target_user_id: int

class MessageCreate(BaseModel):
    message_type: str = "text"
    content: str | None = Field(None, max_length=2000)
    image_url: str | None = Field(None, max_length=500)
    shared_post_id: int | None = None
    reply_to_message_id: int | None = None
    @model_validator(mode="after")
    def valid_content(self):
        if self.message_type not in {"text", "image", "post_share"}: raise ValueError("不支持的消息类型")
        if self.message_type == "text" and not (self.content or "").strip(): raise ValueError("消息不能为空")
        if self.message_type == "image" and not self.image_url: raise ValueError("图片消息缺少图片")
        if self.message_type == "post_share" and not self.shared_post_id: raise ValueError("分享消息缺少帖子")
        return self

class ConversationSettings(BaseModel):
    is_muted: bool | None = None; is_archived: bool | None = None; is_deleted_for_user: bool | None = None

class MessageReportCreate(BaseModel):
    reason: str = Field(max_length=32); description: str | None = Field(None, max_length=1000)
