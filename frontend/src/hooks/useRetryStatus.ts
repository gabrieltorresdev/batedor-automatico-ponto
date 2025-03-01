import { useState, useEffect } from 'react';
import { initializationQueue, RetryStatus } from '@/lib/initializationQueue';

/**
 * Hook to track retry status for a specific initialization task
 * @param key The key of the task to track
 * @returns The current retry status
 */
export const useRetryStatus = (key: string) => {
  const [status, setStatus] = useState<RetryStatus | undefined>(
    initializationQueue.getRetryStatus(key)
  );

  useEffect(() => {
    // Add listener for retry status updates
    const removeListener = initializationQueue.addRetryListener(key, (newStatus) => {
      setStatus(newStatus);
    });

    // Clean up listener on unmount
    return removeListener;
  }, [key]);

  return status;
}; 