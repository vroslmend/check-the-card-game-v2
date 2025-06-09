/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns The debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttles a function to execute at most once every `limit` milliseconds
 * 
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns The throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number = 0;
  
  return function(...args: Parameters<T>) {
    if (Date.now() - lastRan >= limit) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        lastRan = Date.now();
        func(...args);
      }, limit - (Date.now() - lastRan));
    }
  };
}; 