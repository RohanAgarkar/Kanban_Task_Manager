import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MessageSquare, Paperclip } from 'lucide-react';
import { format } from 'date-fns';

export default function TaskCard({ task, index, onClick }) {
  // BULLETPROOF FALLBACK: If the data is still loading or malformed, 
  // do not render the card and protect the drag-and-drop context from crashing.
  if (!task || !task.task || !task.task.id) return null;

  // Safely unwrap our nested data structure
  const t = task.task;
  const assignees = task.assignees || [];

  // Guarantee the ID is a string for the drag-and-drop library
  const draggableId = t.id.toString();

  // Helper to color-code priorities
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white p-4 rounded-xl border mb-3 cursor-pointer group hover:border-primary transition-all ${
            snapshot.isDragging 
              ? 'shadow-xl border-primary rotate-2 scale-105 z-50' 
              : 'border-gray-200 shadow-sm'
          }`}
        >
          {/* Card Header (Priority Badge) */}
          <div className="flex justify-between items-start mb-2 gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${getPriorityColor(t.priority)}`}>
              {t.priority}
            </span>
          </div>

          {/* Task Title */}
          <h4 className="text-sm font-semibold text-gray-900 mb-2 leading-tight group-hover:text-primary transition-colors">
            {t.title}
          </h4>

          {/* Card Footer (Assignees & Icons) */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            
            {/* Assignees Overlapping Avatars */}
            <div className="flex -space-x-2">
              {assignees.length > 0 ? (
                assignees.slice(0, 3).map((a, i) => (
                  <div 
                    key={i} 
                    className="w-6 h-6 rounded-full bg-slate-700 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm" 
                    title={a.full_name}
                  >
                    {a.initials}
                  </div>
                ))
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-gray-400 shadow-sm" title="Unassigned">
                  <span className="text-[14px] mb-1">-</span>
                </div>
              )}
              {assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600 shadow-sm">
                  +{assignees.length - 3}
                </div>
              )}
            </div>

            {/* Meta Icons */}
            <div className="flex gap-2.5 text-gray-400">
              {t.due_date && (
                <div className="flex items-center gap-1" title={`Due: ${format(new Date(t.due_date), 'MMM d')}`}>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              )}
              {/* Optional UI placeholders for features added in Phase 9 */}
              <div className="flex items-center gap-1" title="Comments">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
            </div>
            
          </div>
        </div>
      )}
    </Draggable>
  );
}