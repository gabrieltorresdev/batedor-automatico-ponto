package slack

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const (
	maxPoolSize     = 3      // Máximo de sessões simultâneas
	sessionTimeout  = 60 * 8 // Tempo em minutos para expirar uma sessão
	cleanupInterval = 5      // Intervalo em minutos para limpar sessões expiradas
)

// SessionInfo mantém informações sobre uma sessão
type SessionInfo struct {
	sessao    *SessaoSlack
	lastUsed  time.Time
	inUse     bool
	cancelCtx context.CancelFunc
}

// SessionPool gerencia um pool de sessões do Slack
type SessionPool struct {
	mu            sync.RWMutex
	sessions      map[string]*SessionInfo
	config        Configuracao
	cleanupTicker *time.Ticker
	wg            sync.WaitGroup
}

// NewSessionPool cria um novo pool de sessões
func NewSessionPool(config Configuracao) *SessionPool {
	pool := &SessionPool{
		sessions:      make(map[string]*SessionInfo),
		config:        config,
		cleanupTicker: time.NewTicker(cleanupInterval * time.Minute),
	}

	// Inicia a rotina de limpeza
	pool.wg.Add(1)
	go pool.cleanupRoutine()

	return pool
}

// AcquireSession obtém uma sessão do pool
func (p *SessionPool) AcquireSession(ctx context.Context) (*SessaoSlack, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Procura uma sessão disponível
	for id, info := range p.sessions {
		if !info.inUse && time.Since(info.lastUsed) < sessionTimeout*time.Minute {
			info.inUse = true
			info.lastUsed = time.Now()
			return info.sessao, nil
		}
		// Se a sessão está muito antiga, remove
		if time.Since(info.lastUsed) >= sessionTimeout*time.Minute {
			p.removeSession(id)
		}
	}

	// Se não há sessões disponíveis e não atingimos o limite, cria uma nova
	if len(p.sessions) < maxPoolSize {
		return p.createNewSession(ctx)
	}

	return nil, fmt.Errorf("não há sessões disponíveis no momento")
}

// ReleaseSession libera uma sessão de volta para o pool
func (p *SessionPool) ReleaseSession(sessao *SessaoSlack) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Procura a sessão no pool
	for _, info := range p.sessions {
		if info.sessao == sessao {
			info.inUse = false
			info.lastUsed = time.Now()
			return
		}
	}
}

// createNewSession cria uma nova sessão e adiciona ao pool
func (p *SessionPool) createNewSession(ctx context.Context) (*SessaoSlack, error) {
	sessionCtx, cancel := context.WithCancel(ctx)
	sessao := NovaSessaoSlack(sessionCtx, p.config.ModoSilencioso)
	if sessao == nil {
		cancel()
		return nil, fmt.Errorf("falha ao criar nova sessão")
	}

	// Tenta carregar cookies
	if err := sessao.CarregarCookies(p.config.DiretorioConfig); err != nil {
		fmt.Printf("\nCookies do Slack não encontrados ou inválidos. Será preciso autenticar novamente.\n")
	}

	// Adiciona a sessão ao pool
	id := fmt.Sprintf("session_%d", len(p.sessions))
	p.sessions[id] = &SessionInfo{
		sessao:    sessao,
		lastUsed:  time.Now(),
		inUse:     true,
		cancelCtx: cancel,
	}

	return sessao, nil
}

// removeSession remove uma sessão do pool
func (p *SessionPool) removeSession(id string) {
	if info, exists := p.sessions[id]; exists {
		info.sessao.Close()
		info.cancelCtx()
		delete(p.sessions, id)
	}
}

// cleanupRoutine limpa sessões expiradas periodicamente
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

// Close fecha todas as sessões e para o pool
func (p *SessionPool) Close() {
	p.cleanupTicker.Stop()

	p.mu.Lock()
	defer p.mu.Unlock()

	for id := range p.sessions {
		p.removeSession(id)
	}

	p.wg.Wait()
}
