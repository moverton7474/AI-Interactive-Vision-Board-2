import React from 'react';

interface Props {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

const EmptyState: React.FC<Props> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default'
}) => {
  if (variant === 'compact') {
    return (
      <div className="text-center py-6 px-4">
        <span className="text-2xl mb-2 block">{icon}</span>
        <p className="text-gray-600 font-medium text-sm">{title}</p>
        <p className="text-gray-400 text-xs mt-1">{description}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-3 text-sm font-semibold text-navy-600 hover:text-navy-800 transition-colors"
          >
            {actionLabel} →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-6">
      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
        <span className="text-4xl">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-xs mx-auto mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-navy-900 text-white font-semibold rounded-full hover:bg-navy-800 transition-colors shadow-md hover:shadow-lg"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
