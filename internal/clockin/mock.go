package clockin

import (
	"context"
	"fmt"
	"math/rand"
	"time"
)

type MockPonto struct {
	ctx              context.Context
	localizacaoAtual string
	localizacoes     []Localizacao
	operacoes        []TipoOperacao
}

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

func (m *MockPonto) ObterLocalizacaoAtual() (string, error) {
	if rand.Float32() < 0.05 {
		return "", &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: "falha ao obter localização atual",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.localizacaoAtual, nil
}

func (m *MockPonto) ObterLocalizacoesDisponiveis() ([]Localizacao, error) {
	if rand.Float32() < 0.05 {
		return nil, &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: "falha ao obter localizações",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.localizacoes, nil
}

func (m *MockPonto) SelecionarLocalizacao(localizacao Localizacao) error {
	if rand.Float32() < 0.05 {
		return &ErroPonto{
			Tipo:     "localizacao",
			Mensagem: fmt.Sprintf("falha ao selecionar %s", localizacao.Nome),
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

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

func (m *MockPonto) ObterOperacoesDisponiveis() ([]TipoOperacao, error) {
	if rand.Float32() < 0.05 {
		return nil, &ErroPonto{
			Tipo:     "validacao",
			Mensagem: "falha ao obter operações",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

	return m.operacoes, nil
}

func (m *MockPonto) ExecutarOperacao(operacao TipoOperacao) error {
	if rand.Float32() < 0.05 {
		return &ErroPonto{
			Operacao: operacao,
			Tipo:     "execucao",
			Mensagem: "falha ao executar operação",
			Causa:    fmt.Errorf("erro de conexão simulado"),
		}
	}

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

	m.atualizarOperacoesDisponiveis()

	return nil
}

func (m *MockPonto) Close() {
}

func (m *MockPonto) atualizarOperacoesDisponiveis() {
	hora := time.Now().Hour()
	m.operacoes = nil

	switch {
	case hora >= 7 && hora < 12:
		m.operacoes = []TipoOperacao{Entrada, Almoco}
	case hora >= 12 && hora < 14:
		m.operacoes = []TipoOperacao{Almoco, Saida}
	case hora >= 14 && hora < 19:
		m.operacoes = []TipoOperacao{Entrada, Saida}
	default:
		m.operacoes = []TipoOperacao{Entrada}
	}
}
