import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChildAvatarProps {
  name?: string;
  avatarId?: string;
  photoUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const ChildAvatar: React.FC<ChildAvatarProps> = ({ name, avatarId, photoUrl, className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-lg',
  };

  const fallback = name?.[0] || '?';

  return (
    <div className={cn(
      "rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold overflow-hidden border-2 border-primary-200 shrink-0",
      sizeClasses[size],
      className
    )}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : avatarId ? (
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarId}`}
          alt="avatar"
          className="w-full h-full object-cover"
        />
      ) : (
        fallback
      )}
    </div>
  );
};

export default ChildAvatar;
