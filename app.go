package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/slack"
)

// Interfaces para inversão de dependência
type AuthService interface {
	Login(credentials auth.Credentials) error
	GetContext() context.Context
	Close()
}

type ClockInService interface {
	ObterLocalizacaoAtual() (string, error)
	ObterLocalizacoesDisponiveis() ([]clockin.Localizacao, error)
	SelecionarLocalizacao(localizacao clockin.Localizacao) error
	ObterOperacoesDisponiveis() ([]clockin.TipoOperacao, error)
	ExecutarOperacao(operacao clockin.TipoOperacao) error
	Close()
}

type SlackService interface {
	ValidarSessao() error
	CarregarCookies(dir string) error
	Autenticar() error
	SalvarCookies(dir string) error
	ObterStatusAtual() (*slack.Status, error)
	DefinirStatus(status slack.Status) error
	LimparStatus() error
	EnviarMensagem(mensagem string) error
	PrepararMensagem(tipo string) (bool, string, error)
	Close()
}

// App struct
type App struct {
	ctx         context.Context
	authModule  AuthService
	pontoModule ClockInService
	slackModule SlackService
	configDir   string
}

// NewApp creates a new App application struct
func NewApp() *App {
	home, _ := os.UserHomeDir()
	return &App{
		configDir: filepath.Join(home, ".batedorponto"),
	}
}

// startup is called when the app starts. The context is saved
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.authModule != nil {
		go func() {
			a.authModule.Close()
		}()
	}
	if a.slackModule != nil {
		go func() {
			a.slackModule.Close()
		}()
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
		Context:  a.ctx,
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
	if err := a.initializeAuthModule(); err != nil {
		return fmt.Errorf("erro ao inicializar módulo de autenticação: %w", err)
	}

	credentials := auth.Credentials{
		Username: username,
		Password: password,
	}

	if err := a.authModule.Login(credentials); err != nil {
		var loginErr *auth.LoginError
		if errors.As(err, &loginErr) && loginErr.Type == "auth" {
			if delErr := a.DeletarCredenciais(); delErr != nil {
				println("Erro ao deletar credenciais:", delErr.Error())
			}
			return loginErr
		}
		return fmt.Errorf("erro ao fazer login: %w", err)
	}

	if err := a.initializePontoModule(); err != nil {
		return err
	}

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
			return nil
		}
		return fmt.Errorf("erro ao carregar credenciais: %w", err)
	}

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
	envFile := filepath.Join(a.configDir, ".env")
	if _, err := os.Stat(envFile); err == nil {
		return os.Remove(envFile)
	}
	return nil
}

// VerificarSessaoSlack verifica se existe uma sessão válida do Slack
func (a *App) VerificarSessaoSlack() error {
	if err := a.initializeSlackModule(true); err != nil {
		return err
	}

	if err := a.slackModule.ValidarSessao(); err != nil {
		if err := a.slackModule.CarregarCookies(a.configDir); err != nil {
			return fmt.Errorf("erro ao carregar cookies de sessão do Slack: %w", err)
		}
		return a.slackModule.ValidarSessao()
	}

	return nil
}

func (a *App) initializeSlackModule(silencioso bool) error {
	if a.slackModule != nil {
		oldModule := a.slackModule
		a.slackModule = nil
		go oldModule.Close()
	}

	slackModule, err := slack.NewModulo(a.ctx, slack.Configuracao{
		DiretorioConfig: a.configDir,
		ModoSilencioso:  silencioso,
	})

	if err != nil {
		return fmt.Errorf("erro ao inicializar módulo do Slack: %w", err)
	}

	a.slackModule = slackModule
	return nil
}

// InicializarSlack inicia o processo de configuração do Slack
func (a *App) InicializarSlack() error {
	if err := a.initializeSlackModule(true); err != nil {
		return err
	}

	if err := a.slackModule.CarregarCookies(a.configDir); err != nil {
		fmt.Println("⚠️ Falha ao carregar cookies, iniciando autenticação...")

		if err := a.initializeSlackModule(false); err != nil {
			return err
		}

		if err := a.slackModule.Autenticar(); err != nil {
			return fmt.Errorf("erro na autenticação do Slack: %w", err)
		}

		if err := a.slackModule.SalvarCookies(a.configDir); err != nil {
			return fmt.Errorf("erro ao salvar cookies do Slack: %w", err)
		}

		return a.initializeSlackModule(true)
	}

	return nil
}

