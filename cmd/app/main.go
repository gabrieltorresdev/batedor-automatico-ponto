package main

import (
	"context"
	"errors"
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
	const mocarPonto = false // Altere para false para usar o sistema real

	// Carrega credenciais
	loading := uiModule.ShowSpinner("Carregando credenciais")
	loading.Start()
	creds, err := auth.CarregarCredenciais()
	credenciaisNaoSalvas := false
	if err != nil {
		if err == auth.ErrCredenciaisNaoEncontradas {
			loading.Stop() // Para o spinner antes de solicitar as credenciais
			credenciaisNaoSalvas = true
			creds, err = auth.SolicitarCredenciais()
			if err != nil {
				fmt.Println("Erro ao obter credenciais:", err)
				os.Exit(1)
			}
		} else {
			loading.Error(err)
			fmt.Println("Erro ao carregar credenciais:", err)
			os.Exit(1)
		}
	} else {
		loading.Success()
	}

	// Inicializa o módulo de autenticação
	loading = uiModule.ShowSpinner("Inicializando autenticação")
	loading.Start()
	authModule, err := auth.NewModule(auth.Config{
		Headless: true,
		UseMock:  mocarPonto,
	})
	if err != nil {
		loading.Error(err)
		fmt.Println("Erro ao iniciar módulo de autenticação:", err)
		os.Exit(1)
	}
	loading.Success()

	// Loop de tentativas de login
	var loginSucesso bool
	for !loginSucesso {
		// Faz login
		loading = uiModule.ShowSpinner("Realizando login")
		loading.Start()
		err = authModule.Login(creds)
		if err != nil {
			loading.Error(err)
			var loginErr *auth.LoginError
			if errors.As(err, &loginErr) && loginErr.Type == "auth" {
				fmt.Println("\nPor favor, tente novamente.")
				creds, err = auth.SolicitarCredenciais()
				if err != nil {
					fmt.Println("Erro ao obter credenciais:", err)
					os.Exit(1)
				}
				credenciaisNaoSalvas = true
				continue
			}
			fmt.Println("Erro ao fazer login:", err)
			os.Exit(1)
		}
		loading.Success()
		loginSucesso = true
	}

	// Se as credenciais não estavam salvas e o login foi bem sucedido, oferece salvar
	if credenciaisNaoSalvas {
		resultado, err := auth.ConfirmarSalvamentoCredenciais(creds)

		if err != nil {
			if err == promptui.ErrAbort {
				fmt.Println("\nCredenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
			} else {
				fmt.Println("Erro ao confirmar salvamento de credenciais:", err)
			}
		}

		if resultado {
			if err := auth.SalvarCredenciais(creds); err != nil {
				fmt.Printf("\n⚠️  Aviso: não foi possível salvar as credenciais: %v\n", err)
			} else {
				fmt.Println("\nCredenciais salvas com sucesso")
			}
		} else {
			fmt.Println("\nCredenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
		}
	}

	// Inicializa o módulo de ponto
	loading = uiModule.ShowSpinner("Inicializando módulo de ponto")
	loading.Start()
	pontoModule := clockin.NewModule(authModule.GetContext(), clockin.Config{
		UseMock: mocarPonto,
	})
	loading.Success()

	// Tenta inicializar o módulo do Slack
	loading = uiModule.ShowSpinner("Configurando Slack")
	loading.Start()
	slackModule, err := slack.NewModulo(ctx, slack.Configuracao{
		DiretorioConfig: os.Getenv("HOME") + "/.batedorponto",
		ModoSilencioso:  true,
	})
	if err != nil {
		loading.Error(err)
		fmt.Printf("\n⚠️  Aviso: Funcionalidades do Slack não estarão disponíveis: %v\n", err)
		slackModule = nil
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
		opcao, err := ui.ExibirMenuPrincipal(slackModule != nil)
		if err != nil {
			fmt.Println("Erro no menu:", err)
			continue
		}

		if opcao == ui.OpSair {
			fmt.Println("\nEncerrando...")
			break
		}

		// Se o usuário optar por marcar ponto
		marcarPonto := opcao == ui.OpSomentePonto || opcao == ui.OpPontoCompletoSlack
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

			// Atualiza o status do Slack se necessário
			if opcao == ui.OpPontoCompletoSlack {
				// Obtém o status atual primeiro
				loading = uiModule.ShowSpinner("Obtendo status atual")
				loading.Start()
				statusAtual, err := slackModule.ObterStatusAtual()
				if err != nil {
					loading.Error(err)
					fmt.Println("Erro ao obter status atual:", err)
					continue
				}
				loading.Success()

				localizacaoAtual, err := pontoModule.ObterLocalizacaoAtual()
				if err != nil {
					fmt.Println("Erro ao obter localização atual:", err)
					continue
				}

				novoStatus := slack.DeterminarStatus(operacao, localizacaoAtual)
				confirmado, err := slack.ConfirmarAlteracaoStatus(statusAtual, novoStatus)
				if err != nil {
					fmt.Println("Erro na confirmação do status:", err)
					continue
				}

				if confirmado {
					loading = uiModule.ShowSpinner("Atualizando status no Slack")
					loading.Start()
					if err := slackModule.DefinirStatus(novoStatus); err != nil {
						loading.Error(err)
						fmt.Println("Erro ao atualizar status:", err)
						continue
					}
					loading.Success()
				}

				// Prepara e envia mensagem
				tipoMensagem := determinarTipoMensagem(operacoes)
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
				if err := slackModule.EnviarMensagem(mensagem); err != nil {
					loading.Error(err)
					fmt.Println("Erro ao enviar mensagem:", err)
					continue
				}
				loading.Success()
			}
		}

		// Se o usuário optar por gerenciar status do Slack
		if opcao == ui.OpStatusSlack {
			// Obtém o status atual
			loading = uiModule.ShowSpinner("Obtendo status atual")
			loading.Start()
			statusAtual, err := slackModule.ObterStatusAtual()
			if err != nil {
				loading.Error(err)
				fmt.Println("Erro ao obter status:", err)
				continue
			}
			loading.Success()

			// Exibe o status atual
			slack.ExibirStatusAtual(statusAtual)

			// Pergunta se deseja limpar ou alterar
			prompt := promptui.Select{
				Label: "O que deseja fazer",
				Items: []string{
					"Alterar status",
					"Limpar status",
					"Voltar",
				},
			}

			_, acao, err := prompt.Run()
			if err != nil {
				fmt.Println("Erro na seleção:", err)
				continue
			}

			switch acao {
			case "Alterar status":
				novoStatus, err := slack.SelecionarStatus(statusAtual)
				if err != nil {
					fmt.Println("Erro ao selecionar status:", err)
					continue
				}

				confirmado, err := slack.ConfirmarAlteracaoStatus(statusAtual, novoStatus)
				if err != nil {
					fmt.Println("Erro na confirmação:", err)
					continue
				}

				if !confirmado {
					fmt.Println("\n✖ Alteração cancelada")
					continue
				}

				loading = uiModule.ShowSpinner("Atualizando status")
				loading.Start()
				if err := slackModule.DefinirStatus(novoStatus); err != nil {
					loading.Error(err)
					fmt.Println("Erro ao atualizar status:", err)
					continue
				}
				loading.Success()

			case "Limpar status":
				confirmado, err := slack.ConfirmarLimpezaStatus(statusAtual)
				if err != nil {
					fmt.Println("Erro na confirmação:", err)
					continue
				}

				if !confirmado {
					fmt.Println("\n✖ Operação cancelada")
					continue
				}

				loading = uiModule.ShowSpinner("Limpando status")
				loading.Start()
				if err := slackModule.LimparStatus(); err != nil {
					loading.Error(err)
					fmt.Println("Erro ao limpar status:", err)
					continue
				}
				loading.Success()
			}
		}

		// Se o usuário optar por enviar mensagem no Slack
		if opcao == ui.OpMensagemSlack {
			tipoMensagem, err := selecionarTipoMensagem()
			if err != nil {
				fmt.Println("Erro ao selecionar tipo de mensagem:", err)
				continue
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
			if err := slackModule.EnviarMensagem(mensagem); err != nil {
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
	// Primeiro verifica se há operações disponíveis
	operacoes, _ := pontoModule.ObterOperacoesDisponiveis()
	forcarSelecao := len(operacoes) == 0

	localizacaoAtual, err := pontoModule.ObterLocalizacaoAtual()
	if err != nil {
		return false, fmt.Errorf("erro obtendo localização atual: %w", err)
	}

	fmt.Printf("\nLocalização atual: %s\n", localizacaoAtual)

	if forcarSelecao {
		fmt.Println("⚠️  É necessário selecionar uma localização para habilitar as operações")
	} else {
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

	if !forcarSelecao && localizacaoSelecionada.Nome == localizacaoAtual {
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

	// Aguarda um momento e verifica se as operações estão disponíveis
	loading = uiModule.ShowSpinner("Aguardando operações serem habilitadas")
	loading.Start()
	time.Sleep(2 * time.Second) // Aguarda 2 segundos para a interface atualizar
	operacoes, err = pontoModule.ObterOperacoesDisponiveis()
	if err != nil || len(operacoes) == 0 {
		loading.Error(fmt.Errorf("operações não foram habilitadas após selecionar localização"))
		return false, fmt.Errorf("operações não disponíveis após selecionar localização")
	}
	loading.Success()

	return true, nil
}
