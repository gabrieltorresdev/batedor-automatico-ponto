package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/slack"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/ui"
	"github.com/joho/godotenv"
	"github.com/manifoldco/promptui"
)

const (
	timeoutGlobal = 10 * time.Minute
	configDirName = ".batedorponto"
	envFileName   = ".env"
)

// Estruturas de dados para resultados de operações
type inicializacaoResult struct {
	sessaoPonto  auth.BrowserSession
	slackSession *slack.SlackSession
	gerenciador  *clockin.GerenciadorPonto
	err          error
}

// Gerenciador da aplicação
type App struct {
	ctx          context.Context
	cancel       context.CancelFunc
	configDir    string
	sessaoPonto  auth.BrowserSession
	slackSession *slack.SlackSession
	gerenciador  *clockin.GerenciadorPonto
}

// Cria uma nova instância do aplicativo
func NewApp() (*App, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeoutGlobal)

	configDir, err := obterDiretorioConfig()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("erro ao obter diretório de configuração: %w", err)
	}

	return &App{
		ctx:       ctx,
		cancel:    cancel,
		configDir: configDir,
	}, nil
}

// Inicializa os componentes do aplicativo
func (a *App) Inicializar() error {
	// Carrega credenciais (sequencial pois pode precisar de input do usuário)
	credenciais, novasCredenciais, err := carregarCredenciais()
	if err != nil {
		return fmt.Errorf("erro ao carregar credenciais: %w", err)
	}

	// Canais para resultados das inicializações
	pontoChan := make(chan inicializacaoResult, 1)
	slackChan := make(chan inicializacaoResult, 1)

	// Inicia inicializações em paralelo
	go func() { pontoChan <- inicializarPonto(credenciais) }()
	go func() { slackChan <- inicializarSlack(a.ctx, a.configDir) }()

	// Se são credenciais novas, tenta salvar em paralelo
	if novasCredenciais {
		go func() {
			if err := salvarCredenciais(credenciais); err != nil {
				fmt.Printf("\n⚠️  Aviso: %v\n", err)
			}
		}()
	}

	// Aguarda resultado do ponto (obrigatório)
	select {
	case <-a.ctx.Done():
		return fmt.Errorf("timeout ao inicializar ponto")
	case resultado := <-pontoChan:
		if resultado.err != nil {
			return resultado.err
		}
		a.sessaoPonto = resultado.sessaoPonto
		a.gerenciador = resultado.gerenciador
	}

	// Aguarda resultado do Slack (opcional)
	select {
	case <-a.ctx.Done():
		fmt.Println("\n⚠️  Timeout ao configurar Slack. O programa continuará sem suporte ao Slack.")
	case resultado := <-slackChan:
		if resultado.err != nil {
			fmt.Printf("\n⚠️  Aviso: Slack não configurado: %v\n", resultado.err)
			fmt.Println("O programa continuará sem suporte ao Slack.")
		} else {
			a.slackSession = resultado.slackSession
		}
	}

	return nil
}

// Executa o loop principal do aplicativo
func (a *App) Executar() error {
	for {
		select {
		case <-a.ctx.Done():
			return fmt.Errorf("programa finalizado pelo usuário")
		default:
			if err := a.executarCiclo(); err != nil {
				if strings.Contains(err.Error(), "programa finalizado pelo usuário") {
					return err
				}
				fmt.Printf("\n⚠️  Erro: %v\n", err)
			}
			fmt.Println() // Linha em branco para separar operações
		}
	}
}

// Executa um ciclo do loop principal
func (a *App) executarCiclo() error {
	opcao, err := exibirMenuPrincipal()
	if err != nil {
		return fmt.Errorf("erro ao exibir menu: %w", err)
	}

	if opcao == "Sair" {
		return fmt.Errorf("programa finalizado pelo usuário")
	}

	marcarPonto := opcao == "Marcar ponto" || opcao == "Marcar ponto e enviar mensagem"
	enviarMensagem := opcao == "Enviar mensagem no Slack" || opcao == "Marcar ponto e enviar mensagem"

	if marcarPonto {
		if err := a.executarFluxoPonto(); err != nil {
			return err
		}
	}

	if enviarMensagem {
		if err := a.executarFluxoSlack(marcarPonto); err != nil {
			return err
		}
	}

	return nil
}

