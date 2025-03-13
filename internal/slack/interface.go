package slack

import (
	"context"
	"fmt"
)

type GerenciadorStatus interface {
	DefinirStatus(status Status) error
	LimparStatus() error
	ObterStatusAtual() (*Status, error)
}

type GerenciadorMensagem interface {
	EnviarMensagem(msg string) error
}

type GerenciadorSessao interface {
	ValidarSessao() error
	SalvarCookies(diretorio string) error
	CarregarCookies(diretorio string) error
	Autenticar() error
	Close()
}

type Status struct {
	Emoji    string
	Mensagem string
}

type OperacoesSlack interface {
	GerenciadorStatus
	GerenciadorMensagem
	GerenciadorSessao
}

type Configuracao struct {
	DiretorioConfig string
	ModoSilencioso  bool
}

func NewModulo(ctx context.Context, config Configuracao) (OperacoesSlack, error) {
	ops, err := NovoGerenciadorOperacoes(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar operações do slack: %w", err)
	}

	return ops, nil
}
