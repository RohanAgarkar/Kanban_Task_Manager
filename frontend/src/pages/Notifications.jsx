import { useState, useEffect, useContext } from 'react';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { WebSocketContext } from '../context/WebSocketContext';
import { formatDistanceToNow, format } from 'date-fns';
import { Bell, Check, CheckCircle2, Inbox, Loader2, AlertCircle } from 'lucide-react';
// NEW IMPORT
import TaskDetailsModal from '../components/board/TaskDetailsModal';

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const { lastMessage } = useContext(WebSocketContext);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // NEW STATE: Tracks which task to open
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/notifications/');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Could not load your notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    const eventType = lastMessage.event;
    const payload = lastMessage.data || lastMessage;

    if (eventType === "notification_created" && payload.target_user_id === user?.id) {
      setNotifications(prev => [payload.notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }
  }, [lastMessage, user?.id]);

  // NEW LOGIC: Mark read AND open task
  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await apiClient.patch(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }
    
    // Open the modal if this notification is tied to a task
    if (notif.task_id) {
      setSelectedTaskId(notif.task_id);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
          </h2>
          <p className="text-sm text-gray-500 mt-1">Stay up to date with your project activity.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin text-primary mb-2" /><p className="text-sm">Loading activity feed...</p></div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500"><AlertCircle className="w-8 h-8 mb-2" /><p className="text-sm">{error}</p></div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><Inbox className="w-16 h-16 text-gray-300 mb-4" /><h3 className="text-lg font-bold text-gray-900">You're all caught up!</h3><p className="text-gray-500 text-sm mt-1">When someone assigns you a task or mentions you, it will appear here.</p></div>
        ) : (
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <div className="divide-y divide-gray-100">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-5 transition-colors flex gap-4 cursor-pointer ${!notif.is_read ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="shrink-0 mt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${!notif.is_read ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-gray-300'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-1">
                      <p className={`text-base ${!notif.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{notif.title}</p>
                      <p className="text-xs text-gray-500 font-medium whitespace-nowrap shrink-0">{format(new Date(notif.created_at), 'MMM d, h:mm a')} <span className="text-gray-400 ml-1">({formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })})</span></p>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">{notif.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RENDER MODAL ON TOP WHEN TASK IS SELECTED */}
      {selectedTaskId && (
        <TaskDetailsModal 
          taskId={selectedTaskId} 
          onClose={() => setSelectedTaskId(null)} 
        />
      )}
    </div>
  );
}