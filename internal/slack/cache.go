package slack

import (
	"sync"
	"time"
)

const (
	statusCacheDuration = 10 * time.Second
)

type StatusCache struct {
	mu          sync.RWMutex
	status      *Status
	lastUpdated time.Time
}

func NewStatusCache() *StatusCache {
	return &StatusCache{}
}

func (c *StatusCache) Get() *Status {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.status == nil || time.Since(c.lastUpdated) > statusCacheDuration {
		return nil
	}

	return &Status{
		Emoji:    c.status.Emoji,
		Mensagem: c.status.Mensagem,
	}
}

func (c *StatusCache) Set(status *Status) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if status == nil {
		c.status = nil
	} else {
		c.status = &Status{
			Emoji:    status.Emoji,
			Mensagem: status.Mensagem,
		}
	}
	c.lastUpdated = time.Now()
}

func (c *StatusCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.status = nil
	c.lastUpdated = time.Time{}
}
