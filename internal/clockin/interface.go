package clockin

import "context"

// Module defines the interface for clock-in operations
type Module interface {
	// ObterLocalizacaoAtual returns the current location
	ObterLocalizacaoAtual() (string, error)

	// ObterLocalizacoesDisponiveis returns available locations
	ObterLocalizacoesDisponiveis() ([]Localizacao, error)

	// SelecionarLocalizacao selects a location
	SelecionarLocalizacao(localizacao Localizacao) error

	// ObterOperacoesDisponiveis returns available clock-in operations
	ObterOperacoesDisponiveis() ([]TipoOperacao, error)

	// ExecutarOperacao executes a clock-in operation
	ExecutarOperacao(operacao TipoOperacao) error

	// Close releases resources used by the module
	Close()
}

// Config holds the configuration for the ClockIn module
type Config struct {
	// UseMock determina se será usado o mock ao invés do browser real
	UseMock bool
}

// NewModule creates a new instance of the ClockIn module
func NewModule(ctx context.Context, config Config) Module {
	if config.UseMock {
		return NewMockPonto(ctx)
	}
	return NewGerenciadorPonto(ctx)
}
