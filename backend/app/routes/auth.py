"""
Authentication Routes Module

This module handles user authentication including login and token validation.
It uses JWT (JSON Web Tokens) for secure authentication.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

# Import our database, models, schemas, and utilities
from ..config.db import get_db
from ..models.Models import User, UserRole
from ..schemas.Auth import Token, UserResponse, AddUserRequest
from ..utils.auth_utils import (
    authenticate_user, 
    create_access_token, 
    verify_token,
    hash_password,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Create router for authentication endpoints
auth_router = APIRouter(prefix="/auth", tags=["authentication"])

# OAuth2 scheme for token handling
# This tells FastAPI to expect a Bearer token in the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    """
    Dependency function to get the current authenticated user
    
    This function extracts the token from the request, validates it,
    and returns the corresponding user object.
    
    Args:
        token: The JWT token from the Authorization header
        db: Database session
        
    Returns:
        User: The authenticated user object
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Create credentials exception for reuse
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Verify token and extract user ID
    user_id, role = verify_token(token)
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    
    # If user doesn't exist, raise exception
    if user is None:
        raise credentials_exception
    
    return user


@auth_router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login endpoint that returns a JWT access token
    
    This endpoint accepts form data with username and password,
    validates the credentials, and returns a JWT token if successful.
    
    Args:
        form_data: OAuth2PasswordRequestForm containing username and password
        db: Database session
        
    Returns:
        Token: JWT access token and token type
        
    Raises:
        HTTPException: If authentication fails
    """
    # Authenticate the user
    user = await authenticate_user(db, form_data.username, form_data.password)
    
    # If authentication fails, raise 401 error
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token with expiration
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"uid": user.user_id, "role": user.role.value}, expires_delta=access_token_expires
    )
    
    # Return the token
    return Token(
        access_token=access_token, 
        token_type="bearer"
    )

# Admin Level Access only
@auth_router.post("/add_user")
async def add_new_user(form_data: AddUserRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Add a new user to the database
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can add new users"
        )
    
    new_user = User(
        user_id=form_data.user_id,
        password=hash_password(form_data.password),
        full_name=form_data.full_name,
        initials=form_data.initials,
        role=form_data.role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {"message": "User added successfully"}

@auth_router.post("/refresh")
async def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Refresh the access token
    """
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"uid": current_user.user_id, "role": current_user.role.value}, expires_delta=access_token_expires
    )
    return Token(
        access_token=access_token, 
        token_type="bearer"
    )

# Admin Level Access only
@auth_router.delete("/delete_user")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Delete a user from the database
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete users"
        )
    
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "User deleted successfully"}

@auth_router.get("/users", response_model=List[UserResponse])
async def get_all_users(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Fetch all users from the database.
    """
    if current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can view the user list"
        )
    
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            user_id=user.user_id,
            full_name=user.full_name,
            initials=user.initials,
            role=user.role
        ) for user in users
    ]

# Testing purpose only TODO: Remove in production
@auth_router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user information
    
    This endpoint returns information about the currently authenticated user.
    It requires a valid JWT token.
    
    Args:
        current_user: The authenticated user (injected by get_current_user)
        
    Returns:
        UserResponse: User information (excluding sensitive data)
    """
    return UserResponse(
        id=current_user.id,
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        initials=current_user.initials,
        role=current_user.role.value
    )