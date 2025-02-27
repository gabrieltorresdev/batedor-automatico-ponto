package slack

import (
	"context"
	"fmt"
	"sync"
)

// GerenciadorOperacoes implementa a interface OperacoesSlack
type GerenciadorOperacoes struct {
	ctx         context.Context
	pool        *SessionPool
	mu          sync.Mutex
	sessao      *SessaoSlack
	statusCache *StatusCache
}

// NovoGerenciadorOperacoes cria uma nova instância de GerenciadorOperacoes
func NovoGerenciadorOperacoes(ctx context.Context, config Configuracao) (*GerenciadorOperacoes, error) {
	pool := NewSessionPool(config)

	return &GerenciadorOperacoes{
		ctx:         ctx,
		pool:        pool,
		statusCache: NewStatusCache(),
	}, nil
}

// getSessao obtém uma sessão do pool
func (o *GerenciadorOperacoes) getSessao() (*SessaoSlack, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.sessao != nil {
		return o.sessao, nil
	}

	sessao, err := o.pool.AcquireSession(o.ctx)
	if err != nil {
		return nil, fmt.Errorf("erro ao obter sessão: %w", err)
	}

	o.sessao = sessao
	return sessao, nil
}

// releaseSessao libera a sessão atual de volta para o pool
func (o *GerenciadorOperacoes) releaseSessao() {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.sessao != nil {
		o.pool.ReleaseSession(o.sessao)
		o.sessao = nil
	}
}

// OperacaoStatus executa uma operação de status com validação de sessão apropriada
func (o *GerenciadorOperacoes) OperacaoStatus(operacao func(*SessaoSlack) error) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	if err := sessao.ValidarSessao(); err != nil {
		return fmt.Errorf("erro de sessão: %w", err)
	}

	return operacao(sessao)
}

// OperacaoMensagem executa uma operação de mensagem com validação de sessão apropriada
func (o *GerenciadorOperacoes) OperacaoMensagem(operacao func(*SessaoSlack) error) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	if err := sessao.ValidarSessao(); err != nil {
		return fmt.Errorf("erro de sessão: %w", err)
	}

	return operacao(sessao)
}

// DefinirStatus implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) DefinirStatus(status Status) error {
	// Verifica se o status atual é igual ao desejado
	currentStatus := o.statusCache.Get()
	if currentStatus != nil &&
		currentStatus.Emoji == status.Emoji &&
		currentStatus.Mensagem == status.Mensagem {
		return nil // Status já está como desejado
	}

	err := o.OperacaoStatus(func(s *SessaoSlack) error {
		if err := s.DefinirStatus(status); err != nil {
			return err
		}
		o.statusCache.Set(&status)
		return nil
	})

	if err != nil {
		o.statusCache.Clear() // Limpa o cache em caso de erro
	}

	return err
}

// LimparStatus implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) LimparStatus() error {
	// Se o cache indica que não há status, não precisa limpar
	if o.statusCache.Get() == nil {
		return nil
	}

	err := o.OperacaoStatus(func(s *SessaoSlack) error {
		if err := s.LimparStatus(); err != nil {
			return err
		}
		o.statusCache.Clear()
		return nil
	})

	if err != nil {
		o.statusCache.Clear() // Garante que o cache está limpo em caso de erro
	}

	return err
}

// ObterStatusAtual implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) ObterStatusAtual() (*Status, error) {
	// Tenta obter do cache primeiro
	if cachedStatus := o.statusCache.Get(); cachedStatus != nil {
		return cachedStatus, nil
	}

	var status *Status
	err := o.OperacaoStatus(func(s *SessaoSlack) error {
		var err error
		status, err = s.ObterStatusAtual()
		if err != nil {
			return err
		}
		o.statusCache.Set(status)
		return nil
	})

	if err != nil {
		o.statusCache.Clear()
		return nil, err
	}

	return status, nil
}

// EnviarMensagem implementa a interface GerenciadorMensagem
func (o *GerenciadorOperacoes) EnviarMensagem(msg string) error {
	return o.OperacaoMensagem(func(s *SessaoSlack) error {
		return s.EnviarMensagem(msg)
	})
}

// ValidarSessao implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) ValidarSessao() error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.ValidarSessao()
}

// SalvarCookies implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) SalvarCookies(diretorio string) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.SalvarCookies(diretorio)
}

// CarregarCookies implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) CarregarCookies(diretorio string) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.CarregarCookies(diretorio)
}

// Autenticar implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) Autenticar() error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.Autenticar()
}

// Close implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) Close() {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.pool != nil {
		o.pool.Close()
	}
}
