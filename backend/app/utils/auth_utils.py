"""
Authentication Utilities Module

This module contains helper functions for password hashing, user authentication,
and JWT token management.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import secrets
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.Models import User, UserRole
from ..config.security_conf import JWTConfig


# JWT Configuration
# SECRET_KEY: Used to sign and verify JWT tokens
# In production, this should be a strong, random secret stored securely
SECRET_KEY = JWTConfig.SECRET_KEY

# ALGORITHM: The algorithm used to encode JWT token
ALGORITHM = JWTConfig.ALGORITHM

# ACCESS_TOKEN_EXPIRE_MINUTES: How long of token is valid (in minutes)
ACCESS_TOKEN_EXPIRE_MINUTES = JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES


def hash_password(password: str) -> str:
    """
    Hash password using SHA-256 with salt
    
    Args:
        password: Plain text password
        
    Returns:
        str: Hashed password in format "salt$hash"
    """
    # Generate a random salt
    salt = secrets.token_hex(16)
    
    # Hash password with salt
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    
    # Combine salt and hash for storage
    return f"{salt}${password_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password
    
    Args:
        plain_password: The password provided by user
        hashed_password: The stored hashed password (salt$hash format)
        
    Returns:
        bool: True if passwords match, False otherwise
    """
    try:
        # Split stored password into salt and hash
        salt, stored_hash = hashed_password.split('$')
        
        # Hash the plain password with same salt
        computed_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        
        # Compare hashes
        return computed_hash == stored_hash
    except:
        # If format is invalid, return False
        return False


async def authenticate_user(db: AsyncSession, user_id: str, password: str) -> Optional[User]:
    """
    Authenticate a user by checking their credentials
    
    Args:
        db: Database session
        user_id: The user's ID (email in our case)
        password: The plain password to verify
        
    Returns:
        User: The user object if authentication successful, None otherwise
    """
    # Find user in database
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    
    # If user doesn't exist, return None
    if not user:
        return None
    
    # Verify password against hashed password
    if not verify_password(password, user.password):
        return None
    
    # User exists and password matches
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: The data to include in token payload
        expires_delta: How long until token expires (optional)
        
    Returns:
        str: The encoded JWT token
    """
    # Copy of data to avoid modifying the original
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Add expiration to the payload
    to_encode.update({"exp": expire})
    
    # Encode and return JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> tuple[Optional[str], Optional[str]]:
    """
    Verify a JWT token and extract user ID
    
    Args:
        token: The JWT token to verify
        
    Returns:
        tuple[Optional[str], Optional[str]]: User ID and role if token is valid, None, None otherwise
    """
    try:
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract user_id from the token
        user_id: str = payload.get("uid")
        role: str = payload.get("role")
        
        # If no user_id in token, return None
        if user_id is None:
            return None, None
            
        return user_id, role
        
    except JWTError:
        # If token is invalid (expired, tampered, etc.)
        return None, None
