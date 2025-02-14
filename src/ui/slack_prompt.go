package ui

import (
	"fmt"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/slack"
	"github.com/manifoldco/promptui"
)

const (
	// Mensagens do Slack - Entrada
	MensagemBomDia = "Bom dia"
	MensagemVoltei = "Voltei"

	// Mensagens do Slack - Saída
	MensagemSaindo  = "Saindo"
	MensagemJaVolto = "Já volto"

	// Mensagens do Slack - Almoço
	MensagemAlmoco = "Almoço"

	// Mensagens de erro
	errConfigSlack       = "erro na configuração do Slack"
	errEnvioMensagem     = "erro ao enviar mensagem"
	errSlackIndisponivel = "Slack indisponível"
)

// Cache de prompts pré-configurados
var (
	mensagensEntrada = []string{MensagemBomDia, MensagemVoltei}
	mensagensSaida   = []string{MensagemSaindo, MensagemJaVolto}

	promptEntrada = &promptui.Select{
		Label: "Selecione a mensagem",
		Items: mensagensEntrada,
	}

	promptSaida = &promptui.Select{
		Label: "Selecione a mensagem",
		Items: mensagensSaida,
	}

	promptConfirmacao = &promptui.Prompt{
		Label:     "Confirma",
		IsConfirm: true,
		Default:   "n",
	}
)

func selecionarMensagemEntrada() (string, error) {
	_, resultado, err := promptEntrada.Run()
	if err != nil {
		return "", fmt.Errorf("erro na seleção: %v", err)
	}
	return resultado, nil
}

func selecionarMensagemSaida() (string, error) {
	_, resultado, err := promptSaida.Run()
	if err != nil {
		return "", fmt.Errorf("erro na seleção: %v", err)
	}
	return resultado, nil
}

func ExibirPromptSlack(configDir string, slackSession *slack.SlackSession) error {
	// Verifica se já existe uma sessão salva
	if err := slackSession.LoadCookies(configDir); err == nil {
		loading := NewLoadingSpinner("Verificando configuração do Slack")
		loading.Start()
		if err := slackSession.ValidateSession(); err == nil {
			loading.Success()
			return nil
		} else {
			loading.Error(err)
			fmt.Println("Sessão do Slack expirada, necessário fazer login novamente")
		}
	}

	fmt.Println("\nIniciando configuração do Slack")

	// Inicia o processo de autenticação
	if err := slackSession.Authenticate(); err != nil {
		return fmt.Errorf("%s: %w", errConfigSlack, err)
	}

	// Salva os cookies após autenticação bem-sucedida
	loading := NewLoadingSpinner("Salvando configuração do Slack")
	loading.Start()
	if err := slackSession.SaveCookies(configDir); err != nil {
		loading.Error(err)
		return fmt.Errorf("erro ao salvar cookies do Slack: %w", err)
	}
	loading.Success()

	return nil
}

func ExibirPromptEnviarMensagem(slackSession *slack.SlackSession, tipoMensagem string) (bool, string, error) {
	var mensagem string
	var err error

	switch tipoMensagem {
	case "entrada":
		mensagem, err = selecionarMensagemEntrada()
	case "refeicao":
		mensagem = MensagemAlmoco
	case "saida":
		mensagem, err = selecionarMensagemSaida()
	default:
		return false, "", fmt.Errorf("tipo de mensagem inválido: %s", tipoMensagem)
	}

	if err != nil {
		return false, "", fmt.Errorf("erro na seleção da mensagem: %w", err)
	}

	resultado, err := promptConfirmacao.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			return false, "", nil
		}
		return false, "", fmt.Errorf("%s: %w", errEnvioMensagem, err)
	}

	return resultado == "y" || resultado == "Y", mensagem, nil
}
