"use client";

const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-spinner {
    animation: spin 1s linear infinite;
  }
`;

interface LoadingOrErrorProps {
  message: string;
  isError?: boolean;
}

const LoadingOrError = ({ message, isError = false }: LoadingOrErrorProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] bg-background text-foreground p-4">
      <>
        <style>{spinnerStyle}</style>
        <div className="mb-4">
          <div
            className={`w-12 h-12 rounded-full border-4 ${isError ? "border-destructive" : "border-primary"} border-t-transparent loading-spinner`}
          />
        </div>
      </>
      <h2
        className={`text-xl font-semibold ${isError ? "text-destructive" : ""}`}
      >
        {isError ? "An Error Occurred" : "Loading"}
      </h2>
      <p className="text-muted-foreground mt-2" suppressHydrationWarning>
        {message}
      </p>
    </div>
  );
};

export default LoadingOrError;
