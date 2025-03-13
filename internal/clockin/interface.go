package clockin

import "context"

type Module interface {
	ObterLocalizacaoAtual() (string, error)
	ObterLocalizacoesDisponiveis() ([]Localizacao, error)
	SelecionarLocalizacao(localizacao Localizacao) error
	ObterOperacoesDisponiveis() ([]TipoOperacao, error)
	ExecutarOperacao(operacao TipoOperacao) error
	Close()
}

type Config struct {
	UseMock bool
}

func NewModule(ctx context.Context, config Config) Module {
	if config.UseMock {
		return NewMockPonto(ctx)
	}
	return NewGerenciadorPonto(ctx)
}
