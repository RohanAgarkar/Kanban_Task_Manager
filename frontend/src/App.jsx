import { useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Login from './components/auth/Login';
import MainLayout from './components/layout/MainLayout';
import ProjectBoard from './pages/ProjectBoard';
import ManageUsers from './pages/ManageUsers';
import MyTasks from './pages/MyTasks';
// NEW IMPORT
import Notifications from './pages/Notifications';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-board text-gray-500">Loading workspace...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  return (
    <div className="max-w-4xl mx-auto mt-10 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
        <span className="text-2xl font-bold">{user?.initials}</span>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to your workspace</h2>
      <p className="text-gray-500">Select a project from the sidebar to view its Kanban board, or create a new one to get started.</p>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><MainLayout title="Dashboard"><Dashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><MainLayout title="Project Board"><ProjectBoard /></MainLayout></ProtectedRoute>} />
            <Route path="/manage-users" element={<ProtectedRoute><MainLayout title="Manage Users"><ManageUsers /></MainLayout></ProtectedRoute>} />
            <Route path="/my-tasks" element={<ProtectedRoute><MainLayout title="My Tasks"><MyTasks /></MainLayout></ProtectedRoute>} />
            
            {/* NEW NOTIFICATIONS ROUTE */}
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <MainLayout title="Notifications">
                    <Notifications />
                  </MainLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}