package slack

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type GerenciadorOperacoes struct {
	ctx         context.Context
	pool        *SessionPool
	mu          sync.Mutex
	sessao      *SessaoSlack
	statusCache *StatusCache
}

func NovoGerenciadorOperacoes(ctx context.Context, config Configuracao) (*GerenciadorOperacoes, error) {
	pool := NewSessionPool(config)

	return &GerenciadorOperacoes{
		ctx:         ctx,
		pool:        pool,
		statusCache: NewStatusCache(),
	}, nil
}

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

func (o *GerenciadorOperacoes) releaseSessao() {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.sessao != nil {
		o.pool.ReleaseSession(o.sessao)
		o.sessao = nil
	}
}

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

func (o *GerenciadorOperacoes) DefinirStatus(status Status) error {
	currentStatus := o.statusCache.Get()
	if currentStatus != nil &&
		currentStatus.Emoji == status.Emoji &&
		currentStatus.Mensagem == status.Mensagem {
		return nil
	}

	err := o.OperacaoStatus(func(s *SessaoSlack) error {
		if err := s.DefinirStatus(status); err != nil {
			return err
		}
		o.statusCache.Set(&status)
		return nil
	})

	if err != nil {
		o.statusCache.Clear()
	}

	return err
}

func (o *GerenciadorOperacoes) LimparStatus() error {
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
		o.statusCache.Clear()
	}

	return err
}

func (o *GerenciadorOperacoes) ObterStatusAtual() (*Status, error) {
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

func (o *GerenciadorOperacoes) EnviarMensagem(msg string) error {
	return o.OperacaoMensagem(func(s *SessaoSlack) error {
		return s.EnviarMensagem(msg)
	})
}

func (o *GerenciadorOperacoes) ValidarSessao() error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.ValidarSessao()
}

func (o *GerenciadorOperacoes) SalvarCookies(diretorio string) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.SalvarCookies(diretorio)
}

func (o *GerenciadorOperacoes) CarregarCookies(diretorio string) error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.CarregarCookies(diretorio)
}

func (o *GerenciadorOperacoes) Autenticar() error {
	sessao, err := o.getSessao()
	if err != nil {
		return err
	}
	defer o.releaseSessao()

	return sessao.Autenticar()
}

func (o *GerenciadorOperacoes) Close() {
	o.mu.Lock()
	poolTemp := o.pool
	o.pool = nil
	o.mu.Unlock()

	if poolTemp != nil {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("Pânico recuperado ao fechar pool de sessões: %v\n", r)
				}
			}()

			done := make(chan struct{})
			go func() {
				defer close(done)
				poolTemp.Close()
			}()

			select {
			case <-done:
			case <-time.After(3 * time.Second):
				fmt.Println("Timeout ao fechar pool de sessões do Slack")
			}
		}()
	}
}
