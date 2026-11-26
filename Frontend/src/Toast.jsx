import { useEffect, useState } from 'react';
import { IconCheck, IconInfo, IconClose, IconX } from './icons';
import './App.css';

export default function Toast({ message, type = 'success', onClose }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 250);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onClose, isPaused]);

  const icons = {
    success: IconCheck,
    error: IconX,
    info: IconInfo
  };

  const Icon = icons[type] || IconInfo;

  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={`toast toast-${type} ${isVisible ? 'toast-visible' : 'toast-hidden'}`}
    >
      <span className="toast-icon" aria-hidden="true"><Icon /></span>
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 250);
        }}
      >
        <IconClose />
      </button>
    </div>
  );
}
