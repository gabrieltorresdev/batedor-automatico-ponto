package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/auth"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/slack"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/ui"
	"github.com/manifoldco/promptui"
)

const timeoutGlobal = 10 * time.Minute

func main() {
	fmt.Println("\nBatedor de Ponto - Oliveira Trust")
	fmt.Println("==================================")

	ctx, cancel := context.WithTimeout(context.Background(), timeoutGlobal)
	defer cancel()

	// Inicializa o módulo de UI
	uiModule := ui.NewModule()

	// Define se usará mock para desenvolvimento
	const mocarPonto = true // Altere para false para usar o sistema real

	// Carrega credenciais
	loading := uiModule.ShowSpinner("Carregando credenciais")
	loading.Start()
	creds, err := auth.CarregarCredenciais()
	if err != nil {
		loading.Error(err)
		fmt.Println("Erro ao carregar credenciais:", err)
		os.Exit(1)
	}
	loading.Success()

	// Inicializa o módulo de autenticação
	loading = uiModule.ShowSpinner("Inicializando autenticação")
	loading.Start()
	authModule, err := auth.NewModule(auth.Config{
		Headless: true,
		UseMock:  mocarPonto, // Usa a mesma configuração de mock
	})
	if err != nil {
		loading.Error(err)
		fmt.Println("Erro ao iniciar módulo de autenticação:", err)
		os.Exit(1)
	}
	loading.Success()

	// Faz login
	loading = uiModule.ShowSpinner("Realizando login")
	loading.Start()
	if err := authModule.Login(creds); err != nil {
		loading.Error(err)
		fmt.Println("Erro ao fazer login:", err)
		os.Exit(1)
	}
	loading.Success()

	// Inicializa o módulo de ponto
	loading = uiModule.ShowSpinner("Inicializando módulo de ponto")
	loading.Start()
	pontoModule := clockin.NewModule(authModule.GetContext(), clockin.Config{
		UseMock: mocarPonto, // Usa a mesma configuração de mock
	})
	loading.Success()

	// Tenta inicializar o módulo do Slack
	loading = uiModule.ShowSpinner("Configurando Slack")
	loading.Start()
	slackModule, err := slack.NewModule(ctx, slack.Config{
		ConfigDir: os.Getenv("HOME") + "/.batedorponto",
	})
	if err != nil {
		loading.Error(err)
		fmt.Println("Aviso: Slack não configurado:", err)
	} else {
		loading.Success()
	}

	// Configuração para encerramento limpo via sinais
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Print("\nEncerrando programa...")
		authModule.Close()
		if slackModule != nil {
			slackModule.Close()
		}
		fmt.Println(" OK")
		os.Exit(0)
	}()

	// Loop principal com seleção de operação
	for {
		opcao, err := ui.ExibirMenuPrincipal()
		if err != nil {
			fmt.Println("Erro no menu:", err)
			continue
		}

		if opcao == "Sair" {
			fmt.Println("\nEncerrando...")
			break
		}

		// Se o usuário optar por marcar ponto
		marcarPonto := opcao == "Marcar ponto" || opcao == "Marcar ponto e enviar mensagem"
		if marcarPonto {
			// Gerencia localização
			if _, err := gerenciarLocalizacao(pontoModule, uiModule); err != nil {
				fmt.Println("Erro ao gerenciar localização:", err)
				continue
			}

			// Obtém operações disponíveis
			loading = uiModule.ShowSpinner("Verificando operações disponíveis")
			loading.Start()
			operacoes, err := pontoModule.ObterOperacoesDisponiveis()
			if err != nil {
				loading.Error(err)
				fmt.Println("Erro ao obter operações:", err)
				continue
			}
			loading.Success()

			// Seleciona e executa operação
			operacao, err := uiModule.ExibirMenuOperacao(operacoes)
			if err != nil {
				fmt.Println("Erro ao selecionar operação:", err)
				continue
			}

			confirmado, err := uiModule.ExibirConfirmacao(operacao)
			if err != nil {
				fmt.Println("Erro na confirmação:", err)
				continue
			}

			if !confirmado {
				fmt.Println("\n✖ Operação cancelada")
				continue
			}

			loading = uiModule.ShowSpinner("Marcando ponto")
			loading.Start()
			if err := pontoModule.ExecutarOperacao(operacao); err != nil {
				loading.Error(err)
				fmt.Println("Erro ao marcar ponto:", err)
				continue
			}
			loading.Success()
		}

		// Se o usuário optar por enviar mensagem e o Slack estiver configurado
		enviarMensagem := (opcao == "Enviar mensagem no Slack" || opcao == "Marcar ponto e enviar mensagem") && slackModule != nil
		if enviarMensagem {
			var tipoMensagem string
			if marcarPonto {
				operacoes, err := pontoModule.ObterOperacoesDisponiveis()
				if err != nil {
					fmt.Println("Erro ao determinar tipo de mensagem:", err)
					continue
				}
				tipoMensagem = determinarTipoMensagem(operacoes)
			} else {
				var err error
				tipoMensagem, err = selecionarTipoMensagem()
				if err != nil {
					fmt.Println("Erro ao selecionar tipo de mensagem:", err)
					continue
				}
			}

			enviar, mensagem, err := slackModule.PrepararMensagem(tipoMensagem)
			if err != nil {
				fmt.Println("Erro ao preparar mensagem:", err)
				continue
			}

			if !enviar {
				fmt.Println("\n✖ Envio cancelado")
				continue
			}

			loading = uiModule.ShowSpinner("Enviando mensagem no Slack")
			loading.Start()
			if err := slackModule.SendMessage(mensagem); err != nil {
				loading.Error(err)
				fmt.Println("Erro ao enviar mensagem:", err)
				continue
			}
			loading.Success()
		}

		fmt.Println()
	}

	// Cleanup final
	authModule.Close()
	if slackModule != nil {
		slackModule.Close()
	}
	fmt.Println("Programa finalizado")
}

