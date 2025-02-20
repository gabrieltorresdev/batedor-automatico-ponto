package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/slack"
)

// App struct
type App struct {
	ctx         context.Context
	authModule  auth.Module
	pontoModule clockin.Module
	slackModule slack.OperacoesSlack
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.authModule != nil {
		a.authModule.Close()
	}
	if a.slackModule != nil {
		a.slackModule.Close()
	}
}

type Credentials struct {
	Username string
	Password string
}

type Operation struct {
	Type        string
	Description string
	Available   bool
}

type LocationRequest struct {
	Location string
}

type OperationRequest struct {
	Type string
}

// Tipos para o Slack
type SlackConfig struct {
	DiretorioConfig string
	ModoSilencioso  bool
}

type SlackStatus struct {
	Emoji    string
	Mensagem string
}

// initializeAuthModule initializes the auth module if not already initialized
func (a *App) initializeAuthModule() error {
	if a.authModule != nil {
		return nil
	}

	authModule, err := auth.NewModule(auth.Config{
		Headless: true,
		UseMock:  true,
	})
	if err != nil {
		return fmt.Errorf("falha ao inicializar módulo de autenticação: %w", err)
	}

	a.authModule = authModule
	return nil
}

// initializePontoModule initializes the ponto module using the auth context
func (a *App) initializePontoModule() error {
	if a.authModule == nil {
		return fmt.Errorf("módulo de autenticação não inicializado")
	}

	a.pontoModule = clockin.NewModule(a.authModule.GetContext(), clockin.Config{
		UseMock: true,
	})
	return nil
}

// LoginPonto tenta fazer login no sistema
func (a *App) LoginPonto(username string, password string) error {
	// Primeiro inicializa o módulo de autenticação
	if err := a.initializeAuthModule(); err != nil {
		return err
	}

	// Tenta fazer login
	err := a.authModule.Login(auth.Credentials{
		Username: username,
		Password: password,
	})

	if err != nil {
		// Se houver erro de autenticação, deleta as credenciais
		var loginErr *auth.LoginError
		if errors.As(err, &loginErr) && loginErr.Type == "auth" {
			if delErr := a.DeletarCredenciais(); delErr != nil {
				// Loga o erro mas não interrompe o fluxo
				println("Erro ao deletar credenciais:", delErr.Error())
			}
		}
		return err
	}

	// Se o login foi bem sucedido, inicializa o módulo de ponto
	if err := a.initializePontoModule(); err != nil {
		return err
	}

	// Salva as credenciais
	return a.SalvarCredenciais(&Credentials{
		Username: username,
		Password: password,
	})
}

// VerificarCredenciaisSalvas verifica se existem credenciais salvas e tenta fazer login
func (a *App) VerificarCredenciaisSalvas() error {
	creds, err := auth.CarregarCredenciais()
	if err != nil {
		if err == auth.ErrCredenciaisNaoEncontradas {
			return nil // Não é um erro, apenas não há credenciais
		}
		return err
	}

	// Se encontrou credenciais, tenta fazer login
	return a.LoginPonto(creds.Username, creds.Password)
}

// CarregarCredenciais carrega as credenciais salvas
func (a *App) CarregarCredenciais() (*Credentials, error) {
	creds, err := auth.CarregarCredenciais()
	if err != nil {
		return nil, err
	}
	return &Credentials{
		Username: creds.Username,
		Password: creds.Password,
	}, nil
}

// SalvarCredenciais salva as credenciais no arquivo
func (a *App) SalvarCredenciais(creds *Credentials) error {
	return auth.SalvarCredenciais(auth.Credentials{
		Username: creds.Username,
		Password: creds.Password,
	})
}

// DeletarCredenciais remove o arquivo de credenciais
func (a *App) DeletarCredenciais() error {
	// Remove o arquivo .env
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	configDir := filepath.Join(home, ".batedorponto")
	envFile := filepath.Join(configDir, ".env")

	// Remove o arquivo se ele existir
	if _, err := os.Stat(envFile); err == nil {
		return os.Remove(envFile)
	}

	return nil
}

