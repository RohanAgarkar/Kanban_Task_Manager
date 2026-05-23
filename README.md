# LAN Kanban Task Manager

A modern, full-stack Kanban board application with real-time collaboration capabilities, built with FastAPI backend and React frontend with Electron desktop support.

## 🚀 Features

- **Real-time Collaboration**: WebSocket-powered live updates for task management
- **User Authentication**: Secure JWT-based authentication system
- **Project Management**: Create and manage multiple projects with dedicated Kanban boards
- **Task Management**: Drag-and-drop task organization across columns
- **User Management**: Admin panel for managing users
- **Desktop Application**: Electron wrapper for cross-platform desktop deployment
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Database**: SQLite with SQLAlchemy ORM for efficient data management

## 🏗️ Architecture

### Backend (FastAPI)
- **Framework**: FastAPI with Python 3.12+
- **Database**: SQLite with SQLAlchemy 2.0 (async)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Real-time**: WebSocket support for live updates
- **API Documentation**: Auto-generated OpenAPI/Swagger docs

### Frontend (React)
- **Framework**: React 18 with Vite
- **Routing**: React Router v7
- **Styling**: Tailwind CSS v4
- **Drag & Drop**: @hello-pangea/dnd for Kanban board interactions
- **HTTP Client**: Axios for API communication
- **Icons**: Lucide React
- **Desktop**: Electron for cross-platform deployment

## 📋 Prerequisites

- **Backend**: Python 3.12+ with uv package manager
- **Frontend**: Node.js 18+ and npm
- **Database**: SQLite (included)

## 🛠️ Installation & Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies using uv:
```bash
uv sync
```

3. Activate the virtual environment:
```bash
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

4. Start the development server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Desktop Application (Electron)

1. With the frontend running, start Electron in development mode:
```bash
npm run electron:dev
```

2. Build the desktop application:
```bash
npm run electron:build
```

## 📁 Project Structure

```
Todo-project/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── config/            # Configuration files
│   │   ├── models/            # Database models
│   │   ├── routes/            # API routes
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── utils/             # Utility functions
│   │   ├── websockets/        # WebSocket handlers
│   │   ├── main.py            # FastAPI application entry
│   │   └── db_seeder.py       # Database seeding
│   ├── pyproject.toml         # Python dependencies
│   └── uv.lock               # Dependency lock file
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── api/              # API service functions
│   │   ├── components/       # Reusable React components
│   │   ├── context/          # React context providers
│   │   ├── pages/            # Page components
│   │   ├── assets/           # Static assets
│   │   └── App.jsx           # Main App component
│   ├── electron/             # Electron main process
│   ├── public/               # Public assets
│   ├── package.json          # Node.js dependencies
│   └── vite.config.js        # Vite configuration
├── LICENSE                    # MIT License
└── README.md                  # This file
```

## 🔧 Configuration

### Backend Configuration

The backend uses environment variables and configuration files in `backend/app/config/`. Key settings include:

- Database connection settings
- JWT secret keys
- CORS origins
- Table creation and seeding options

### Frontend Configuration

The frontend configuration is managed through:

- `vite.config.js` - Build and development server settings
- `tailwind.config.js` - Tailwind CSS configuration
- `package.json` - Dependencies and build scripts

## 🎯 Usage

1. **Start both servers**: Run the backend and frontend development servers
2. **Create an account**: Register a new user account
3. **Create projects**: Set up your first project
4. **Manage tasks**: Create, edit, and drag tasks between columns
5. **Real-time collaboration**: Multiple users can work on the same board simultaneously
6. **User management**: Admin users can manage other users through the admin panel

## 🔐 Authentication

The application uses JWT (JSON Web Tokens) for authentication:

- Users register with email and password
- Passwords are hashed using bcrypt
- JWT tokens are used for session management
- Protected routes require valid authentication

## 🔄 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token

### Projects
- `GET /projects` - List user projects
- `POST /projects` - Create new project
- `GET /projects/{id}` - Get project details
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

### Tasks
- `GET /tasks` - List tasks (with project filter)
- `POST /tasks` - Create new task
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

### Users (Admin)
- `GET /users` - List all users
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

### WebSocket
- `/ws` - Real-time updates for tasks and projects

## 🚀 Deployment

### Backend Deployment
1. Build the production version
2. Set environment variables for production
3. Run with a production ASGI server (e.g., Gunicorn with Uvicorn workers)

### Frontend Deployment
1. Build the production version: `npm run build`
2. Deploy the `dist` folder to a web server
3. Configure the backend API endpoint

### Desktop Application
1. Build the desktop app: `npm run electron:build`
2. Distribute the generated installers from `dist-electron/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit them
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the backend allows requests from your frontend URL
2. **Database Connection**: Check that SQLite database permissions are correct
3. **WebSocket Connection**: Verify WebSocket endpoint is accessible
4. **Electron Build Issues**: Ensure all Node.js dependencies are installed

### Development Tips

- Use the browser developer tools for frontend debugging
- Check the FastAPI auto-generated docs at `/docs` for API testing
- Monitor the console for WebSocket connection status
- Use the database seeder for initial test data

## 📞 Support

For support and questions, please open an issue in the repository or contact the development team.

---
