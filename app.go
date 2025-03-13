package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/config"
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
	configDir, err := config.GetConfigDir()
	if err != nil {
		// Em caso de erro, usamos um valor padrão
		home, _ := os.UserHomeDir()
		configDir = filepath.Join(home, ".batedorponto")
	}

	return &App{
		configDir: configDir,
	}
}

// startup is called when the app starts. The context is saved
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Initialize modules concurrently
	if err := a.inicializarModulosConcurrently(); err != nil {
		fmt.Printf("Erro ao inicializar módulos: %v\n", err)
	}
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Create a channel to wait for cleanup
	done := make(chan struct{})

	go func() {
		if a.authModule != nil {
			a.authModule.Close()
		}
		if a.pontoModule != nil {
			a.pontoModule.Close()
		}
		if a.slackModule != nil {
			a.slackModule.Close()
		}
		close(done)
	}()

	// Wait for cleanup with timeout
	select {
	case <-done:
		return
	case <-time.After(10 * time.Second):
		fmt.Println("Warning: Shutdown timeout reached, some resources may not have been cleaned up properly")
		return
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

// initializeAuthEPonto initializes the auth and clock-in modules using a shared browser context
func (a *App) initializeAuthEPonto() error {
	if a.authModule == nil {
		// Initialize auth module
		authModule, err := auth.NewModule(auth.Config{
			Headless: true,
			UseMock:  false,
			Context:  a.ctx,
		})
		if err != nil {
			return fmt.Errorf("falha ao inicializar módulo de autenticação: %w", err)
		}
		a.authModule = authModule
	}

	if a.authModule == nil {
		return errors.New("módulo de autenticação não inicializado")
	}

	// Initialize ponto module with the browser context from the auth module
	a.pontoModule = clockin.NewModule(a.authModule.GetContext(), clockin.Config{
		UseMock: false,
	})

	return nil
}

// initializeAuthModule initializes just the auth module
func (a *App) initializeAuthModule() error {
	if a.authModule != nil {
		return nil // Already initialized
	}

	// Create a new context that will be cancelled only on shutdown
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize auth module
	authModule, err := auth.NewModule(auth.Config{
		Headless: true,
		UseMock:  false,
		Context:  ctx,
	})
	if err != nil {
		cancel()
		return fmt.Errorf("falha ao inicializar módulo de autenticação: %w", err)
	}

	a.authModule = authModule
	return nil
}

// initializePontoModule initializes just the ponto module
func (a *App) initializePontoModule() error {
	if a.pontoModule != nil {
		return nil // Already initialized
	}

	// Instead of requiring the auth module, create a new browser context if needed
	var ctx context.Context
	if a.authModule != nil {
		ctx = a.authModule.GetContext()
	} else {
		// Create a new browser session dedicated for ponto module with a persistent context
		ctx, _ = context.WithCancel(context.Background())
		authModule, err := auth.NewModule(auth.Config{
			Headless: true,
			UseMock:  false,
			Context:  ctx,
		})
		if err != nil {
			return fmt.Errorf("falha ao criar contexto para módulo de ponto: %w", err)
		}
		ctx = authModule.GetContext()
	}

	// Initialize ponto module with the context
	a.pontoModule = clockin.NewModule(ctx, clockin.Config{
		UseMock: false,
	})

	return nil
}

// inicializarModulosConcurrently initializes the auth/ponto and slack modules concurrently
func (a *App) inicializarModulosConcurrently() error {
	var wg sync.WaitGroup
	errCh := make(chan error, 3)

	// Create a context with a longer timeout for initialization
	ctx, cancel := context.WithTimeout(a.ctx, 2*time.Minute)
	defer cancel()

	wg.Add(3)

	// Goroutine for auth module initialization
	go func() {
		defer wg.Done()
		if err := a.initializeAuthModule(); err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}()

	// Goroutine for ponto module initialization
	go func() {
		defer wg.Done()
		if err := a.initializePontoModule(); err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}()

	// Goroutine for slack initialization
	go func() {
		defer wg.Done()
		if err := a.initializeSlackModule(true); err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}()

	// Wait for all goroutines to complete or context to timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	// Wait for either completion or timeout
	select {
	case <-done:
		// All initializations completed
		break
	case <-ctx.Done():
		// Timeout occurred
		return fmt.Errorf("timeout while initializing modules: %v", ctx.Err())
	}

	// Check for errors
	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// initializeSlackModule initializes the slack module
func (a *App) initializeSlackModule(useCookies bool) error {
	// If already initialized and useCookies is true, return
	if a.slackModule != nil && useCookies {
		return nil
	}

	// Create a new context that will be cancelled only on shutdown
	ctx, _ := context.WithCancel(context.Background())

	// Create a new slack module with its own configuration
	slackModule, err := slack.NewModulo(ctx, slack.Configuracao{
		DiretorioConfig: a.configDir,
		ModoSilencioso:  true, // Sempre inicializa em modo silencioso
	})
	if err != nil {
		return fmt.Errorf("falha ao inicializar módulo do Slack: %w", err)
	}

	a.slackModule = slackModule

	if useCookies {
		// Apenas tenta carregar os cookies, sem autenticar
		if err := a.slackModule.CarregarCookies(a.configDir); err != nil {
			// Se não conseguir carregar os cookies, apenas registra o erro
			// A autenticação será feita quando o usuário interagir com o componente
			fmt.Printf("Cookies do Slack não encontrados ou inválidos. Aguardando configuração manual.\n")
		} else {
			// Se carregou os cookies, valida a sessão
			if err := a.slackModule.ValidarSessao(); err != nil {
				fmt.Printf("Sessão do Slack inválida. Aguardando configuração manual.\n")
			} else {
				fmt.Println("Sessão do Slack carregada com sucesso.")
			}
		}
	}

	return nil
}

// ConfigurarSlack é chamado quando o usuário interage com o componente de configuração do Slack
func (a *App) ConfigurarSlack() error {
	fmt.Println("============================================================")
	fmt.Println("INICIANDO PROCESSO DE CONFIGURAÇÃO DO SLACK")
	fmt.Println("============================================================")

	// Fecha o módulo existente com timeout para não travar
	if a.slackModule != nil {
		fmt.Println("Fechando módulo Slack existente...")

		// Cria um módulo temporário para não bloquear o resto do processo
		tempModule := a.slackModule
		a.slackModule = nil // Libera a referência imediatamente para evitar deadlocks

		// Fecha o módulo em uma goroutine separada
		go func() {
			done := make(chan struct{})
			go func() {
				defer close(done)
				tempModule.Close()
			}()

			// Aguarda o fechamento do módulo com timeout de 3 segundos
			select {
			case <-done:
				fmt.Println("Módulo Slack antigo fechado com sucesso")
			case <-time.After(3 * time.Second):
				fmt.Println("Timeout ao fechar módulo Slack antigo, continuando mesmo assim")
			}
		}()

		// Não esperamos a goroutine terminar, continuamos o fluxo
		fmt.Println("Continuando com o processo de configuração...")
	}

	// Criar um novo contexto para autenticação em modo headful (visível)
	fmt.Println("Criando novo contexto para o navegador de autenticação...")
	ctx, cancel := context.WithCancel(context.Background())

	// Inicializa o módulo do Slack em modo headful (não silencioso) para autenticação
	fmt.Println("Abrindo navegador visível para autenticação do Slack...")
	slackModuleAuth, err := slack.NewModulo(ctx, slack.Configuracao{
		DiretorioConfig: a.configDir,
		ModoSilencioso:  false, // Modo headful (visível) para permitir interação do usuário
	})
	if err != nil {
		cancel() // Garantir que o contexto é cancelado em caso de erro
		fmt.Printf("ERRO: Falha ao inicializar módulo do Slack para autenticação: %v\n", err)
		return fmt.Errorf("falha ao inicializar módulo do Slack para autenticação: %w", err)
	}

	// Tenta autenticar interativamente com o navegador visível
	fmt.Println("Por favor, faça login no Slack na janela que foi aberta...")
	if err := slackModuleAuth.Autenticar(); err != nil {
		fmt.Printf("ERRO: Falha na autenticação do Slack: %v\n", err)

		// Fecha o módulo de autenticação com timeout
		closeWithTimeout(slackModuleAuth, 5*time.Second)
		cancel() // Cancelar o contexto

		return fmt.Errorf("erro na autenticação do Slack: %w", err)
	}

	// Após autenticação bem-sucedida, obtém os cookies
	fmt.Println("Autenticação do Slack bem-sucedida, salvando cookies...")
	if err := slackModuleAuth.SalvarCookies(a.configDir); err != nil {
		fmt.Printf("ATENÇÃO: Erro ao salvar cookies do Slack: %v\n", err)
		// Continuamos mesmo com falha de salvamento, já que temos a sessão ativa
	}

	// Fechamos o módulo de autenticação com navegador visível
	fmt.Println("Fechando o navegador de autenticação...")
	closeWithTimeout(slackModuleAuth, 5*time.Second)
	cancel() // Garantir que o contexto é cancelado
	fmt.Println("Navegador de autenticação fechado.")

	// Criamos um novo módulo do Slack em modo headless para as operações normais
	fmt.Println("Inicializando módulo do Slack em modo silencioso para operações...")
	if err := a.initializeSlackModule(true); err != nil {
		fmt.Printf("ERRO: Falha ao inicializar módulo do Slack após autenticação: %v\n", err)
		return fmt.Errorf("erro ao inicializar módulo do Slack após autenticação: %w", err)
	}

	fmt.Println("============================================================")
	fmt.Println("PROCESSO DE CONFIGURAÇÃO DO SLACK CONCLUÍDO COM SUCESSO")
	fmt.Println("============================================================")

	return nil
}

// Função auxiliar para fechar módulos com timeout
func closeWithTimeout(module SlackService, timeout time.Duration) {
	if module == nil {
		return
	}

	// Cria um canal para sinalizar o término do Close
	done := make(chan struct{})

	// Fecha o módulo em uma goroutine separada
	go func() {
		defer close(done)
		// Captura possíveis pânicos e os registra
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("Recuperado de pânico durante fechamento do módulo: %v\n", r)
			}
		}()
		module.Close()
	}()

	// Aguarda o fechamento do módulo com timeout
	select {
	case <-done:
		// Fechado com sucesso, não precisamos imprimir nada aqui
		return
	case <-time.After(timeout):
		fmt.Println("Aviso: Timeout ao fechar módulo, o processo vai continuar")
		// Quando ocorre timeout, não podemos fazer muito, apenas seguimos em frente
		// O coletor de lixo ou outro mecanismo na linguagem eventualmente limpará os recursos
	}
}

