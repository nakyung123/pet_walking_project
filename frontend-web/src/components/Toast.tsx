'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

export default function Toast({ message, type, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bg =
    type === 'success' ? 'bg-blue-500' :
    type === 'error'   ? 'bg-red-500'  :
                         'bg-gray-700';

  return (
    <div
      className={`
        fixed bottom-32 left-1/2 -translate-x-1/2 z-50
        ${bg} text-white text-sm font-medium
        px-5 py-3 rounded-2xl shadow-lg
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      {message}
    </div>
  );
}
