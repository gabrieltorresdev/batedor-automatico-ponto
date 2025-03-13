import { useState, useEffect } from 'react';
import { 
  initializationQueue, 
  authQueue, 
  pontoQueue, 
  slackQueue, 
  RetryStatus,
  InitializationQueue
} from '@/lib/initializationQueue';

export type QueueType = 'default' | 'auth' | 'ponto' | 'slack';

export const useRetryStatus = (key: string, queueType: QueueType = 'default') => {
  const getQueue = (): InitializationQueue => {
    switch (queueType) {
      case 'auth':
        return authQueue;
      case 'ponto':
        return pontoQueue;
      case 'slack':
        return slackQueue;
      default:
        return initializationQueue;
    }
  };

  const queue = getQueue();
  
  const [status, setStatus] = useState<RetryStatus | undefined>(
    queue.getRetryStatus(key)
  );

  useEffect(() => {
    const removeListener = queue.addRetryListener(key, (newStatus) => {
      setStatus(newStatus);
    });

    return removeListener;
  }, [key, queue]);

  return status;
};