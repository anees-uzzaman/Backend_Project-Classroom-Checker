import { useEffect, useState } from 'react';
import { IconCheck, IconInfo, IconClose } from './icons';
import './App.css';

export default function Toast({ message, type = 'success', onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: IconCheck,
    error: IconX,
    info: IconInfo
  };

  const Icon = icons[type] || IconInfo;

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : 'toast-hidden'}`}>
      <span className="toast-icon"><Icon /></span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}>
        <IconClose />
      </button>
    </div>
  );
}