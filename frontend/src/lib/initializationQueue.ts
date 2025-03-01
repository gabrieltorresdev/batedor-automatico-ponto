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

class InitializationQueue {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000;
  private activeKeys = new Set<string>();
  private retryListeners: Map<string, RetryListener[]> = new Map();
  private retryStatus: Map<string, RetryStatus> = new Map();
  
  async enqueue(task: () => Promise<void>, key: string) {
    // Se já existe uma tarefa com essa chave, não adiciona
    if (this.activeKeys.has(key)) {
      console.debug(`Task ${key} already in queue`);
      return;
    }
    
    this.activeKeys.add(key);
    this.queue.push({ task, key, retries: 0 });
    
    // Initialize retry status
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
          // Update retry status before attempt
          const status: RetryStatus = {
            key: queueItem.key,
            attempt: queueItem.retries,
            maxAttempts: this.maxRetries,
            isRetrying: queueItem.retries > 0
          };
          this.retryStatus.set(queueItem.key, status);
          this.notifyListeners(queueItem.key, status);
          
          await queueItem.task();
          
          // Sucesso: remove a tarefa da fila
          this.queue.shift();
          this.activeKeys.delete(queueItem.key);
          
          // Clear retry status on success
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
            // Máximo de tentativas atingido: remove a tarefa
            this.queue.shift();
            this.activeKeys.delete(queueItem.key);
            
            // Update retry status for max retries reached
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
            // Update retry status for next attempt
            const retryStatus: RetryStatus = {
              key: queueItem.key,
              attempt: queueItem.retries,
              maxAttempts: this.maxRetries,
              isRetrying: true
            };
            this.retryStatus.set(queueItem.key, retryStatus);
            this.notifyListeners(queueItem.key, retryStatus);
            
            // Aguarda antes da próxima tentativa (exponential backoff)
            const delay = this.retryDelay * Math.pow(2, queueItem.retries - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } finally {
      this.isProcessing = false;
      // Processa próxima tarefa se houver
      if (this.queue.length > 0) {
        await this.process();
      }
    }
  }
  
  clear() {
    // Clear all retry statuses and notify listeners
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
  
  // Add a listener for retry status updates
  addRetryListener(key: string, listener: RetryListener): () => void {
    if (!this.retryListeners.has(key)) {
      this.retryListeners.set(key, []);
    }
    
    this.retryListeners.get(key)!.push(listener);
    
    // Return a function to remove the listener
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
  
  // Get current retry status for a key
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

// Singleton instance
export const initializationQueue = new InitializationQueue(); 