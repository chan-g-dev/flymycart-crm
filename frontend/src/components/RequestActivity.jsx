import { useEffect, useState, useSyncExternalStore } from 'react';
import { requestActivity } from '../utils/requestActivity';
import { LoadingSpinner } from './LoadingSpinner';

export default function RequestActivity() {
    const { count, message } = useSyncExternalStore(requestActivity.subscribe, requestActivity.getSnapshot, requestActivity.getSnapshot);
    const [visible, setVisible] = useState(false);
    const busy = count > 0;
    useEffect(() => {
        const timer = setTimeout(() => setVisible(busy), busy ? 180 : 120);
        return () => clearTimeout(timer);
    }, [busy]);
    if (!visible || !busy) return null;
    return <div className="fmc-request-activity"><LoadingSpinner inline size="sm" text={message} /></div>;
}
