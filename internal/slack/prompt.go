package slack

import (
	"fmt"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/common"
	"github.com/manifoldco/promptui"
)

const (
	// Mensagens do Slack - Entrada
	mensagemBomDia = "Bom dia"
	mensagemVoltei = "Voltei"

	// Mensagens do Slack - Saída
	mensagemSaindo  = "Saindo"
	mensagemJaVolto = "Já volto"

	// Mensagens do Slack - Almoço
	mensagemAlmoco = "Almoço"

	// Mensagens de erro
	errConfigSlack       = "erro na configuração do Slack"
	errEnvioMensagem     = "erro ao enviar mensagem"
	errSlackIndisponivel = "Slack indisponível"
)

// Cache de prompts pré-configurados
var (
	mensagensEntrada = []string{mensagemBomDia, mensagemVoltei}
	mensagensSaida   = []string{mensagemSaindo, mensagemJaVolto}

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

// ConfigurarSlack configura a sessão do Slack, incluindo autenticação se necessário
func (s *SlackSession) ConfigurarSlack(configDir string, spinner common.LoadingSpinner) error {
	// Tenta carregar cookies existentes
	if err := s.LoadCookies(configDir); err == nil {
		spinner.Update("Verificando configuração do Slack")
		spinner.Start()
		if err := s.validateSessionOnly(); err == nil {
			spinner.Success()
			return nil
		} else {
			spinner.Error(err)
			fmt.Println("Sessão do Slack expirada, necessário fazer login novamente")
		}
	}

	fmt.Println("\nIniciando configuração do Slack")

	// Inicia o processo de autenticação
	if err := s.Authenticate(); err != nil {
		return fmt.Errorf("%s: %w", errConfigSlack, err)
	}

	// Salva os cookies após autenticação bem-sucedida
	spinner.Update("Salvando configuração do Slack")
	spinner.Start()
	if err := s.SaveCookies(configDir); err != nil {
		spinner.Error(err)
		return fmt.Errorf("erro ao salvar cookies do Slack: %w", err)
	}
	spinner.Success()

	return nil
}

// PrepararMensagem prepara a mensagem a ser enviada com base no tipo
func (s *SlackSession) PrepararMensagem(tipoMensagem string) (bool, string, error) {
	var mensagem string
	var err error

	switch tipoMensagem {
	case "entrada":
		mensagem, err = selecionarMensagemEntrada()
	case "refeicao":
		mensagem = mensagemAlmoco
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