// Executa o fluxo de marcar ponto
func (a *App) executarFluxoPonto() error {
	if err := executarFluxoPonto(a.gerenciador); err != nil {
		if strings.Contains(err.Error(), "operação cancelada pelo usuário") {
			fmt.Println("\n✖ Operação cancelada")
			return nil
		}
		return err
	}
	return nil
}

// Executa o fluxo do Slack
func (a *App) executarFluxoSlack(aposMarcarPonto bool) error {
	if a.slackSession == nil {
		fmt.Println("\n⚠️  Slack não está configurado. Configure o Slack primeiro.")
		return nil
	}

	var tipoMensagem string
	if aposMarcarPonto {
		operacoes, err := a.gerenciador.ObterOperacoesDisponiveis()
		if err != nil {
			return fmt.Errorf("erro ao determinar tipo de mensagem: %w", err)
		}

		tipoMensagem = determinarTipoMensagem(operacoes)
	} else {
		var err error
		tipoMensagem, err = selecionarTipoMensagem()
		if err != nil {
			return err
		}
	}

	if err := enviarMensagemSlack(a.slackSession, tipoMensagem); err != nil {
		fmt.Printf("\n⚠️  %v\n", err)
	}

	return nil
}

// Cleanup do aplicativo
func (a *App) Close() {
	if a.sessaoPonto != nil {
		a.sessaoPonto.Close()
	}
	if a.slackSession != nil {
		a.slackSession.Close()
	}
	a.cancel()
}

// Função auxiliar para determinar o tipo de mensagem com base nas operações disponíveis
func determinarTipoMensagem(operacoes []clockin.TipoOperacao) string {
	// Procura pela operação que está disponível
	for _, op := range operacoes {
		switch op {
		case clockin.Entrada:
			return "entrada"
		case clockin.Almoco:
			return "refeicao"
		case clockin.Saida:
			return "saida"
		}
	}
	return ""
}

// Função auxiliar para selecionar o tipo de mensagem manualmente
func selecionarTipoMensagem() (string, error) {
	prompt := promptui.Select{
		Label: "Selecione o tipo de mensagem",
		Items: []string{"Entrada", "Almoço", "Saída"},
	}

	_, resultado, err := prompt.Run()
	if err != nil {
		return "", fmt.Errorf("erro na seleção: %w", err)
	}

	switch resultado {
	case "Entrada":
		return "entrada", nil
	case "Almoço":
		return "refeicao", nil
	case "Saída":
		return "saida", nil
	default:
		return "", fmt.Errorf("tipo de mensagem inválido")
	}
}

func main() {
	fmt.Println("\nBatedor de Ponto - Oliveira Trust")
	fmt.Println("==================================")

	// Cria e inicializa o aplicativo
	app, err := NewApp()
	if err != nil {
		fmt.Printf("\nErro: %v\n", err)
		os.Exit(1)
	}
	defer app.Close()

	// Configura tratamento de sinais
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Print("\nEncerrando programa...")
		app.Close()
		fmt.Println(" OK")
		os.Exit(0)
	}()

	// Inicializa componentes
	if err := app.Inicializar(); err != nil {
		fmt.Printf("\nErro: %v\n", err)
		os.Exit(1)
	}

	// Executa o loop principal
	if err := app.Executar(); err != nil {
		if !strings.Contains(err.Error(), "programa finalizado pelo usuário") {
			fmt.Printf("\nErro: %v\n", err)
		}
	}

	fmt.Println("\nPrograma finalizado")
}

func obterDiretorioConfig() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("erro ao obter diretório home: %v", err)
	}

	configDir := filepath.Join(homeDir, configDirName)
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return "", fmt.Errorf("erro ao criar diretório de configuração: %v", err)
	}

	return configDir, nil
}

