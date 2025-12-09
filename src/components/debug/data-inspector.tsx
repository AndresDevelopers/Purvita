'use client';

import { useState } from 'react';

interface DataInspectorProps {
  label: string;
  data: unknown;
}

export function DataInspector({ label, data }: DataInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-purple-700"
      >
        🐛 {label}
      </button>
      
      {isOpen && (
        <div className="absolute bottom-14 right-0 max-h-96 w-96 overflow-auto rounded-lg border border-purple-300 bg-white p-4 shadow-xl dark:border-purple-700 dark:bg-gray-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-purple-600 dark:text-purple-400">{label}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <pre className="overflow-auto text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Timestamp: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
