import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';

interface RowActionsMenuProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showView?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function RowActionsMenu({
  onView,
  onEdit,
  onDelete,
  showView = !!onView,
  showEdit = !!onEdit,
  showDelete = !!onDelete,
  disabled = false,
  size = 'md',
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'p-1' : 'p-2';
  const menuItemSize = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  const hasActions = (showView && onView) || (showEdit && onEdit) || (showDelete && onDelete);

  if (!hasActions) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef} style={{ pointerEvents: 'auto' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`${buttonSize} hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Actions menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{ pointerEvents: 'auto', zIndex: 10 }}
      >
        <MoreVertical className={`${iconSize} text-gray-600`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30"
            role="menu"
          >
            {showView && onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(onView);
                }}
                className={`w-full ${menuItemSize} text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700`}
                role="menuitem"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
            )}
            {showEdit && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(onEdit);
                }}
                className={`w-full ${menuItemSize} text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700`}
                role="menuitem"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            {showDelete && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(onDelete);
                }}
                className={`w-full ${menuItemSize} text-left hover:bg-red-50 flex items-center gap-2 text-red-600`}
                role="menuitem"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
