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
func (s *SessaoSlack) ConfigurarSlack(configDir string, spinner common.LoadingSpinner) error {
	// Tenta carregar cookies existentes
	if err := s.CarregarCookies(configDir); err == nil {
		spinner.Update("Verificando configuração do Slack")
		spinner.Start()
		if err := s.ValidarSessao(); err == nil {
			spinner.Success()
			return nil
		} else {
			spinner.Error(err)
			fmt.Println("Sessão do Slack expirada, necessário fazer login novamente")
		}
	}

	fmt.Println("\nIniciando configuração do Slack")

	// Inicia o processo de autenticação
	if err := s.Autenticar(); err != nil {
		return fmt.Errorf("%s: %w", errConfigSlack, err)
	}

	// Salva os cookies após autenticação bem-sucedida
	spinner.Update("Salvando configuração do Slack")
	spinner.Start()
	if err := s.SalvarCookies(configDir); err != nil {
		spinner.Error(err)
		return fmt.Errorf("erro ao salvar cookies do Slack: %w", err)
	}
	spinner.Success()

	return nil
}

// PrepararMensagem prepara uma mensagem baseada no tipo
func (s *SessaoSlack) PrepararMensagem(tipoMensagem string) (bool, string, error) {
	var mensagem string

	switch tipoMensagem {
	case "entrada":
		mensagem = "Bom dia! Iniciando expediente. 🌅"
	case "refeicao":
		mensagem = "Saindo para almoço! 🍽️"
	case "saida":
		mensagem = "Encerrando expediente. Até amanhã! 👋"
	default:
		return false, "", fmt.Errorf("tipo de mensagem inválido: %s", tipoMensagem)
	}

	// Confirma o envio da mensagem
	prompt := promptui.Prompt{
		Label:     fmt.Sprintf("Enviar mensagem: %s", mensagem),
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			return false, "", nil
		}
		return false, "", fmt.Errorf("erro na confirmação: %w", err)
	}

	return resultado == "y" || resultado == "Y", mensagem, nil
}
