import { useState, useEffect, useContext, useRef } from 'react';
import { 
  X, Calendar, MessageSquare, AlertCircle, Loader2, Send, 
  Edit2, Trash2, Save, Plus, Paperclip, Download, FileText, ArrowRight, CheckSquare 
} from 'lucide-react';
import apiClient from '../../api/client';
import { AuthContext } from '../../context/AuthContext';
import { WebSocketContext } from '../../context/WebSocketContext';
import { format } from 'date-fns';

// REMOVED 'columns' from props. The modal now fetches its own columns!
export default function TaskDetailsModal({ taskId, onClose }) {
  const { user } = useContext(AuthContext);
  const { lastMessage } = useContext(WebSocketContext);
  const fileInputRef = useRef(null);
  
  const [taskData, setTaskData] = useState(null);
  const [comments, setComments] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [attachments, setAttachments] = useState([]); 
  const [columns, setColumns] = useState([]); // NEW: Modal manages its own columns
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false); 
  const [movingTask, setMovingTask] = useState(false); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', priority: '', due_date: ''
  });

  useEffect(() => {
    const fetchTaskDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const [taskRes, commentsRes, attachmentsRes] = await Promise.all([
          apiClient.get(`/tasks/${taskId}`),
          apiClient.get(`/tasks/${taskId}/comments`),
          apiClient.get(`/tasks/${taskId}/attachments`)
        ]);
        
        setTaskData(taskRes.data);
        setComments(commentsRes.data.comments || []);
        setAttachments(attachmentsRes.data || []);
        
        setEditForm({
          title: taskRes.data.task.title,
          description: taskRes.data.task.description || '',
          priority: taskRes.data.task.priority,
          due_date: taskRes.data.task.due_date ? taskRes.data.task.due_date.split('T')[0] : ''
        });

        const projId = taskRes.data.task.project_id;
        
        // NEW: Fetch both members AND columns for this specific project
        const [membersRes, colsRes] = await Promise.all([
          apiClient.get(`/projects/${projId}/members`),
          apiClient.get(`/projects/${projId}/columns`)
        ]);
        
        setProjectMembers(membersRes.data.members || []);
        setColumns(colsRes.data.columns || []);

      } catch (err) {
        console.error("Failed to fetch task details:", err);
        setError("Could not load task details.");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) fetchTaskDetails();
  }, [taskId]);

  useEffect(() => {
    if (!lastMessage) return;
    const eventType = lastMessage.event;
    const payload = lastMessage.data || lastMessage;

    if (eventType === "comment_added" && payload.comment?.task_id === taskId) {
      setComments(prev => {
        if (prev.some(c => c.id === payload.comment.id)) return prev;
        return [payload.comment, ...prev];
      });
    }

    if (eventType === "attachment_uploaded" && payload.attachment?.task_id === taskId) {
      setAttachments(prev => {
        if (prev.some(a => a.id === payload.attachment.id)) return prev;
        return [payload.attachment, ...prev];
      });
    }

    if (eventType === "attachment_deleted" && payload.task_id === taskId) {
      setAttachments(prev => prev.filter(a => a.id !== payload.attachment_id));
    }

    if (eventType === "task_moved" && payload.task?.id === taskId) {
      setTaskData(prev => ({
        ...prev,
        task: { ...prev.task, column_id: payload.task.column_id }
      }));
    }
  }, [lastMessage, taskId]);

  const handleQuickMove = async (columnId) => {
    if (columnId === taskData.task.column_id) return;
    setMovingTask(true);
    try {
      await apiClient.patch(`/tasks/${taskId}/move`, { column_id: columnId });
      setTaskData(prev => ({
        ...prev,
        task: { ...prev.task, column_id: columnId }
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to move task.");
    } finally {
      setMovingTask(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingFile(true);
    try {
      const res = await apiClient.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachments(prev => [res.data, ...prev]);
    } catch (err) {
      console.error(err);
      alert("Failed to upload file.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await apiClient.get(`/tasks/attachments/${attachment.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file. It may have been removed from the server.");
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      await apiClient.delete(`/tasks/attachments/${attachmentId}`);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete file.");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await apiClient.post(`/tasks/${taskId}/comments`, { comment: newComment.trim() });
      setComments([res.data, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error(err);
      alert("Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      onClose(); 
    } catch (err) {
      console.error(err);
      alert("Failed to delete the task.");
    }
  };

  const handleSaveChanges = async () => {
    if (!editForm.title.trim()) { alert("Task title cannot be empty."); return; }
    setIsSaving(true);
    try {
      let formattedDate = null;
      if (editForm.due_date) formattedDate = new Date(editForm.due_date).toISOString();
      const response = await apiClient.patch(`/tasks/${taskId}`, {
        title: editForm.title.trim(), description: editForm.description.trim(),
        priority: editForm.priority, due_date: formattedDate
      });
      setTaskData({ ...taskData, task: response.data });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update task.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignUser = async (member) => {
    try {
      await apiClient.post(`/tasks/${taskId}/assign`, { user_ids: [member.user_id_int] });
      setTaskData(prev => ({
        ...prev,
        assignees: [...prev.assignees, { id: member.user_id_int, user_id: member.user_id, full_name: member.full_name, initials: member.initials }]
      }));
      setShowAssignDropdown(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to assign user.");
    }
  };

  const handleUnassignUser = async (assigneeIntId) => {
    try {
      await apiClient.delete(`/tasks/${taskId}/assign/${assigneeIntId}`);
      setTaskData(prev => ({
        ...prev,
        assignees: prev.assignees.filter(a => a.id !== assigneeIntId)
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to unassign user.");
    }
  };

  const canEditOrDelete = user?.role === 'admin' || user?.role === 'moderator' || taskData?.task?.created_by === user?.id;
  const availableMembersToAssign = projectMembers.filter(pm => !taskData?.assignees.some(assignee => assignee.id === pm.user_id_int));

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">High Priority</span>;
      case 'medium': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">Medium Priority</span>;
      case 'low': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">Low Priority</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Normal</span>;
    }
  };

  const currentColumn = columns.find(c => c.id === taskData?.task?.column_id);

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error || !taskData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-2">
            <AlertCircle className="w-8 h-8" />
            <p>{error || "Task not found."}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">Close</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-200 shrink-0 bg-white gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  {currentColumn ? currentColumn.column_name : "Unknown Column"}
                </span>
                
                {!isEditing ? (
                  <>
                    {getPriorityBadge(taskData.task.priority)}
                    {taskData.task.due_date && (
                      <span className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-full bg-gray-50">
                        <Calendar className="w-4 h-4" />
                        Due {format(new Date(taskData.task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2 items-center">
                    <select value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary">
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                    <input type="date" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {canEditOrDelete && !isEditing && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Task">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleDeleteTask} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Task">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  </>
                )}
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {canEditOrDelete && !isEditing && columns.length > 0 && (
              <div className="bg-slate-50 border-b border-gray-200 px-6 py-2.5 flex items-center gap-3 overflow-x-auto custom-scrollbar shrink-0">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Quick Move:</span>
                <div className="flex gap-2">
                  {columns.map(col => (
                    <button
                      key={col.id}
                      onClick={() => handleQuickMove(col.id)}
                      disabled={movingTask || taskData.task.column_id === col.id}
                      className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        taskData.task.column_id === col.id 
                          ? 'bg-blue-100 text-blue-700 cursor-default' 
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary shadow-sm'
                      }`}
                    >
                      {taskData.task.column_id === col.id ? <CheckSquare className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                      {col.column_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
              <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200 custom-scrollbar">
                
                {!isEditing ? (
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-tight">{taskData.task.title}</h2>
                ) : (
                  <input 
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    className="w-full text-2xl font-bold text-gray-900 mb-6 border-b-2 border-primary outline-none bg-blue-50/30 px-2 py-1 rounded-t"
                    placeholder="Task Title"
                  />
                )}
                
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h3>
                  {!isEditing ? (
                    <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100 min-h-[100px]">
                      {taskData.task.description || <span className="italic text-gray-400">No description provided.</span>}
                    </div>
                  ) : (
                    <textarea 
                      value={editForm.description}
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[150px] resize-y"
                      placeholder="Add details, criteria, or notes..."
                    />
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-3 mt-4 mb-8">
                    <button onClick={handleSaveChanges} disabled={isSaving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={isSaving} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      Cancel
                    </button>
                  </div>
                )}

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4" /> Attachments
                    </h3>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
                      {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Upload File
                    </button>
                  </div>
                  {attachments.length === 0 ? (
                     <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50 flex flex-col items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No files attached.</p>
                     </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {attachments.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 bg-white group shadow-sm transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-blue-50 text-blue-600 p-2 rounded-md shrink-0"><FileText className="w-4 h-4" /></div>
                            <div className="truncate">
                              <p className="text-sm font-medium text-gray-700 truncate" title={file.file_name}>{file.file_name}</p>
                              <p className="text-[10px] text-gray-400">{format(new Date(file.created_at), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => handleDownload(file)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors" title="Download"><Download className="w-4 h-4" /></button>
                            {canEditOrDelete && <button onClick={() => handleDeleteAttachment(file.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4 relative">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assignees</h3>
                    {canEditOrDelete && (
                      <div className="relative">
                        <button onClick={() => setShowAssignDropdown(!showAssignDropdown)} className="text-xs flex items-center gap-1 text-primary bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium transition-colors"><Plus className="w-3 h-3" /> Add Assignee</button>
                        {showAssignDropdown && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Project Members</h4>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                              {availableMembersToAssign.length === 0 ? <p className="text-xs text-gray-500 px-2 py-2 italic">All project members assigned.</p> : (
                                availableMembersToAssign.map(member => (
                                  <button key={member.id} onClick={() => handleAssignUser(member)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-md transition-colors">
                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{member.initials}</div>
                                    <div className="truncate"><p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p></div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {taskData.assignees && taskData.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {taskData.assignees.map((assignee, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-full py-1 pr-3 pl-1 group hover:border-gray-300 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">{assignee.initials}</div>
                          <span className="text-sm font-medium text-slate-700">{assignee.full_name}</span>
                          {canEditOrDelete && <button onClick={() => handleUnassignUser(assignee.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity ml-1 bg-gray-50 hover:bg-red-50 rounded-full p-1"><X className="w-3 h-3" /></button>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-500 italic bg-gray-50 inline-block px-4 py-2 rounded-lg border border-gray-100">No one assigned to this task yet.</p>}
                </div>
              </div>

              <div className="w-full md:w-96 flex flex-col bg-slate-50 shrink-0 border-l border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2 text-gray-800 font-semibold bg-white shadow-sm z-10"><MessageSquare className="w-4 h-4 text-primary" /> Activity & Comments</div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-10 flex flex-col items-center gap-2"><MessageSquare className="w-8 h-8 text-gray-300" /><p>No comments yet. Start the conversation!</p></div>
                  ) : comments.map((comment) => (
                    <div key={comment.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-2 gap-2"><span className="font-bold text-sm text-gray-900 truncate">{comment.user_id}</span><span className="text-[10px] font-medium text-gray-400 shrink-0 bg-gray-50 px-2 py-1 rounded-md">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span></div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{comment.comment}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="p-4 bg-white border-t border-gray-200">
                  <div className="relative shadow-sm rounded-xl">
                    <textarea placeholder="Add a comment..." className="w-full border border-gray-300 rounded-xl p-3 pr-12 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none transition-all" rows="3" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(e); } }}></textarea>
                    <button type="submit" disabled={!newComment.trim() || submittingComment} className="absolute bottom-3 right-3 p-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"><Send className="w-4 h-4" /></button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}