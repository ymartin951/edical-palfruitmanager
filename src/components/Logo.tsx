interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'full' | 'icon';
  className?: string;
}

export function Logo({ size = 'medium', variant = 'full', className = '' }: LogoProps) {
  const sizeConfig = {
    small: {
      width: variant === 'icon' ? 'w-10' : 'w-32',
      height: variant === 'icon' ? 'h-10' : 'h-auto',
    },
    medium: {
      width: variant === 'icon' ? 'w-16' : 'w-48',
      height: variant === 'icon' ? 'h-16' : 'h-auto',
    },
    large: {
      width: variant === 'icon' ? 'w-20' : 'w-64',
      height: variant === 'icon' ? 'h-20' : 'h-auto',
    },
  };

  const { width, height } = sizeConfig[size];

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/edical-logo.png"
        alt="Edical Palm Fruit Company LTD"
        className={`${width} ${height} object-contain`}
      />
    </div>
  );
}
