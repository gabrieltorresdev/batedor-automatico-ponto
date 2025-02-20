package slack

import (
	"context"
	"fmt"
)

// GerenciadorStatus manipula operações de status do Slack
type GerenciadorStatus interface {
	// DefinirStatus define um novo status
	DefinirStatus(status Status) error

	// LimparStatus remove o status atual
	LimparStatus() error

	// ObterStatusAtual recupera o status atual
	ObterStatusAtual() (*Status, error)
}

// GerenciadorMensagem manipula operações de mensagens do Slack
type GerenciadorMensagem interface {
	// EnviarMensagem envia uma mensagem para o canal configurado
	EnviarMensagem(msg string) error

	// PrepararMensagem prepara uma mensagem baseada no tipo
	PrepararMensagem(tipoMensagem string) (bool, string, error)
}

// GerenciadorSessao manipula operações de sessão do Slack
type GerenciadorSessao interface {
	// ValidarSessao valida a sessão atual
	ValidarSessao() error

	// SalvarCookies salva os cookies da sessão
	SalvarCookies(diretorio string) error

	// CarregarCookies carrega os cookies salvos da sessão
	CarregarCookies(diretorio string) error

	// Autenticar realiza a autenticação interativa
	Autenticar() error

	// Close libera os recursos
	Close()
}

// Status representa um status do Slack
type Status struct {
	Emoji    string
	Mensagem string
}

// OperacoesSlack combina todas as operações do Slack
type OperacoesSlack interface {
	GerenciadorStatus
	GerenciadorMensagem
	GerenciadorSessao
}

// Configuracao contém as configurações para o módulo Slack
type Configuracao struct {
	// DiretorioConfig é o diretório onde os arquivos de configuração (como cookies) são armazenados
	DiretorioConfig string
	// ModoSilencioso determina se o navegador deve rodar em modo silencioso
	// Quando falso, o navegador será visível para autenticação manual
	ModoSilencioso bool
}

// NewModulo cria uma nova instância do módulo Slack
func NewModulo(ctx context.Context, config Configuracao) (OperacoesSlack, error) {
	ops, err := NovoGerenciadorOperacoes(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar operações do slack: %w", err)
	}

	// Tenta carregar cookies existentes
	if err := ops.CarregarCookies(config.DiretorioConfig); err != nil {
		fmt.Printf("\n⚠️  Aviso: Cookies do Slack não encontrados ou inválidos. Iniciando autenticação interativa...\n")

		// Tenta autenticar interativamente
		if err := ops.Autenticar(); err != nil {
			ops.Close()
			return nil, fmt.Errorf("falha na autenticação interativa do Slack: %w", err)
		}

		// Valida a sessão após autenticação
		if err := ops.ValidarSessao(); err != nil {
			ops.Close()
			return nil, fmt.Errorf("falha ao validar sessão após autenticação: %w", err)
		}

		// Salva os cookies após autenticação bem-sucedida
		if err := ops.SalvarCookies(config.DiretorioConfig); err != nil {
			fmt.Printf("\n⚠️  Aviso: Não foi possível salvar os cookies do Slack: %v\n", err)
		}
	}

	return ops, nil
}