// Função auxiliar para determinar o tipo de mensagem com base nas operações disponíveis
func determinarTipoMensagem(operacoes []clockin.TipoOperacao) string {
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

// Função auxiliar para gerenciar localização
func gerenciarLocalizacao(pontoModule clockin.Module, uiModule ui.Module) (bool, error) {
	localizacaoAtual, err := pontoModule.ObterLocalizacaoAtual()
	if err != nil {
		return false, fmt.Errorf("erro obtendo localização atual: %w", err)
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
		return false, fmt.Errorf("erro na confirmação: %w", err)
	}

	if resultado != "y" && resultado != "Y" {
		fmt.Printf("\nMantendo localização: %s\n", localizacaoAtual)
		return false, nil
	}

	loading := uiModule.ShowSpinner("Buscando localizações disponíveis")
	loading.Start()
	localizacoes, err := pontoModule.ObterLocalizacoesDisponiveis()
	if err != nil {
		loading.Error(err)
		return false, fmt.Errorf("erro obtendo localizações: %w", err)
	}
	loading.Success()

	if len(localizacoes) == 0 {
		return false, fmt.Errorf("nenhuma localização disponível")
	}

	localizacaoSelecionada, err := uiModule.ExibirMenuLocalizacao(localizacoes)
	if err != nil {
		return false, fmt.Errorf("erro na seleção de localização: %w", err)
	}

	if localizacaoSelecionada.Nome == localizacaoAtual {
		fmt.Printf("\nMantendo localização: %s\n", localizacaoAtual)
		return false, nil
	}

	loading = uiModule.ShowSpinner(fmt.Sprintf("Alterando localização para: %s", localizacaoSelecionada.Nome))
	loading.Start()
	if err := pontoModule.SelecionarLocalizacao(localizacaoSelecionada); err != nil {
		loading.Error(err)
		return false, fmt.Errorf("erro ao selecionar localização: %w", err)
	}
	loading.Success()

	return true, nil
}