// LoginPonto tenta fazer login no sistema
func (a *App) LoginPonto(username string, password string) error {
	if err := a.initializeAuthEPonto(); err != nil {
		return fmt.Errorf("erro ao inicializar módulo de autenticação: %w", err)
	}

	credentials := auth.Credentials{
		Username: username,
		Password: password,
	}

	// Tentar login
	loginErr := a.authModule.Login(credentials)
	if loginErr != nil {
		var authLoginErr *auth.LoginError
		if errors.As(loginErr, &authLoginErr) {
			// Apenas exclui as credenciais para erros de autenticação, não para bloqueios
			if authLoginErr.Type == "auth" {
				if delErr := a.DeletarCredenciais(); delErr != nil {
					fmt.Printf("Erro ao deletar credenciais: %s\n", delErr.Error())
				}
			}
			// Não exclui credenciais para erros de bloqueio (type == "blocked")

			// Retorna o erro original sem envolver em outro erro
			return authLoginErr
		}
		// Para outros tipos de erro, mantém o comportamento atual
		return fmt.Errorf("erro ao fazer login: %w", loginErr)
	}

	// Login bem-sucedido, salvar credenciais
	fmt.Println("Login bem-sucedido, salvando credenciais...")
	if err := a.SalvarCredenciais(&Credentials{
		Username: username,
		Password: password,
	}); err != nil {
		fmt.Printf("ATENÇÃO: Erro ao salvar credenciais: %v\n", err)
		// Continuamos mesmo com falha no salvamento, pois o login já foi bem-sucedido
	}

	return nil
}

