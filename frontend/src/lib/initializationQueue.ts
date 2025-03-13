type QueueTask = {
  task: () => Promise<void>;
  key: string;
  retries: number;
};

export type RetryStatus = {
  key: string;
  attempt: number;
  maxAttempts: number;
  isRetrying: boolean;
};

type RetryListener = (status: RetryStatus) => void;

export class InitializationQueue {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000;
  private activeKeys = new Set<string>();
  private retryListeners: Map<string, RetryListener[]> = new Map();
  private retryStatus: Map<string, RetryStatus> = new Map();
  
  constructor(options?: { maxRetries?: number; retryDelay?: number }) {
    if (options?.maxRetries) {
      this.maxRetries = options.maxRetries;
    }
    if (options?.retryDelay) {
      this.retryDelay = options.retryDelay;
    }
  }
  
  async enqueue(task: () => Promise<void>, key: string) {
    if (this.activeKeys.has(key)) {
      console.debug(`Task ${key} already in queue`);
      return;
    }
    
    this.activeKeys.add(key);
    this.queue.push({ task, key, retries: 0 });
    
    this.retryStatus.set(key, {
      key,
      attempt: 0,
      maxAttempts: this.maxRetries,
      isRetrying: false
    });
    
    if (!this.isProcessing) {
      await this.process();
    }
  }
  
  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const queueItem = this.queue[0];
    
    try {
      while (queueItem.retries < this.maxRetries) {
        try {
          const status: RetryStatus = {
            key: queueItem.key,
            attempt: queueItem.retries,
            maxAttempts: this.maxRetries,
            isRetrying: queueItem.retries > 0
          };
          this.retryStatus.set(queueItem.key, status);
          this.notifyListeners(queueItem.key, status);
          
          await queueItem.task();
          
          this.queue.shift();
          this.activeKeys.delete(queueItem.key);
          
          this.retryStatus.delete(queueItem.key);
          this.notifyListeners(queueItem.key, {
            key: queueItem.key,
            attempt: 0,
            maxAttempts: this.maxRetries,
            isRetrying: false
          });
          
          break;
        } catch (error) {
          queueItem.retries++;
          console.debug(`Task ${queueItem.key} failed, attempt ${queueItem.retries}/${this.maxRetries}:`, error);
          
          if (queueItem.retries === this.maxRetries) {
            this.queue.shift();
            this.activeKeys.delete(queueItem.key);
            
            const finalStatus: RetryStatus = {
              key: queueItem.key,
              attempt: queueItem.retries,
              maxAttempts: this.maxRetries,
              isRetrying: false
            };
            this.retryStatus.set(queueItem.key, finalStatus);
            this.notifyListeners(queueItem.key, finalStatus);
            
            console.error(`Task ${queueItem.key} failed after ${this.maxRetries} attempts:`, error);
          } else {
            const retryStatus: RetryStatus = {
              key: queueItem.key,
              attempt: queueItem.retries,
              maxAttempts: this.maxRetries,
              isRetrying: true
            };
            this.retryStatus.set(queueItem.key, retryStatus);
            this.notifyListeners(queueItem.key, retryStatus);
            
            const delay = this.retryDelay * Math.pow(2, queueItem.retries - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        await this.process();
      }
    }
  }
  
  clear() {
    for (const [key, status] of this.retryStatus.entries()) {
      const clearedStatus: RetryStatus = {
        ...status,
        isRetrying: false
      };
      this.notifyListeners(key, clearedStatus);
    }
    
    this.queue = [];
    this.activeKeys.clear();
    this.retryStatus.clear();
    this.isProcessing = false;
  }
  
  addRetryListener(key: string, listener: RetryListener): () => void {
    if (!this.retryListeners.has(key)) {
      this.retryListeners.set(key, []);
    }
    
    this.retryListeners.get(key)!.push(listener);
    
    return () => {
      const listeners = this.retryListeners.get(key);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
        
        if (listeners.length === 0) {
          this.retryListeners.delete(key);
        }
      }
    };
  }
  
  getRetryStatus(key: string): RetryStatus | undefined {
    return this.retryStatus.get(key);
  }
  
  private notifyListeners(key: string, status: RetryStatus) {
    const listeners = this.retryListeners.get(key);
    if (listeners) {
      listeners.forEach(listener => listener(status));
    }
  }
}

export const authQueue = new InitializationQueue();
export const pontoQueue = new InitializationQueue();
export const slackQueue = new InitializationQueue();

export const initializationQueue = new InitializationQueue();