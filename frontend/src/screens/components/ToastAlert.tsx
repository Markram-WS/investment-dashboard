import React, { useEffect } from "react";

interface ToastAlertProps {
  message: string;
  type?: "warning" | "danger" | "success";
  onClose: () => void;
}

const typeStyles: Record<string, string> = {
  warning: "bg-yellow-50 border-yellow-400 text-yellow-800",
  danger: "bg-red-50 border-red-400 text-red-800",
  success: "bg-green-50 border-green-400 text-green-800",
};

const ToastAlert: React.FC<ToastAlertProps> = ({ message, type = "warning", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl border-l-2 rounded-md px-4 py-3 shadow-2xl ${typeStyles[type]}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm flex-1">{message}</span>
        <button onClick={onClose} className="text-current opacity-50 hover:opacity-100 text-lg leading-none">&times;</button>
      </div>
    </div>
  );
};

export default ToastAlert;
