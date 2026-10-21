from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SLAPolicyResponse(BaseModel):
    id: int
    priority: str
    response_time: int
    resolve_time: int
    is_active: bool

    class Config:
        from_attributes = True

class SLAPolicyCreate(BaseModel):
    priority:      str
    response_time: int
    resolve_time:  int
    is_active:     bool = True

class SLAPolicyUpdate(BaseModel):
    response_time: Optional[int] = None
    resolve_time:  Optional[int] = None
    is_active:     Optional[bool] = None

class SLAInstanceResponse(BaseModel):
    id: int
    ticket_id: int
    due_response_at:  Optional[datetime] = None
    due_resolve_at:   Optional[datetime] = None
    breached_response: bool
    breached_resolve:  bool
    risk_score:        int
    ml_risk_score:     Optional[int] = None

    class Config:
        from_attributes = True