import React from 'react';

interface SidePanelProps {
  // Props for game log and chat will be added here later
}

const SidePanel = ({}: SidePanelProps) => {
  return (
    <div className="w-80 h-full bg-background border-l border-border flex flex-col">
      <div className="flex-grow p-4">
        <h2 className="text-lg font-bold text-foreground mb-4">[Activity Log]</h2>
        {/* Game log content will go here */}
        <p className="text-sm text-muted-foreground">Game started...</p>
      </div>
      <div className="p-4 border-t border-border">
        <h2 className="text-lg font-bold text-foreground mb-4">[Chat]</h2>
        {/* Chat content will go here */}
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      </div>
    </div>
  );
};

export default SidePanel; 