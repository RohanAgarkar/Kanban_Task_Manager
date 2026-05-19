import { useState, useEffect, useContext } from 'react';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { WebSocketContext } from '../context/WebSocketContext';
import TaskDetailsModal from '../components/board/TaskDetailsModal';
import { format } from 'date-fns';
import { CheckSquare, Calendar, Loader2, AlertCircle, Search, FolderKanban, ArrowRight } from 'lucide-react';

export default function MyTasks() {
  const { user } = useContext(AuthContext);
  const { lastMessage } = useContext(WebSocketContext);
  
  const [tasks, setTasks] = useState([]);
  const [projectsMap, setProjectsMap] = useState({});
  const [columnsMap, setColumnsMap] = useState({});
  const [columnsByProject, setColumnsByProject] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchMyDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch the user's assigned tasks
      const tasksRes = await apiClient.get('/tasks/me');
      const fetchedTasks = tasksRes.data.tasks || [];
      setTasks(fetchedTasks);

      // 2. Fetch all projects the user is a part of to map the project_id to project_name
      const projectsRes = await apiClient.get('/projects/');
      const fetchedProjects = projectsRes.data.projects || [];
      
      const pMap = {};
      fetchedProjects.forEach(p => pMap[p.id] = p.project_name);
      setProjectsMap(pMap);

      // 3. Fetch columns for those projects to map column_id to column_name
      // We do this in parallel using Promise.all for maximum speed
      const cMap = {};
      const cByProj = {};
      
      await Promise.all(fetchedProjects.map(async (project) => {
        try {
          const colsRes = await apiClient.get(`/projects/${project.id}/columns`);
          const projectColumns = colsRes.data.columns || [];
          
          cByProj[project.id] = projectColumns;
          projectColumns.forEach(c => {
            cMap[c.id] = c.column_name;
          });
        } catch (err) {
          console.warn(`Failed to fetch columns for project ${project.id}`, err);
          cByProj[project.id] = [];
        }
      }));

      setColumnsMap(cMap);
      setColumnsByProject(cByProj);

    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError("Could not load your tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    fetchMyDashboard();
  }, []);

  // WebSocket Live Sync: If someone assigns a task to you, or updates a task you are assigned to, refresh the table!
  useEffect(() => {
    if (!lastMessage) return;
    
    const eventType = lastMessage.event;
    
    if (
      eventType === "task_assigned" || 
      eventType === "task_unassigned" || 
      eventType === "task_updated" || 
      eventType === "task_moved" || 
      eventType === "task_deleted"
    ) {
      // To keep data mapping perfectly synced without complex state merging, 
      // we trigger a silent background refresh when relevant events occur.
      fetchMyDashboard();
    }
  }, [lastMessage]);

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">High</span>;
      case 'medium': return <span className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Medium</span>;
      case 'low': return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Low</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Normal</span>;
    }
  };

  // Filter tasks based on search
  const filteredTasks = tasks.filter(t => 
    t.task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (projectsMap[t.task.project_id] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> My Tasks
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage everything assigned to you across all projects.</p>
        </div>
        
        <div className="relative max-w-md w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search my tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white shadow-sm"
          />
        </div>
      </div>

      {/* Data Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm">Loading your dashboard...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Task Name</th>
                  <th className="py-4 px-6">Project</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Priority</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <CheckSquare className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-base font-medium text-gray-600">No tasks found</p>
                        <p className="text-sm mt-1">You don't have any tasks assigned to you matching this criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((item) => (
                    <tr key={item.task.id} className="hover:bg-blue-50/30 transition-colors group">
                      
                      {/* Task Name */}
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[250px]" title={item.task.title}>
                          {item.task.title}
                        </p>
                      </td>

                      {/* Project Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <FolderKanban className="w-4 h-4 text-gray-400" />
                          <span className="truncate max-w-[150px]" title={projectsMap[item.task.project_id]}>
                            {projectsMap[item.task.project_id] || 'Unknown Project'}
                          </span>
                        </div>
                      </td>

                      {/* Dynamic Column Status */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          {columnsMap[item.task.column_id] || 'Unknown'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-6">
                        {getPriorityBadge(item.task.priority)}
                      </td>

                      {/* Due Date */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {item.task.due_date ? format(new Date(item.task.due_date), 'MMM d, yyyy') : 'No Date'}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedTask(item.task)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          View <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Table Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-sm text-gray-500 shrink-0 flex justify-between items-center">
          <span>Total Assigned Tasks: <span className="font-bold text-gray-700">{filteredTasks.length}</span></span>
        </div>
      </div>

      {/* Render the Task Details Modal if a task is clicked */}
      {selectedTask && (
        <TaskDetailsModal 
          taskId={selectedTask.id} 
          // We must pass the specific columns for the project this task belongs to!
          columns={columnsByProject[selectedTask.project_id] || []}
          onClose={() => {
            setSelectedTask(null);
            // Refresh table quietly on close in case they modified it in the modal
            fetchMyDashboard();
          }} 
        />
      )}
    </div>
  );
}