func carregarCredenciais() (auth.Credentials, bool, error) {
	configDir, err := obterDiretorioConfig()
	if err != nil {
		return auth.Credentials{}, false, err
	}

	envFile := filepath.Join(configDir, envFileName)
	if err := godotenv.Load(envFile); err == nil {
		username := os.Getenv("USERNAME_PONTO")
		password := os.Getenv("PASSWORD_PONTO")

		if username != "" && password != "" {
			return auth.Credentials{
				Username: username,
				Password: password,
			}, false, nil
		}
	}

	fmt.Println("\nPor favor, insira suas credenciais:")

	usernamePrompt := promptui.Prompt{
		Label: "Usuário",
		Validate: func(input string) error {
			if len(input) < 3 {
				return fmt.Errorf("usuário deve ter pelo menos 3 caracteres")
			}
			return nil
		},
	}

	username, err := usernamePrompt.Run()
	if err != nil {
		return auth.Credentials{}, false, fmt.Errorf("erro ao ler usuário: %v", err)
	}

	passwordPrompt := promptui.Prompt{
		Label: "Senha",
		Mask:  '*',
		Validate: func(input string) error {
			if len(input) < 4 {
				return fmt.Errorf("senha deve ter pelo menos 4 caracteres")
			}
			return nil
		},
	}

	password, err := passwordPrompt.Run()
	if err != nil {
		return auth.Credentials{}, false, fmt.Errorf("erro ao ler senha: %v", err)
	}

	return auth.Credentials{
		Username: username,
		Password: password,
	}, true, nil
}

