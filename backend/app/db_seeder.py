from datetime import datetime, timezone
import hashlib
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from .models.Models import Base, User, UserRole, Task, ColumnNames, Priority, Projects, TaskAssignees, Comments, ProjectMembers, ProjectColumns
from .config.db import AsyncSessionLocal


def hash_password(password: str) -> str:
    """
    Hash password using SHA-256 with salt
    
    Args:
        password: Plain text password
        
    Returns:
        str: Hashed password
    """
    # Generate a random salt
    salt = secrets.token_hex(16)
    
    # Hash password with salt
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    
    # Combine salt and hash for storage
    return f"{salt}${password_hash}"


async def seed_db(db: AsyncSession):
    print("Starting database seeding...")
    
    # Seed data
    user_role = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.USER]
    column_names = [ColumnNames.TODO, ColumnNames.IN_PROGRESS, ColumnNames.REVIEW, ColumnNames.DONE]
    priority = [Priority.LOW, Priority.MEDIUM, Priority.HIGH]

    # Add users with hashed passwords
    plain_password = "password"
    users = [
        User(user_id="rohan@gmail.com", password=hash_password(plain_password), full_name="Rohan", initials="RR", role=UserRole.ADMIN),
        User(user_id="sachin@gmail.com", password=hash_password(plain_password), full_name="Sachin", initials="SS", role=UserRole.MODERATOR),
        User(user_id="priya@gmail.com", password=hash_password(plain_password), full_name="Priya", initials="PP", role=UserRole.USER),
    ]
    
    print("Adding users...")
    db.add_all(users)
    await db.flush()
    await db.commit()
    print("Users committed successfully")

    # Add projects
    projects = [
        Projects(owner_id=1, project_name="Project 1"),
    ]
    db.add_all(projects)
    await db.flush()
    await db.commit()
    
    # Add project columns for each project
    project_columns = [
        # Columns for Project 1
        ProjectColumns(project_id=1, column_name="To Do", order=1),
        ProjectColumns(project_id=1, column_name="In Progress", order=2),
        ProjectColumns(project_id=1, column_name="Review", order=3),
        ProjectColumns(project_id=1, column_name="Done", order=4),
    ]
    db.add_all(project_columns)
    await db.flush()
    await db.commit()

    # Add tasks (using column_name as defined in the model)
    tasks = [
        Task(project_id=1, column_name=1, title="Task 1.1", description="Description 1.1", priority=Priority.LOW, due_date=datetime.now(timezone.utc), created_by=1, updated_by=1),
        Task(project_id=1, column_name=1, title="Task 1.2", description="Description 1.2", priority=Priority.MEDIUM, due_date=datetime.now(timezone.utc), created_by=1, updated_by=1),
    ]
    db.add_all(tasks)
    await db.flush()
    await db.commit()

    # Add assignees
    assignees = [
        TaskAssignees(task_id=1, user_id=2),
        TaskAssignees(task_id=1, user_id=3),
    ]
    db.add_all(assignees)
    await db.flush()
    await db.commit()

    # Add comments
    comments = [
        Comments(task_id=1, user_id=1, comment="Comment 1.1"),
        Comments(task_id=1, user_id=2, comment="Comment 1.2"),
    ]
    db.add_all(comments)
    await db.flush()
    await db.commit()

    # Add project members
    project_members = [
        ProjectMembers(project_id=1, user_id=2),
        ProjectMembers(project_id=1, user_id=3),
    ]
    db.add_all(project_members)
    await db.flush()
    await db.commit()

    # Projects can only be created by managers
    if users[1].role == UserRole.MODERATOR:
        projects.append(Projects(owner_id=2, project_name="Project 2"))
        db.add(projects[1])
        await db.flush()
        await db.commit()
        
        # Add columns for Project 2
        project_2_columns = [
            ProjectColumns(project_id=2, column_name="To Do", order=1),
            ProjectColumns(project_id=2, column_name="In Progress", order=2),
            ProjectColumns(project_id=2, column_name="Review", order=3),
            ProjectColumns(project_id=2, column_name="Done", order=4),
        ]
        db.add_all(project_2_columns)
        await db.flush()
        await db.commit()


async def main():
    # Create database session
    async with AsyncSessionLocal() as db:
        try:
            # Seed the database
            await seed_db(db)
            print("Database seeded successfully!")
        except Exception as e:
            print(f"Error seeding database: {e}")
            await db.rollback()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
