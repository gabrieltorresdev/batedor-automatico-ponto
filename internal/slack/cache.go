package slack

import (
	"sync"
	"time"
)

const (
	statusCacheDuration = 10 * time.Second // Duração do cache de status
)

// StatusCache implementa um cache thread-safe para o status do Slack
type StatusCache struct {
	mu          sync.RWMutex
	status      *Status
	lastUpdated time.Time
}

// NewStatusCache cria uma nova instância do cache de status
func NewStatusCache() *StatusCache {
	return &StatusCache{}
}

// Get retorna o status em cache se ainda for válido
func (c *StatusCache) Get() *Status {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.status == nil || time.Since(c.lastUpdated) > statusCacheDuration {
		return nil
	}

	// Retorna uma cópia do status para evitar modificações externas
	return &Status{
		Emoji:    c.status.Emoji,
		Mensagem: c.status.Mensagem,
	}
}

// Set atualiza o status em cache
func (c *StatusCache) Set(status *Status) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if status == nil {
		c.status = nil
	} else {
		// Armazena uma cópia do status
		c.status = &Status{
			Emoji:    status.Emoji,
			Mensagem: status.Mensagem,
		}
	}
	c.lastUpdated = time.Now()
}

// Clear limpa o cache
func (c *StatusCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.status = nil
	c.lastUpdated = time.Time{}
}
