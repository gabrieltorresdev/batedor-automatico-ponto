package main

import (
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/ui"
	"github.com/joho/godotenv"
	"github.com/manifoldco/promptui"
)

func obterDiretorioConfig() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("erro ao obter diretório home: %v", err)
	}

	configDir := filepath.Join(homeDir, ".batedorponto")
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

	envFile := filepath.Join(configDir, ".env")
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

	fmt.Println("\n📝 Por favor, insira suas credenciais:")

	usernamePrompt := promptui.Prompt{
		Label: "👤 Usuário",
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
		Label: "🔒 Senha",
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
		Label:     "💾 Deseja salvar as credenciais? (Recomendado)",
		IsConfirm: true,
		Default:   "y",
	}

	resultado, err := prompt.Run()
	if err == promptui.ErrAbort || resultado != "y" && resultado != "Y" {
		fmt.Println("\n⚠️  Credenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
		return nil
	}

	envFile := filepath.Join(configDir, ".env")
	envContent := fmt.Sprintf("USERNAME_PONTO=%s\nPASSWORD_PONTO=%s\n", credenciais.Username, credenciais.Password)
	if err := os.WriteFile(envFile, []byte(envContent), 0600); err != nil {
		return fmt.Errorf("não foi possível salvar as credenciais: %v", err)
	}

	fmt.Println("\n✓ Credenciais salvas com sucesso!")
	return nil
}

func configurarLimpeza(sessao auth.BrowserSession) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Print("\n\n🔄 Encerrando programa...")
		sessao.Close()
		fmt.Println(" ✓")
		os.Exit(0)
	}()
}

func gerenciarLocalizacao(gerenciador *clockin.GerenciadorPonto) error {
	localizacaoAtual, err := gerenciador.ObterLocalizacaoAtual()
	if err != nil {
		return fmt.Errorf("erro obtendo localização atual: %v", err)
	}

	fmt.Printf("\n📍 Localização atual: %s\n", localizacaoAtual)

	prompt := promptui.Prompt{
		Label:     "Deseja alterar a localização",
		IsConfirm: true,
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			fmt.Printf("\n✓ Mantendo localização: %s\n", localizacaoAtual)
			return nil
		}
		return fmt.Errorf("erro na confirmação: %v", err)
	}

	if resultado != "y" && resultado != "Y" {
		fmt.Printf("\n✓ Mantendo localização: %s\n", localizacaoAtual)
		return nil
	}

	fmt.Print("\n🔍 Buscando localizações disponíveis...")
	localizacoes, err := gerenciador.ObterLocalizacoesDisponiveis()
	if err != nil {
		fmt.Println(" ❌")
		return fmt.Errorf("erro obtendo localizações: %v", err)
	}
	fmt.Println(" ✓")

	if len(localizacoes) == 0 {
		return fmt.Errorf("nenhuma localização disponível")
	}

	localizacaoSelecionada, err := ui.ExibirMenuLocalizacao(localizacoes)
	if err != nil {
		return fmt.Errorf("erro na seleção de localização: %v", err)
	}

	if localizacaoSelecionada.Nome == localizacaoAtual {
		fmt.Printf("\n✓ Mantendo localização: %s\n", localizacaoAtual)
		return nil
	}

	fmt.Printf("\n🔄 Alterando localização para: %s...", localizacaoSelecionada.Nome)
	if err := gerenciador.SelecionarLocalizacao(localizacaoSelecionada); err != nil {
		fmt.Println(" ❌")
		return fmt.Errorf("erro ao selecionar localização: %v", err)
	}
	fmt.Println(" ✓")

	return nil
}

func executarOperacaoPonto(gerenciador *clockin.GerenciadorPonto) error {
	// Sempre verifica e gerencia a localização primeiro
	if err := gerenciarLocalizacao(gerenciador); err != nil {
		return err
	}

	fmt.Print("\n🔍 Verificando operações disponíveis...")
	operacoes, err := gerenciador.ObterOperacoesDisponiveis()
	if err != nil {
		fmt.Println(" ❌")
		return fmt.Errorf("erro obtendo operações disponíveis: %v", err)
	}
	fmt.Println(" ✓")

	if len(operacoes) == 0 {
		return fmt.Errorf("não há operações disponíveis no momento")
	}

	fmt.Println("\n⚡ Operações disponíveis:")
	for _, op := range operacoes {
		fmt.Printf("   • %s\n", op)
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

	fmt.Printf("\n⏳ Executando operação '%s'...", operacaoSelecionada)
	if err := gerenciador.ExecutarOperacao(operacaoSelecionada); err != nil {
		fmt.Println(" ❌")
		return fmt.Errorf("erro executando operação: %v", err)
	}
	fmt.Println(" ✓")

	return nil
}

func main() {
	fmt.Println("\n🕒 Batedor de Ponto - Oliveira Trust")
	fmt.Println("=====================================")

	fmt.Print("\n⚙️  Iniciando sistema...")
	sessao := auth.NewAuthSession()
	defer sessao.Close()
	configurarLimpeza(sessao)
	fmt.Println(" ✓")

	for {
		credenciais, novasCredenciais, err := carregarCredenciais()
		if err != nil {
			fmt.Printf("\n❌ Erro: %v\n", err)
			os.Exit(1)
		}

		fmt.Print("\n🔑 Realizando login...")
		err = sessao.Login(credenciais)
		if err != nil {
			if _, ok := err.(*auth.LoginError); ok && err.Error() == "credenciais inválidas" {
				fmt.Println(" ❌")
				fmt.Println("\n⚠️  Credenciais inválidas. Por favor, tente novamente.")
				continue
			}
			fmt.Printf(" ❌\n\n❌ Erro no login: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(" ✓")

		if novasCredenciais {
			if err := salvarCredenciais(credenciais); err != nil {
				fmt.Printf("\n⚠️  %v\n", err)
			}
		}

		break
	}

	gerenciador := clockin.NewGerenciadorPonto(sessao.GetContext())
	if err := executarOperacaoPonto(gerenciador); err != nil {
		fmt.Printf("\n❌ %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n✨ Operação concluída com sucesso!")
}
