import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import apiClient from '../api/client';
import BoardColumn from '../components/board/BoardColumn';
import TaskDetailsModal from '../components/board/TaskDetailsModal';
import CreateTaskModal from '../components/board/CreateTaskModal';
import EditColumnModal from '../components/board/EditColumnModal'; 
import { WebSocketContext } from '../context/WebSocketContext';
import { AuthContext } from '../context/AuthContext';
import { Loader2, AlertCircle, WifiOff, Columns, Plus } from 'lucide-react';

export default function ProjectBoard() {
  const { id } = useParams();
  const { lastMessage, isConnected } = useContext(WebSocketContext);
  const { user } = useContext(AuthContext);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [columns, setColumns] = useState([]);
  const [tasksByColumn, setTasksByColumn] = useState({});
  
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createColumnDefault, setCreateColumnDefault] = useState(null);
  const [editingColumn, setEditingColumn] = useState(null);

  useEffect(() => {
    const fetchBoardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [columnsRes, tasksRes] = await Promise.all([
          apiClient.get(`/projects/${id}/columns`),
          apiClient.get(`/tasks/project/${id}`)
        ]);

        const fetchedColumns = columnsRes.data.columns || [];
        setColumns(fetchedColumns);

        const tasks = tasksRes.data.tasks || [];
        const grouped = {};
        fetchedColumns.forEach(col => { grouped[col.id] = []; });

        tasks.forEach(item => {
          const colId = item.task.column_id;
          if (grouped[colId]) {
            grouped[colId].push(item);
          } else {
            grouped[fetchedColumns[0]?.id]?.push(item);
          }
        });

        setTasksByColumn(grouped);
      } catch (err) {
        console.error("Failed to load project data:", err);
        setError("Failed to load the Kanban board. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchBoardData();
  }, [id]);

  useEffect(() => {
    if (!lastMessage) return;
    
    const eventType = lastMessage.event;
    const payload = lastMessage.data || lastMessage;

    const eventProjectId = payload?.task?.project_id || payload?.column?.project_id || payload?.project_id;
    if (eventProjectId !== parseInt(id)) return;

    if (eventType === "column_created") {
      setColumns(prev => {
        // FIX: Prevent Duplicate Columns
        if (prev.some(c => c.id === payload.column.id)) return prev;
        return [...prev, payload.column].sort((a, b) => a.order - b.order);
      });
      setTasksByColumn(prev => {
        if (prev[payload.column.id]) return prev;
        return { ...prev, [payload.column.id]: [] };
      });
    } 
    else if (eventType === "column_renamed") {
      setColumns(prev => prev.map(c => c.id === payload.column.id ? payload.column : c));
    }
    else if (eventType === "column_deleted") {
      const deletedId = payload.column_id;
      setColumns(prev => prev.filter(c => c.id !== deletedId));
      setTasksByColumn(prev => {
        const newState = { ...prev };
        delete newState[deletedId];
        return newState;
      });
      if (payload.tasks_moved_to) {
        apiClient.get(`/tasks/project/${id}`).then(res => {
          window.location.reload(); 
        });
      }
    }
    else if (eventType === "task_moved" || eventType === "task_updated") {
      setTasksByColumn(prev => {
        const { task } = payload;
        const newState = { ...prev };
        let taskItem = null;

        for (const colId in newState) {
          const index = newState[colId].findIndex(t => t.task.id === task.id);
          if (index !== -1) {
            taskItem = newState[colId].splice(index, 1)[0];
            break;
          }
        }

        if (taskItem && newState[task.column_id]) {
          taskItem.task = { ...taskItem.task, ...task };
          newState[task.column_id].push(taskItem);
        }
        return newState;
      });
    } 
    else if (eventType === "task_created") {
      setTasksByColumn(prev => {
        const { task } = payload;
        const newState = { ...prev };
        if (newState[task.column_id]) {
          // FIX: Prevent Duplicate Tasks by checking if the ID already exists
          const taskExists = newState[task.column_id].some(t => t.task.id === task.id);
          if (!taskExists) {
            newState[task.column_id].push({ task: task, assignees: [] });
          }
        }
        return newState;
      });
    }
    else if (eventType === "task_deleted") {
      setTasksByColumn(prev => {
        const { task } = payload;
        const newState = { ...prev };
        for (const colId in newState) {
          newState[colId] = newState[colId].filter(t => t.task.id !== task.id);
        }
        return newState;
      });
      if (selectedTaskId === payload.task.id) setSelectedTaskId(null);
    }
  }, [lastMessage, id, selectedTaskId]);

  const handleDragEnd = async (result) => {
    if (!isConnected) {
      alert("You are currently offline. Please wait for the connection to restore.");
      return;
    }

    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColId = parseInt(source.droppableId);
    const destColId = parseInt(destination.droppableId);
    const taskId = parseInt(draggableId);

    const sourceList = [...tasksByColumn[sourceColId]];
    const destList = sourceColId === destColId ? sourceList : [...tasksByColumn[destColId]];
    
    const [movedTask] = sourceList.splice(source.index, 1);
    movedTask.task.column_id = destColId;
    destList.splice(destination.index, 0, movedTask);

    setTasksByColumn(prev => ({
      ...prev,
      [sourceColId]: sourceList,
      [destColId]: destList
    }));

    try {
      await apiClient.patch(`/tasks/${taskId}/move`, {
        column_id: destColId 
      });
    } catch (err) {
      console.error(err);
      alert("Failed to sync task movement with the server.");
    }
  };

  const openCreateModal = (columnId) => {
    setCreateColumnDefault(columnId);
    setIsCreateModalOpen(true);
  };

  const handleAddColumn = async () => {
    const columnName = window.prompt("Enter new column name:");
    if (!columnName || !columnName.trim()) return;

    try {
      const order = columns.length > 0 ? Math.max(...columns.map(c => c.order)) + 1 : 1;
      await apiClient.post(`/projects/${id}/columns`, {
        column_name: columnName.trim(),
        order: order
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to create column.");
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="h-full flex items-center justify-center text-red-500 flex-col gap-2"><AlertCircle className="w-8 h-8" /><p>{error}</p></div>;

  const canManageColumns = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between mb-4 shrink-0 px-2 items-center">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Columns className="w-5 h-5 text-gray-400" /> Board View
        </h2>
        <div className="flex gap-3">
          {canManageColumns && (
            <button onClick={handleAddColumn} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm">
              <Plus className="w-4 h-4" /> Add Column
            </button>
          )}
          <button onClick={() => openCreateModal(columns[0]?.id)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm" disabled={columns.length === 0}>
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 shadow-sm shrink-0">
          <div className="bg-red-100 p-2 rounded-full shrink-0"><WifiOff className="w-5 h-5 text-red-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-red-900">Disconnected</h3>
            <p className="text-xs text-red-700 mt-0.5">Offline mode. Dragging disabled.</p>
          </div>
        </div>
      )}

      {columns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-gray-200 shadow-sm p-10">
          <Columns className="w-12 h-12 text-blue-500 mb-4 bg-blue-50 p-3 rounded-full" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Columns Yet</h2>
          <p className="text-gray-500 text-sm max-w-sm mb-6">This project needs columns before you can add tasks.</p>
          {canManageColumns && (
            <button onClick={handleAddColumn} className="bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm">
              Create First Column
            </button>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full overflow-x-auto pb-4 items-start custom-scrollbar">
            {columns.map(column => (
              <BoardColumn 
                key={column.id} 
                column={column} 
                tasks={tasksByColumn[column.id] || []} 
                onTaskClick={setSelectedTaskId} 
                onAddTask={openCreateModal}
                onEditColumn={canManageColumns ? setEditingColumn : null}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {selectedTaskId && <TaskDetailsModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} columns={columns} />}
      {isCreateModalOpen && <CreateTaskModal projectId={id} columns={columns} defaultColumnId={createColumnDefault} onClose={() => setIsCreateModalOpen(false)} />}
      
      {editingColumn && <EditColumnModal column={editingColumn} allColumns={columns} onClose={() => setEditingColumn(null)} />}
    </div>
  );
}