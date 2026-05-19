import { useState } from 'react';
import { X, Edit2, Trash2, AlertTriangle, MoveRight } from 'lucide-react';
import apiClient from '../../api/client';

export default function EditColumnModal({ column, allColumns, onClose }) {
  const [activeTab, setActiveTab] = useState('rename'); // 'rename' or 'delete'
  const [newName, setNewName] = useState(column.column_name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Delete Options
  const [deleteAction, setDeleteAction] = useState('move'); // 'move' or 'delete'
  
  // Get available columns to move tasks to (excluding the column being deleted)
  const availableColumnsToMoveTo = allColumns.filter(c => c.id !== column.id);
  const [targetColumnId, setTargetColumnId] = useState(
    availableColumnsToMoveTo.length > 0 ? availableColumnsToMoveTo[0].id : ''
  );

  const handleRename = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName === column.column_name) return onClose();

    setLoading(true);
    try {
      await apiClient.patch(`/projects/columns/${column.id}`, {
        column_name: newName.trim()
      });
      onClose(); // WebSockets will handle the UI update
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to rename column.");
      setLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (availableColumnsToMoveTo.length === 0 && deleteAction === 'move') {
      setError("No other columns exist to move tasks into. You must select 'Delete all tasks'.");
      return;
    }

    // Double confirmation for destructive action
    if (!window.confirm(`Are you absolutely sure you want to delete the "${column.column_name}" column?`)) return;

    setLoading(true);
    try {
      await apiClient.delete(`/projects/columns/${column.id}`, {
        data: {
          delete_tasks: deleteAction === 'delete',
          move_tasks_to_column_id: deleteAction === 'move' ? parseInt(targetColumnId) : null
        }
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to delete column.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header Tabs */}
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('rename')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'rename' ? 'border-primary text-primary bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Edit2 className="w-4 h-4" /> Rename Column
          </button>
          <button 
            onClick={() => setActiveTab('delete')}
            className={`flex-1 py-4 text-sm font-medium border-b-2 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'delete' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Trash2 className="w-4 h-4" /> Delete Column
          </button>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 text-gray-400 hover:bg-gray-100 rounded-md">
             <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-5 bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm border border-red-100">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Rename View */}
        {activeTab === 'rename' && (
          <form onSubmit={handleRename} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Column Name</label>
              <input
                type="text"
                required
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-70">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Delete View */}
        {activeTab === 'delete' && (
          <form onSubmit={handleDelete} className="p-5 space-y-5">
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-lg text-sm flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
              <p>Deleting a column is permanent. What should we do with the tasks currently sitting in this column?</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  name="deleteAction" 
                  value="move" 
                  checked={deleteAction === 'move'}
                  onChange={() => setDeleteAction('move')}
                  className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                  disabled={availableColumnsToMoveTo.length === 0}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <MoveRight className="w-4 h-4 text-blue-500" /> Move tasks to another column
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Safely transfer all cards before deleting.</p>
                  
                  {deleteAction === 'move' && availableColumnsToMoveTo.length > 0 && (
                    <select
                      value={targetColumnId}
                      onChange={e => setTargetColumnId(e.target.value)}
                      className="mt-2 w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:border-primary"
                    >
                      {availableColumnsToMoveTo.map(c => (
                        <option key={c.id} value={c.id}>{c.column_name}</option>
                      ))}
                    </select>
                  )}
                  {availableColumnsToMoveTo.length === 0 && (
                    <p className="text-xs text-red-500 mt-1 font-medium">No other columns available.</p>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-red-100 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                <input 
                  type="radio" 
                  name="deleteAction" 
                  value="delete" 
                  checked={deleteAction === 'delete'}
                  onChange={() => setDeleteAction('delete')}
                  className="mt-1 w-4 h-4 text-red-600 focus:ring-red-600"
                />
                <div>
                  <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Delete all tasks permanently
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">Destroy the column and completely erase all tasks inside it.</p>
                </div>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-70">
                {loading ? 'Processing...' : 'Confirm Deletion'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}