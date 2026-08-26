import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { safeErrorMessage } from "../../utils/apiError";

export default function ErrorAlert({
  message,
  onRetry,
  onDismiss,
  title = "API Error",
  autoDismissDuration = 5000,
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (message && autoDismissDuration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, autoDismissDuration);
      return () => clearTimeout(timer);
    }
  }, [message, autoDismissDuration, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 my-3 animate-fade-in transition-all">
      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <h4 className="font-semibold text-rose-100 mb-0.5">{title}</h4>
        <p className="opacity-90">{safeErrorMessage(message)}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          if (onDismiss) onDismiss();
        }}
        className="text-rose-400 hover:text-rose-200 p-0.5 transition-colors shrink-0"
        aria-label="Dismiss error"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
