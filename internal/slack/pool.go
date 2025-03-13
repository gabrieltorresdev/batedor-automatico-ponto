package slack

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const (
	maxPoolSize     = 3
	sessionTimeout  = 60 * 8
	cleanupInterval = 5
)

type SessionInfo struct {
	sessao    *SessaoSlack
	lastUsed  time.Time
	inUse     bool
	cancelCtx context.CancelFunc
}

type SessionPool struct {
	mu            sync.RWMutex
	sessions      map[string]*SessionInfo
	config        Configuracao
	cleanupTicker *time.Ticker
	wg            sync.WaitGroup
}

func NewSessionPool(config Configuracao) *SessionPool {
	pool := &SessionPool{
		sessions:      make(map[string]*SessionInfo),
		config:        config,
		cleanupTicker: time.NewTicker(cleanupInterval * time.Minute),
	}

	pool.wg.Add(1)
	go pool.cleanupRoutine()

	return pool
}

func (p *SessionPool) AcquireSession(ctx context.Context) (*SessaoSlack, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for id, info := range p.sessions {
		if !info.inUse && time.Since(info.lastUsed) < sessionTimeout*time.Minute {
			info.inUse = true
			info.lastUsed = time.Now()
			return info.sessao, nil
		}
		if time.Since(info.lastUsed) >= sessionTimeout*time.Minute {
			p.removeSession(id)
		}
	}

	if len(p.sessions) < maxPoolSize {
		return p.createNewSession(ctx)
	}

	return nil, fmt.Errorf("não há sessões disponíveis no momento")
}

func (p *SessionPool) ReleaseSession(sessao *SessaoSlack) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, info := range p.sessions {
		if info.sessao == sessao {
			info.inUse = false
			info.lastUsed = time.Now()
			return
		}
	}
}

func (p *SessionPool) createNewSession(ctx context.Context) (*SessaoSlack, error) {
	sessionCtx, cancel := context.WithCancel(ctx)
	sessao := NovaSessaoSlack(sessionCtx, p.config.ModoSilencioso)
	if sessao == nil {
		cancel()
		return nil, fmt.Errorf("falha ao criar nova sessão")
	}

	if err := sessao.CarregarCookies(p.config.DiretorioConfig); err != nil {
		fmt.Printf("\nCookies do Slack não encontrados ou inválidos.\n")
	}

	id := fmt.Sprintf("session_%d", len(p.sessions))
	p.sessions[id] = &SessionInfo{
		sessao:    sessao,
		lastUsed:  time.Now(),
		inUse:     true,
		cancelCtx: cancel,
	}

	return sessao, nil
}

func (p *SessionPool) removeSession(id string) {
	if info, exists := p.sessions[id]; exists {
		info.sessao.Close()
		info.cancelCtx()
		delete(p.sessions, id)
	}
}

func (p *SessionPool) cleanupRoutine() {
	defer p.wg.Done()

	for range p.cleanupTicker.C {
		p.mu.Lock()
		for id, info := range p.sessions {
			if time.Since(info.lastUsed) >= sessionTimeout*time.Minute && !info.inUse {
				p.removeSession(id)
			}
		}
		p.mu.Unlock()
	}
}

func (p *SessionPool) Close() {
	if p.cleanupTicker != nil {
		p.cleanupTicker.Stop()
		p.cleanupTicker = nil
	}

	p.mu.Lock()
	ids := make([]string, 0, len(p.sessions))
	for id := range p.sessions {
		ids = append(ids, id)
	}
	p.mu.Unlock()

	for _, id := range ids {
		p.mu.Lock()
		info, exists := p.sessions[id]
		if !exists {
			p.mu.Unlock()
			continue
		}

		sessao := info.sessao
		cancelCtx := info.cancelCtx

		delete(p.sessions, id)
		p.mu.Unlock()

		if sessao != nil {
			done := make(chan struct{})
			go func() {
				defer close(done)
				if sessao != nil {
					defer func() {
						if r := recover(); r != nil {
							fmt.Printf("Pânico recuperado ao fechar sessão: %v\n", r)
						}
					}()
					sessao.Close()
				}
			}()

			select {
			case <-done:
			case <-time.After(1 * time.Second):
				fmt.Printf("Timeout ao fechar sessão %s\n", id)
			}
		}

		if cancelCtx != nil {
			cancelCtx()
		}
	}

	doneChan := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(doneChan)
	}()

	select {
	case <-doneChan:
	case <-time.After(2 * time.Second):
		fmt.Println("Timeout ao aguardar rotina de limpeza do pool")
	}
}