// VerificarCredenciaisSalvas verifica se existem credenciais salvas e tenta fazer login
func (a *App) VerificarCredenciaisSalvas() error {
	creds, err := auth.CarregarCredenciais()
	if err != nil {
		if err == auth.ErrCredenciaisNaoEncontradas {
			return nil
		}

		// Verifica se é um erro de login e retorna diretamente
		var loginErr *auth.LoginError
		if errors.As(err, &loginErr) {
			return loginErr
		}

		// Cria um erro estruturado para outros tipos de erro
		return &auth.LoginError{
			Type:    "system",
			Message: err.Error(),
		}
	}

	// Verifica se as credenciais carregadas são válidas
	fmt.Println("Credenciais encontradas, tentando login automático...")

	// Inicializa o módulo de autenticação
	if err := a.initializeAuthEPonto(); err != nil {
		return fmt.Errorf("erro ao inicializar módulo de autenticação: %w", err)
	}

	// Tenta fazer login com as credenciais carregadas
	if err := a.authModule.Login(auth.Credentials{
		Username: creds.Username,
		Password: creds.Password,
	}); err != nil {
		var loginErr *auth.LoginError
		if errors.As(err, &loginErr) {
			// Se for erro de autenticação, remove as credenciais
			if loginErr.Type == "auth" {
				if delErr := a.DeletarCredenciais(); delErr != nil {
					fmt.Printf("Erro ao deletar credenciais: %s\n", delErr.Error())
				}
			}
			return loginErr
		}
		return fmt.Errorf("erro ao fazer login: %w", err)
	}

	// Login bem-sucedido, garantir que as credenciais estão salvas
	if err := a.SalvarCredenciais(&Credentials{
		Username: creds.Username,
		Password: creds.Password,
	}); err != nil {
		fmt.Printf("ATENÇÃO: Erro ao confirmar o salvamento das credenciais: %v\n", err)
		// Continuamos mesmo com erro, pois o login já foi bem-sucedido
	}

	fmt.Println("Login automático concluído com sucesso!")
	return nil
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
	envFilePath, err := config.GetEnvFilePath()
	if err != nil {
		return fmt.Errorf("erro ao obter caminho do arquivo de credenciais: %w", err)
	}

	if _, err := os.Stat(envFilePath); err == nil {
		return os.Remove(envFilePath)
	} else if os.IsNotExist(err) {
		// Arquivo já não existe, não é um erro
		return nil
	} else {
		return fmt.Errorf("erro ao verificar arquivo de credenciais: %w", err)
	}
}

