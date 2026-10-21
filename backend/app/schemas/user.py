from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "REQUESTER"
    status: str = "ACTIVE"
    fonction: Optional[str] = None
    specialites: Optional[List[str]] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    fonction: Optional[str] = None
    specialites: Optional[List[str]] = None


class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    status: str
    created_at: datetime
    avatar_url: Optional[str] = None
    fonction: Optional[str] = None
    specialites: Optional[List[str]] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        import json
        data = super().model_validate(obj, **kwargs)
        if isinstance(data.specialites, str):
            try:
                data.specialites = json.loads(data.specialites)
            except Exception:
                data.specialites = []
        return data


class UserList(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    status: str
    created_at: datetime
    fonction: Optional[str] = None
    specialites: Optional[List[str]] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        import json
        data = super().model_validate(obj, **kwargs)
        if isinstance(data.specialites, str):
            try:
                data.specialites = json.loads(data.specialites)
            except Exception:
                data.specialites = []
        return data


class UserCount(BaseModel):
    count: int
