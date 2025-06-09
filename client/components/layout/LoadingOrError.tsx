'use client';

import { motion } from 'framer-motion';

interface LoadingOrErrorProps {
  message: string;
  isError?: boolean;
}

const LoadingOrError = ({ message, isError = false }: LoadingOrErrorProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] bg-background text-foreground p-4">
      <motion.div
        className="mb-4"
        animate={{ rotate: 360 }}
        transition={{ loop: Infinity, ease: "linear", duration: 1 }}
      >
        <div className={`w-12 h-12 rounded-full border-4 ${isError ? 'border-destructive' : 'border-primary'} border-t-transparent`} />
      </motion.div>
      <h2 className={`text-xl font-semibold ${isError ? 'text-destructive' : ''}`}>
        {isError ? 'An Error Occurred' : 'Loading'}
      </h2>
      <p className="text-muted-foreground mt-2">{message}</p>
    </div>
  );
};

export default LoadingOrError; 