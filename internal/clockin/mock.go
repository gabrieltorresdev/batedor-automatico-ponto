package clockin

import (
	"context"
	"fmt"
	"math/rand"
	"time"
)

// MockPonto implements the Module interface for testing and development
type MockPonto struct {
	ctx              context.Context
	localizacaoAtual string
	localizacoes     []Localizacao
	operacoes        []TipoOperacao
}

// NewMockPonto creates a new mock clock-in module
func NewMockPonto(ctx context.Context) Module {
	mock := &MockPonto{
		ctx: ctx,
		localizacoes: []Localizacao{
			{Nome: "HOME OFFICE", Valor: "1"},
			{Nome: "ESCRITÓRIO", Valor: "2"},
		},
	}
	mock.localizacaoAtual = mock.localizacoes[0].Nome
	mock.atualizarOperacoesDisponiveis()
	return mock
}

// ObterLocalizacaoAtual returns the current mock location
func (m *MockPonto) ObterLocalizacaoAtual() (string, error) {

	// Simula erro aleatório (5% de chance)
	if rand.Float32() < 0.05 {
		return "", &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: "falha ao obter localização atual",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.localizacaoAtual, nil
}

// ObterLocalizacoesDisponiveis returns mock available locations
func (m *MockPonto) ObterLocalizacoesDisponiveis() ([]Localizacao, error) {
	// Simula erro aleatório (5% de chance)
	if rand.Float32() < 0.05 {
		return nil, &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: "falha ao obter localizações",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.localizacoes, nil
}

// SelecionarLocalizacao updates the mock current location
func (m *MockPonto) SelecionarLocalizacao(localizacao Localizacao) error {
	// Simula erro aleatório (5% de chance)
	if rand.Float32() < 0.05 {
		return &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: fmt.Sprintf("falha ao selecionar %s", localizacao.Nome),
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	// Valida se a localização existe
	found := false
	for _, loc := range m.localizacoes {
		if loc.Nome == localizacao.Nome {
			found = true
			break
		}
	}
	if !found {
		return &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: "localização inválida",
		}
	}

	m.localizacaoAtual = localizacao.Nome
	return nil
}

// ObterOperacoesDisponiveis returns mock available operations
func (m *MockPonto) ObterOperacoesDisponiveis() ([]TipoOperacao, error) {
	// Simula erro aleatório (5% de chance)
	if rand.Float32() < 0.05 {
		return nil, &ErroPonto{
			Tipo:     "validacao",
			Mensagem: "falha ao obter operações",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.operacoes, nil
}

// ExecutarOperacao simulates executing a clock-in operation
func (m *MockPonto) ExecutarOperacao(operacao TipoOperacao) error {
	// Simula erro aleatório (5% de chance)
	if rand.Float32() < 0.05 {
		return &ErroPonto{
			Operacao: operacao,
			Tipo:     "execucao",
			Mensagem: "falha ao executar operação",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	// Valida se a operação está disponível
	found := false
	for _, op := range m.operacoes {
		if op == operacao {
			found = true
			break
		}
	}
	if !found {
		return &ErroPonto{
			Operacao: operacao,
			Tipo:     "validacao",
			Mensagem: "operação indisponível",
		}
	}

	// Atualiza operações disponíveis após executar uma operação
	m.atualizarOperacoesDisponiveis()

	return nil
}

// Close is a no-op for the mock
func (m *MockPonto) Close() {
	// No-op
}

// atualizarOperacoesDisponiveis atualiza as operações disponíveis com base no horário
func (m *MockPonto) atualizarOperacoesDisponiveis() {
	hora := time.Now().Hour()
	m.operacoes = nil

	// Simula regras de negócio para operações disponíveis
	switch {
	case hora >= 7 && hora < 12: // Manhã
		m.operacoes = []TipoOperacao{Entrada, Almoco}
	case hora >= 12 && hora < 14: // Horário de almoço
		m.operacoes = []TipoOperacao{Almoco, Saida}
	case hora >= 14 && hora < 19: // Tarde
		m.operacoes = []TipoOperacao{Entrada, Saida}
	default: // Fora do horário comercial
		m.operacoes = []TipoOperacao{Entrada}
	}
}
