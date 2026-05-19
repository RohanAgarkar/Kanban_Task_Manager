from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager


from app.routes.websockets import ws_router
from app.routes.projects import projects_router
from app.routes.tasks import tasks_router
from app.routes.notifications import notifications_router

from .config.config import Config
from .config.db import create_tables
from .routes.auth import auth_router
from . import db_seeder

@asynccontextmanager
async def lifespan(app: FastAPI):

    if Config.create_tables:
        await create_tables()

    if Config.seed_tables:
        try:
            from .config.db import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                await db_seeder.seed_db(db)
                print("Database seeded successfully!")
        except Exception as e:
            print(f"Error seeding database: {e}")

    # Startup logic here
    print("Application startup complete")
    
    yield

    # Shutdown logic here
    print("Application shutdown complete")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ws_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(notifications_router)

@app.get("/")
async def read_root():
    return {"message": "Welcome to Kanban Board API", "status": "ok"}

