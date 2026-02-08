import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer - Mobile Only Full Height */}
      <div className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl">
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-safe">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-gray-200 bg-white pb-safe">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
