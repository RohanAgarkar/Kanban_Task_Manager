from pydantic import BaseModel
from typing import Optional

from ..models.Models import UserRole

class Token(BaseModel):
    """Model for the token response"""
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    """Model for user information response"""
    id: int
    user_id: str
    full_name: str
    initials: str
    role: UserRole

class AddUserRequest(BaseModel):
    """Model for adding a new user"""
    user_id: str
    password: str
    full_name: str
    initials: str
    role: UserRole

# class TokenData(BaseModel):
#     """Model for the token payload data"""
#     user_id: Optional[str] = None


# class LoginRequest(BaseModel):
#     """Model for login request body"""
#     user_id: str
#     password: str


# class LoginResponse(BaseModel):
#     """Model for login response"""
#     access_token: str
#     token_type: str = "bearer"


