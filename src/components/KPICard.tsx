import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  bgColor: string;
  to?: string;
  disabled?: boolean;
}

export function KPICard({ title, value, subtext, icon: Icon, bgColor, to, disabled = false }: KPICardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to && !disabled) {
      navigate(to);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && to && !disabled) {
      e.preventDefault();
      navigate(to);
    }
  };

  const isClickable = to && !disabled;

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyPress}
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-disabled={disabled}
      className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 border-brand-muted/20 transition-all ${
        isClickable
          ? 'cursor-pointer hover:shadow-xl hover:scale-105 active:scale-95'
          : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`${bgColor} p-3 rounded-lg shadow-md`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <h3 className="text-brand-secondary text-xs sm:text-sm font-semibold mb-1 uppercase tracking-wide">
          {title}
        </h3>
        <p className="text-xl sm:text-2xl font-bold text-brand-text">{value}</p>
        {subtext && (
          <p className="text-xs text-gray-500 mt-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}
