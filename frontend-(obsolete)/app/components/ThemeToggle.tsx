import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const ThemeToggle: React.FC = () => {
  // We'll sync our state with localStorage and the HTML class
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
  // Check for user's preferred theme or previous setting on component mount
  useEffect(() => {
    // This matches the recommended logic from Tailwind v4 docs
    const isDark = 
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDarkMode(isDark);
    
    // No need to toggle here, the inline script in layout.tsx handles initial state
  }, []);
  
  // Handle theme toggle
  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      // User explicitly chooses dark mode
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      // User explicitly chooses light mode
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };
  
  return (
    <button
      onClick={toggleTheme}
      className="h-full w-9 flex items-center justify-center rounded-lg bg-neutral-50 dark:bg-neutral-700/30 border border-gray-300 dark:border-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-600/50 transition-colors"
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon for light mode */}
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ 
            opacity: isDarkMode ? 0 : 1,
            rotate: isDarkMode ? 90 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 w-full h-full text-amber-500"
          style={{ opacity: isDarkMode ? 0 : 1 }}
        >
          <circle cx="12" cy="12" r="5" stroke="currentColor" />
          <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" />
          <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" />
          <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" />
          <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" />
        </motion.svg>
        
        {/* Moon icon for dark mode */}
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ 
            opacity: isDarkMode ? 1 : 0,
            rotate: isDarkMode ? 0 : -90,
          }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 w-full h-full text-indigo-300"
          style={{ opacity: isDarkMode ? 1 : 0 }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" />
        </motion.svg>
      </div>
    </button>
  );
};

export default ThemeToggle; 