// VerificarSessaoSlack verifica se existe uma sessão válida do Slack
func (a *App) VerificarSessaoSlack() error {
	if a.slackModule == nil {
		return fmt.Errorf("módulo do Slack não inicializado, necessário configurar")
	}

	// Tenta validar a sessão atual
	if err := a.slackModule.ValidarSessao(); err != nil {
		// Se a sessão é inválida, retorna o erro para que o frontend possa mostrar o botão de configuração
		return fmt.Errorf("sessão do Slack inválida ou não configurada, necessário autenticar")
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

	// Get current location before executing operation
	location, err := a.ObterLocalizacaoAtual()
	if err != nil {
		// Non-critical error, we can continue without the location
		location = ""
		fmt.Printf("Warning: Could not get current location: %v\n", err)
	}

	// Capture the exact timestamp before executing the operation
	timestamp := time.Now()

	// Execute the clock punch operation
	err = a.pontoModule.ExecutarOperacao(operacao)
	if err != nil && strings.Contains(err.Error(), "sessão expirada") {
		fmt.Printf("Session expired, attempting to reinitialize ponto module...\n")
		if reErr := a.reinicializarModuloPonto(); reErr != nil {
			return fmt.Errorf("erro ao reinicializar sessão: %w", reErr)
		}
		// Retry with reinitialized session
		err = a.pontoModule.ExecutarOperacao(operacao)
	}

	// If operation was successful, record the clock punch
	if err == nil {
		// Create a custom PunchRecord to use the captured timestamp
		record := clockin.PunchRecord{
			Timestamp: timestamp,
			Type:      operacao,
			Location:  location,
		}

		// Save the record
		if recordErr := clockin.SavePunchRecord(record); recordErr != nil {
			// Log the error but don't fail the operation
			fmt.Printf("Erro ao salvar registro de ponto: %v\n", recordErr)
		} else {
			fmt.Printf("Registro de ponto salvo com sucesso: Tipo=%s, Horário=%s\n",
				operacao.String(), timestamp.Format("15:04:05"))
		}
	} else {
		fmt.Printf("Operação de ponto falhou, registro não foi salvo: %v\n", err)
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

	if err := a.initializeAuthEPonto(); err != nil {
		return fmt.Errorf("erro ao reinicializar módulo de autenticação e ponto: %w", err)
	}

	if err := a.authModule.Login(creds); err != nil {
		// Verifica se é um erro de login e retorna diretamente para preservar o tipo
		var loginErr *auth.LoginError
		if errors.As(err, &loginErr) {
			return loginErr
		}
		return fmt.Errorf("erro ao fazer login: %w", err)
	}

	return nil
}

// ObterDadosTimeline returns the data needed for the timeline component
func (a *App) ObterDadosTimeline() (map[string]interface{}, error) {
	// Obter todos os registros de ponto do dia para permitir interpretação correta
	registros, err := clockin.GetTodayPunchRecords()
	if err != nil {
		return nil, fmt.Errorf("erro ao obter registros do dia: %w", err)
	}

	// Criar o mapa de resposta com os registros completos
	result := map[string]interface{}{
		"records": registros,
	}

	return result, nil
}
