package slack

import (
	"context"
	"fmt"
)

// GerenciadorOperacoes implementa a interface OperacoesSlack
type GerenciadorOperacoes struct {
	status   GerenciadorStatus
	mensagem GerenciadorMensagem
	sessao   GerenciadorSessao
}

// NovoGerenciadorOperacoes cria uma nova instância de GerenciadorOperacoes
func NovoGerenciadorOperacoes(ctx context.Context, config Configuracao) (*GerenciadorOperacoes, error) {
	sessao := NovaSessaoSlack(ctx, config.ModoSilencioso)
	if sessao == nil {
		return nil, fmt.Errorf("falha ao criar sessão do slack")
	}

	return &GerenciadorOperacoes{
		status:   sessao,
		mensagem: sessao,
		sessao:   sessao,
	}, nil
}

// OperacaoStatus executa uma operação de status com validação de sessão apropriada
func (o *GerenciadorOperacoes) OperacaoStatus(operacao func() error) error {
	if err := o.sessao.ValidarSessao(); err != nil {
		return fmt.Errorf("erro de sessão: %w", err)
	}
	return operacao()
}

// OperacaoMensagem executa uma operação de mensagem com validação de sessão apropriada
func (o *GerenciadorOperacoes) OperacaoMensagem(operacao func() error) error {
	if err := o.sessao.ValidarSessao(); err != nil {
		return fmt.Errorf("erro de sessão: %w", err)
	}
	return operacao()
}

// DefinirStatus implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) DefinirStatus(status Status) error {
	return o.OperacaoStatus(func() error {
		return o.status.DefinirStatus(status)
	})
}

// LimparStatus implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) LimparStatus() error {
	return o.OperacaoStatus(func() error {
		return o.status.LimparStatus()
	})
}

// ObterStatusAtual implementa a interface GerenciadorStatus
func (o *GerenciadorOperacoes) ObterStatusAtual() (*Status, error) {
	var status *Status
	err := o.OperacaoStatus(func() error {
		var err error
		status, err = o.status.ObterStatusAtual()
		return err
	})
	return status, err
}

// EnviarMensagem implementa a interface GerenciadorMensagem
func (o *GerenciadorOperacoes) EnviarMensagem(msg string) error {
	return o.OperacaoMensagem(func() error {
		return o.mensagem.EnviarMensagem(msg)
	})
}

// PrepararMensagem implementa a interface GerenciadorMensagem
func (o *GerenciadorOperacoes) PrepararMensagem(tipoMensagem string) (bool, string, error) {
	var confirmado bool
	var msg string
	err := o.OperacaoMensagem(func() error {
		var err error
		confirmado, msg, err = o.mensagem.PrepararMensagem(tipoMensagem)
		return err
	})
	return confirmado, msg, err
}

// ValidarSessao implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) ValidarSessao() error {
	return o.sessao.ValidarSessao()
}

// SalvarCookies implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) SalvarCookies(diretorio string) error {
	return o.sessao.SalvarCookies(diretorio)
}

// CarregarCookies implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) CarregarCookies(diretorio string) error {
	return o.sessao.CarregarCookies(diretorio)
}

// Autenticar implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) Autenticar() error {
	return o.sessao.Autenticar()
}

// Close implementa a interface GerenciadorSessao
func (o *GerenciadorOperacoes) Close() {
	o.sessao.Close()
}