// ObterLocalizacaoAtual returns the current location
func (a *App) ObterLocalizacaoAtual() (string, error) {
	if a.pontoModule == nil {
		return "", fmt.Errorf("módulo de ponto não inicializado")
	}

	loc, err := a.pontoModule.ObterLocalizacaoAtual()
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		if err := a.reinicializarModuloPonto(); err != nil {
			return "", fmt.Errorf("erro ao reinicializar sessão: %w", err)
		}
		return a.pontoModule.ObterLocalizacaoAtual()
	}
	return loc, err
}

// ObterLocalizacoesDisponiveis returns available locations
func (a *App) ObterLocalizacoesDisponiveis() ([]clockin.Localizacao, error) {
	if a.pontoModule == nil {
		return nil, fmt.Errorf("módulo de ponto não inicializado")
	}

	locs, err := a.pontoModule.ObterLocalizacoesDisponiveis()
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		if err := a.reinicializarModuloPonto(); err != nil {
			return nil, fmt.Errorf("erro ao reinicializar sessão: %w", err)
		}
		return a.pontoModule.ObterLocalizacoesDisponiveis()
	}
	return locs, err
}

// SelecionarLocalizacao selects a location
func (a *App) SelecionarLocalizacao(localizacao clockin.Localizacao) error {
	if a.pontoModule == nil {
		return fmt.Errorf("módulo de ponto não inicializado")
	}

	err := a.pontoModule.SelecionarLocalizacao(localizacao)
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		if err := a.reinicializarModuloPonto(); err != nil {
			return fmt.Errorf("erro ao reinicializar sessão: %w", err)
		}
		return a.pontoModule.SelecionarLocalizacao(localizacao)
	}
	return err
}

// ObterOperacoesDisponiveis returns available operations
func (a *App) ObterOperacoesDisponiveis() ([]clockin.TipoOperacao, error) {
	if a.pontoModule == nil {
		return nil, fmt.Errorf("módulo de ponto não inicializado")
	}

	ops, err := a.pontoModule.ObterOperacoesDisponiveis()
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		if err := a.reinicializarModuloPonto(); err != nil {
			return nil, fmt.Errorf("erro ao reinicializar sessão: %w", err)
		}
		return a.pontoModule.ObterOperacoesDisponiveis()
	}
	return ops, err
}

// ExecutarOperacao executes a clock-in operation
func (a *App) ExecutarOperacao(operacao clockin.TipoOperacao) error {
	if a.pontoModule == nil {
		return fmt.Errorf("módulo de ponto não inicializado")
	}

	err := a.pontoModule.ExecutarOperacao(operacao)
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		if err := a.reinicializarModuloPonto(); err != nil {
			return fmt.Errorf("erro ao reinicializar sessão: %w", err)
		}
		return a.pontoModule.ExecutarOperacao(operacao)
	}
	return err
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

// reinicializarModuloPonto reinicializa o módulo de ponto após uma queda de sessão
func (a *App) reinicializarModuloPonto() error {
	if a.authModule != nil {
		a.authModule.Close()
		a.authModule = nil
	}
	if a.pontoModule != nil {
		a.pontoModule.Close()
		a.pontoModule = nil
	}

	creds, err := auth.CarregarCredenciais()
	if err != nil {
		return fmt.Errorf("erro ao carregar credenciais: %w", err)
	}

	ctx, cancel := context.WithCancel(a.ctx)
	a.ctx = ctx

	defer func() {
		if err != nil {
			cancel()
		}
	}()

	if err := a.initializeAuthModule(); err != nil {
		return fmt.Errorf("erro ao inicializar módulo de autenticação: %w", err)
	}

	if err := a.authModule.Login(creds); err != nil {
		return fmt.Errorf("erro ao fazer login: %w", err)
	}

	if err := a.initializePontoModule(); err != nil {
		return fmt.Errorf("erro ao inicializar módulo de ponto: %w", err)
	}

	return nil
}
