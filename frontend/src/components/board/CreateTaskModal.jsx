import { useState } from 'react';
import { X, CheckSquare, AlertCircle } from 'lucide-react';
import apiClient from '../../api/client';

export default function CreateTaskModal({ projectId, columns, defaultColumnId, onClose }) {
  // We initialize the form with the defaultColumnId passed from the board, 
  // or fallback to the very first column in the array if none is provided.
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    column_id: defaultColumnId || (columns.length > 0 ? columns[0].id : '')
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    setError('');

    try {
      let formattedDate = new Date().toISOString(); 
      if (formData.due_date) {
        formattedDate = new Date(formData.due_date).toISOString();
      }

      // We send column_id as an integer to perfectly match the backend Pydantic schema
      await apiClient.post('/tasks/', {
        project_id: parseInt(projectId),
        column_id: parseInt(formData.column_id),
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        due_date: formattedDate
      });

      // The FastAPI WebSocket broadcasts the task_created event, 
      // so we just close the modal. The board will update automatically!
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to create task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2 text-primary">
            <CheckSquare className="w-5 h-5" />
            <h2 className="text-lg font-bold text-gray-900">Create New Task</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <input
              type="text"
              name="title"
              required
              autoFocus
              value={formData.title}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="e.g. Design homepage hero section"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
              placeholder="Add details, criteria, or notes..."
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Column</label>
              <select
                name="column_id"
                value={formData.column_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                {/* DYNAMIC COLUMNS LOOP */}
                {columns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.column_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              name="due_date"
              required
              value={formData.due_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-70">
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}