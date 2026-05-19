import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus, MoreHorizontal } from 'lucide-react';

export default function BoardColumn({ column, tasks, onTaskClick, onAddTask, onEditColumn }) {
  // Generate a consistent color based on the column's ID so they look distinct
  const dotColors = ['bg-gray-400', 'bg-blue-500', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
  const dotColor = dotColors[column.id % dotColors.length];

  return (
    <div className="flex flex-col w-80 shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-1 group">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
          <h3 className="font-semibold text-gray-700 text-sm truncate max-w-[180px]" title={column.column_name}>
            {column.column_name}
          </h3>
          <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        
        {/* Column Options (Rename/Delete) - Will wire this up in Part 2 */}
        {onEditColumn && (
          <button 
            onClick={() => onEditColumn(column)}
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Droppable Area - We MUST convert the integer ID to a string for the drag-and-drop library */}
      <Droppable droppableId={column.id.toString()}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-xl p-2 transition-colors min-h-[500px] flex flex-col ${
              snapshot.isDraggingOver ? 'bg-slate-200/50' : 'bg-transparent'
            }`}
          >
            {tasks.map((task, index) => (
              <TaskCard 
                key={task.task.id} 
                task={task} 
                index={index} 
                onClick={() => onTaskClick(task.task.id)} 
              />
            ))}
            
            {provided.placeholder}

            <button 
              onClick={() => onAddTask(column.id)}
              className="mt-2 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-200/70 p-2 rounded-lg transition-colors w-full"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        )}
      </Droppable>
    </div>
  );
}