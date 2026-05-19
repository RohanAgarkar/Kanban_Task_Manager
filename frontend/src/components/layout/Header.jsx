import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { WebSocketContext } from '../../context/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../api/client';
import { Bell, Check, BellRing, Inbox, ArrowRight } from 'lucide-react';
// NEW IMPORT
import TaskDetailsModal from '../board/TaskDetailsModal';

export default function Header({ title }) {
  const { user } = useContext(AuthContext);
  const { lastMessage } = useContext(WebSocketContext);
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // NEW STATE
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await apiClient.get('/notifications/');
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      } catch (err) { console.error("Failed to fetch notifications:", err); }
    };
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    
    if (notif.task_id) {
      setIsDropdownOpen(false); // Close the dropdown when opening the modal
      setSelectedTaskId(notif.task_id);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) { console.error("Failed to mark all as read:", err); }
  };

  const handleViewAll = () => {
    setIsDropdownOpen(false);
    navigate('/notifications');
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 relative z-30">
      
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">{title || 'Kanban Board'}</h1>
      </div>

      <div className="flex items-center gap-4 relative">
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`p-2 relative rounded-full transition-colors ${isDropdownOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            {unreadCount > 0 ? <BellRing className="w-5 h-5 animate-pulse text-primary" /> : <Bell className="w-5 h-5" />}
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[500px]">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                <h3 className="font-bold text-gray-800">Notifications</h3>
                {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:text-blue-800 flex items-center gap-1 transition-colors"><Check className="w-3 h-3" /> Mark all read</button>}
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center flex flex-col items-center justify-center text-gray-500"><Inbox className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm font-medium">You're all caught up!</p></div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.slice(0, 10).map((notif) => (
                      <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-4 transition-colors cursor-pointer hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50/40' : 'bg-white'}`}>
                        <div className="flex gap-3">
                          <div className="shrink-0 mt-1.5"><div className={`w-2 h-2 rounded-full ${!notif.is_read ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-transparent'}`}></div></div>
                          <div className="flex-1">
                            <p className={`text-sm mb-0.5 ${!notif.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{notif.title}</p>
                            <p className="text-xs text-gray-600 leading-relaxed mb-2 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleViewAll} className="p-3 border-t border-gray-100 bg-gray-50 hover:bg-blue-50 shrink-0 text-center flex items-center justify-center gap-1 text-sm font-semibold text-primary transition-colors w-full">
                View all notifications <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center font-bold text-sm shadow-sm border border-blue-200">{user?.initials || 'U'}</div>
          <div className="hidden sm:block"><p className="text-sm font-bold text-gray-700 leading-none">{user?.full_name || 'User'}</p><p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">{user?.role || 'Member'}</p></div>
        </div>
      </div>

      {/* RENDER MODAL ON TOP WHEN TASK IS SELECTED */}
      {selectedTaskId && (
        <TaskDetailsModal 
          taskId={selectedTaskId} 
          onClose={() => setSelectedTaskId(null)} 
        />
      )}
    </header>
  );
}