func salvarCredenciais(credenciais auth.Credentials) error {
	configDir, err := obterDiretorioConfig()
	if err != nil {
		return err
	}

	prompt := promptui.Prompt{
		Label:     "Deseja salvar as credenciais? (Recomendado)",
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := prompt.Run()
	if err == promptui.ErrAbort || resultado != "y" && resultado != "Y" {
		fmt.Println("\nCredenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
		return nil
	}

	envFile := filepath.Join(configDir, envFileName)
	envContent := fmt.Sprintf("USERNAME_PONTO=%s\nPASSWORD_PONTO=%s\n", credenciais.Username, credenciais.Password)
	if err := os.WriteFile(envFile, []byte(envContent), 0600); err != nil {
		return fmt.Errorf("não foi possível salvar as credenciais: %v", err)
	}

	fmt.Println("\nCredenciais salvas com sucesso")
	return nil
}

func gerenciarLocalizacao(gerenciador *clockin.GerenciadorPonto) (bool, error) {
	localizacaoAtual, err := gerenciador.ObterLocalizacaoAtual()
	if err != nil {
		return false, fmt.Errorf("erro obtendo localização atual: %v", err)
	}

	fmt.Printf("\nLocalização atual: %s\n", localizacaoAtual)

	prompt := promptui.Prompt{
		Label:     "Deseja alterar a localização",
		IsConfirm: true,
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			fmt.Printf("\nMantendo localização: %s\n", localizacaoAtual)
			return false, nil
		}
		return false, fmt.Errorf("erro na confirmação: %v", err)
	}

	if resultado != "y" && resultado != "Y" {
		fmt.Printf("\nMantendo localização: %s\n", localizacaoAtual)
		return false, nil
	}

	fmt.Print("\nBuscando localizações disponíveis...")
	localizacoes, err := gerenciador.ObterLocalizacoesDisponiveis()
	if err != nil {
		fmt.Println(" ERRO")
		return false, fmt.Errorf("erro obtendo localizações: %v", err)
	}
	fmt.Println(" OK")

	if len(localizacoes) == 0 {
		return false, fmt.Errorf("nenhuma localização disponível")
	}

	localizacaoSelecionada, err := ui.ExibirMenuLocalizacao(localizacoes)
	if err != nil {
		return false, fmt.Errorf("erro na seleção de localização: %v", err)
	}

	if localizacaoSelecionada.Nome == localizacaoAtual {
		fmt.Printf("\nMantendo localização: %s\n", localizacaoAtual)
		return false, nil
	}

	fmt.Printf("\nAlterando localização para: %s...", localizacaoSelecionada.Nome)
	if err := gerenciador.SelecionarLocalizacao(localizacaoSelecionada); err != nil {
		fmt.Println(" ERRO")
		return false, fmt.Errorf("erro ao selecionar localização: %v", err)
	}
	fmt.Println(" OK")

	return true, nil
}

func executarFluxoPonto(gerenciador *clockin.GerenciadorPonto) error {
	// Verifica e gerencia a localização primeiro
	if _, err := gerenciarLocalizacao(gerenciador); err != nil {
		return err
	}

	loading := ui.NewLoadingSpinner("Verificando operações disponíveis")
	loading.Start()
	operacoes, err := gerenciador.ObterOperacoesDisponiveis()
	if err != nil {
		loading.Error(err)
		return fmt.Errorf("erro obtendo operações disponíveis: %v", err)
	}
	loading.Success()

	if len(operacoes) == 0 {
		return fmt.Errorf("não há operações disponíveis no momento")
	}

	operacaoSelecionada, err := ui.ExibirMenuOperacao(operacoes)
	if err != nil {
		return fmt.Errorf("erro exibindo menu de operações: %v", err)
	}

	confirmado, err := ui.ExibirConfirmacao(operacaoSelecionada)
	if err != nil {
		return fmt.Errorf("erro exibindo confirmação: %v", err)
	}

	if !confirmado {
		return fmt.Errorf("operação cancelada pelo usuário")
	}

	loading = ui.NewLoadingSpinner("Marcando ponto")
	loading.Start()
	if err := gerenciador.ExecutarOperacao(operacaoSelecionada); err != nil {
		loading.Error(err)
		return fmt.Errorf("erro executando operação: %v", err)
	}
	loading.Success()

	return nil
}

func enviarMensagemSlack(slackSession *slack.SlackSession, tipoMensagem string) error {
	enviarMensagem, mensagem, err := ui.ExibirPromptEnviarMensagem(slackSession, tipoMensagem)
	if err != nil {
		return fmt.Errorf("erro ao configurar mensagem: %w", err)
	}

	if !enviarMensagem {
		return nil
	}

	loading := ui.NewLoadingSpinner("Enviando mensagem no Slack")
	loading.Start()
	if err := slackSession.SendMessage(mensagem); err != nil {
		loading.Error(err)
		return fmt.Errorf("erro ao enviar mensagem: %w", err)
	}
	loading.Success()

	return nil
}

func exibirMenuPrincipal() (string, error) {
	prompt := promptui.Select{
		Label: "Selecione a operação desejada",
		Items: []string{
			"Marcar ponto",
			"Enviar mensagem no Slack",
			"Marcar ponto e enviar mensagem",
			"Sair",
		},
	}

	_, resultado, err := prompt.Run()
	if err != nil {
		return "", fmt.Errorf("erro na seleção: %v", err)
	}

	return resultado, nil
}

func inicializarPonto(credenciais auth.Credentials) inicializacaoResult {
	// Configuração do navegador para o ponto
	sessaoPonto := auth.NewAuthSession()
	if sessaoPonto == nil {
		return inicializacaoResult{err: fmt.Errorf("falha ao criar sessão do ponto")}
	}

	// Tenta fazer login
	loading := ui.NewLoadingSpinner("Verificando credenciais do ponto")
	loading.Start()
	if err := sessaoPonto.Login(credenciais); err != nil {
		sessaoPonto.Close()
		loading.Error(err)
		return inicializacaoResult{err: fmt.Errorf("erro ao fazer login: %w", err)}
	}
	loading.Success()

	// Cria gerenciador de ponto com contexto
	gerenciador := clockin.NewGerenciadorPonto(sessaoPonto.GetContext())
	if gerenciador == nil {
		sessaoPonto.Close()
		return inicializacaoResult{err: fmt.Errorf("falha ao criar gerenciador de ponto")}
	}

	return inicializacaoResult{
		sessaoPonto: sessaoPonto,
		gerenciador: gerenciador,
	}
}

func inicializarSlack(ctx context.Context, configDir string) inicializacaoResult {
	slackSession := slack.NewSlackSession(ctx)
	if slackSession == nil {
		return inicializacaoResult{err: fmt.Errorf("falha ao criar sessão do Slack")}
	}

	if err := ui.ExibirPromptSlack(configDir, slackSession); err != nil {
		slackSession.Close()
		return inicializacaoResult{err: fmt.Errorf("erro ao configurar Slack: %w", err)}
	}

	return inicializacaoResult{
		slackSession: slackSession,
	}
}