// VerificarSessaoSlack verifica se existe uma sessão válida do Slack (sem interação)
func (a *App) VerificarSessaoSlack() error {
	// Obtém o diretório de configuração internamente
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("erro ao obter diretório home: %w", err)
	}

	configDir := filepath.Join(home, ".batedorponto")

	// Inicializa o módulo em modo silencioso
	slackModule, err := slack.NewModulo(a.ctx, slack.Configuracao{
		DiretorioConfig: configDir,
		ModoSilencioso:  true, // Sempre silencioso para verificação
	})

	if err != nil {
		return err
	}

	// Guarda o módulo para uso futuro
	a.slackModule = slackModule

	// Tenta validar a sessão
	return slackModule.ValidarSessao()
}

// InicializarSlack inicia o processo de configuração do Slack (com interação)
func (a *App) InicializarSlack() error {
	// Se já existe um módulo, fecha para reiniciar em modo interativo
	if a.slackModule != nil {
		a.slackModule.Close()
	}

	// Obtém o diretório de configuração internamente
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("erro ao obter diretório home: %w", err)
	}

	configDir := filepath.Join(home, ".batedorponto")

	// Inicializa o módulo em modo interativo
	slackModule, err := slack.NewModulo(a.ctx, slack.Configuracao{
		DiretorioConfig: configDir,
		ModoSilencioso:  false, // Modo interativo para configuração
	})

	if err != nil {
		return err
	}

	a.slackModule = slackModule
	return nil
}

// ObterLocalizacaoAtual returns the current location
func (a *App) ObterLocalizacaoAtual() (string, error) {
	if a.pontoModule == nil {
		return "", fmt.Errorf("módulo de ponto não inicializado")
	}
	return a.pontoModule.ObterLocalizacaoAtual()
}

// ObterLocalizacoesDisponiveis returns available locations
func (a *App) ObterLocalizacoesDisponiveis() ([]clockin.Localizacao, error) {
	if a.pontoModule == nil {
		return nil, fmt.Errorf("módulo de ponto não inicializado")
	}
	return a.pontoModule.ObterLocalizacoesDisponiveis()
}

// SelecionarLocalizacao selects a location
func (a *App) SelecionarLocalizacao(localizacao clockin.Localizacao) error {
	if a.pontoModule == nil {
		return fmt.Errorf("módulo de ponto não inicializado")
	}
	return a.pontoModule.SelecionarLocalizacao(localizacao)
}

// ObterOperacoesDisponiveis returns available operations
func (a *App) ObterOperacoesDisponiveis() ([]clockin.TipoOperacao, error) {
	if a.pontoModule == nil {
		return nil, fmt.Errorf("módulo de ponto não inicializado")
	}
	return a.pontoModule.ObterOperacoesDisponiveis()
}

// ExecutarOperacao executes a clock-in operation
func (a *App) ExecutarOperacao(operacao clockin.TipoOperacao) error {
	if a.pontoModule == nil {
		return fmt.Errorf("módulo de ponto não inicializado")
	}
	return a.pontoModule.ExecutarOperacao(operacao)
}

// ObterStatusAtual returns the current Slack status
func (a *App) ObterStatusAtual() (*slack.Status, error) {
	if a.slackModule == nil {
		return nil, fmt.Errorf("módulo do Slack não inicializado")
	}
	return a.slackModule.ObterStatusAtual()
}

// DefinirStatus sets a new Slack status
func (a *App) DefinirStatus(status slack.Status) error {
	if a.slackModule == nil {
		return fmt.Errorf("módulo do Slack não inicializado")
	}
	return a.slackModule.DefinirStatus(status)
}

// LimparStatus clears the current Slack status
func (a *App) LimparStatus() error {
	if a.slackModule == nil {
		return fmt.Errorf("módulo do Slack não inicializado")
	}
	return a.slackModule.LimparStatus()
}

// EnviarMensagem envia uma mensagem no Slack
func (a *App) EnviarMensagem(mensagem string) error {
	if a.slackModule == nil {
		return fmt.Errorf("módulo Slack não inicializado")
	}
	return a.slackModule.EnviarMensagem(mensagem)
}

// PrepararMensagem prepara uma mensagem baseada no tipo
func (a *App) PrepararMensagem(tipoMensagem string) (bool, string, error) {
	if a.slackModule == nil {
		return false, "", fmt.Errorf("módulo Slack não inicializado")
	}
	return a.slackModule.PrepararMensagem(tipoMensagem)
}
