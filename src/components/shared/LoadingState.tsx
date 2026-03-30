import React from "react";
import { RefreshCcw } from "lucide-react";

interface LoadingStateProps {
  text?: string;
  fullScreen?: boolean;
}

export function LoadingState({ text = "Loading...", fullScreen = false }: LoadingStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <RefreshCcw className="w-10 h-10 animate-spin text-orange-500" />
      <p className="text-white/40 font-medium animate-pulse uppercase tracking-widest text-xs">{text}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full py-12">
      {content}
    </div>
  );
}
