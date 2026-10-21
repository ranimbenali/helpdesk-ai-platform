from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AppConfigResponse(BaseModel):
    id: int
    app_name: str
    app_language: str
    geiser_base_url: Optional[str] = None
    geiser_token: Optional[str] = None
    ai_enabled: bool
    ai_confidence_threshold: float
    ai_auto_assign: bool
    updated_at: datetime

    class Config:
        from_attributes = True

class AppConfigUpdate(BaseModel):
    app_name: Optional[str] = None
    app_language: Optional[str] = None
    geiser_base_url: Optional[str] = None
    geiser_token: Optional[str] = None
    ai_enabled: Optional[bool] = None
    ai_confidence_threshold: Optional[float] = None
    ai_auto_assign: Optional[bool] = None