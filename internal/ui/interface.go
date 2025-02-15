package ui

import (
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/common"
)

// Module defines the interface for UI operations
type Module interface {
	// ShowSpinner displays a spinner with a message and returns a function to stop it
	ShowSpinner(message string) common.LoadingSpinner

	// ExibirMenuLocalizacao displays a location selection menu
	ExibirMenuLocalizacao(localizacoes []clockin.Localizacao) (clockin.Localizacao, error)

	// ExibirMenuOperacao displays an operation selection menu
	ExibirMenuOperacao(operacoes []clockin.TipoOperacao) (clockin.TipoOperacao, error)

	// ExibirConfirmacao displays a confirmation prompt for an operation
	ExibirConfirmacao(operacao clockin.TipoOperacao) (bool, error)
}

// NewModule creates a new instance of the UI module
func NewModule() Module {
	return &UIManager{}
}

// UIManager implements the UI Module interface
type UIManager struct{}

func (u *UIManager) ShowSpinner(message string) common.LoadingSpinner {
	return NewLoadingSpinner(message)
}

func (u *UIManager) ExibirMenuLocalizacao(localizacoes []clockin.Localizacao) (clockin.Localizacao, error) {
	return ExibirMenuLocalizacao(localizacoes)
}

func (u *UIManager) ExibirMenuOperacao(operacoes []clockin.TipoOperacao) (clockin.TipoOperacao, error) {
	return ExibirMenuOperacao(operacoes)
}

func (u *UIManager) ExibirConfirmacao(operacao clockin.TipoOperacao) (bool, error) {
	return ExibirConfirmacao(operacao)
}
