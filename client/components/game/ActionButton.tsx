import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Action } from './ActionBarComponent';

interface ActionButtonProps {
  action: Action;
}

const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const {
    label,
    onClick,
    disabled = false,
    icon,
    className = '',
    isLoading = false,
    isProgressButton = false,
    progressPercent = 0,
    progressFillClassName = 'bg-blue-500',
    progressLabelClassName = 'text-blue-300'
  } = action;

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      {/* Icon */}
      {icon && (
        <span className="relative flex">
          {icon}
        </span>
      )}
      
      {/* Label */}
      <span className={isProgressButton && progressPercent > 0 ? progressLabelClassName : ''}>
        {label}
      </span>
      
      {/* Loading Spinner */}
      {isLoading && (
        <Loader2 className="h-3 w-3 animate-spin ml-1" />
      )}
      
      {/* Progress Overlay */}
      {isProgressButton && progressPercent > 0 && (
        <motion.div 
          className={`absolute inset-0 rounded-full ${progressFillClassName}`}
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
          style={{ 
            transformOrigin: 'left',
            zIndex: -1,
          }}
        />
      )}
    </motion.button>
  );
};

export default ActionButton; 