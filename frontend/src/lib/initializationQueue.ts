type QueueTask = {
  task: () => Promise<void>;
  key: string;
  retries: number;
};

class InitializationQueue {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000;
  private activeKeys = new Set<string>();
  
  async enqueue(task: () => Promise<void>, key: string) {
    // Se já existe uma tarefa com essa chave, não adiciona
    if (this.activeKeys.has(key)) {
      console.debug(`Task ${key} already in queue`);
      return;
    }
    
    this.activeKeys.add(key);
    this.queue.push({ task, key, retries: 0 });
    
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
          await queueItem.task();
          // Sucesso: remove a tarefa da fila
          this.queue.shift();
          this.activeKeys.delete(queueItem.key);
          break;
        } catch (error) {
          queueItem.retries++;
          console.debug(`Task ${queueItem.key} failed, attempt ${queueItem.retries}/${this.maxRetries}:`, error);
          
          if (queueItem.retries === this.maxRetries) {
            // Máximo de tentativas atingido: remove a tarefa
            this.queue.shift();
            this.activeKeys.delete(queueItem.key);
            console.error(`Task ${queueItem.key} failed after ${this.maxRetries} attempts:`, error);
          } else {
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
    this.queue = [];
    this.activeKeys.clear();
    this.isProcessing = false;
  }
}

// Singleton instance
export const initializationQueue = new InitializationQueue(); 