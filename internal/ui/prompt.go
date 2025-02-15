package ui

import (
	"fmt"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/manifoldco/promptui"
)

// NewPrompt creates a new select prompt with the given label and items
func NewPrompt(label string, items []string) *promptui.Select {
	return &promptui.Select{
		Label: label,
		Items: items,
	}
}

// NewConfirmPrompt creates a new confirmation prompt with the given label
func NewConfirmPrompt(label string) *promptui.Prompt {
	return &promptui.Prompt{
		Label:     label,
		IsConfirm: true,
	}
}

// ExibirMenuPrincipal displays the main menu
func ExibirMenuPrincipal() (string, error) {
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
		return "", fmt.Errorf("erro na seleção: %w", err)
	}

	return resultado, nil
}

func ExibirMenuLocalizacao(localizacoes []clockin.Localizacao) (clockin.Localizacao, error) {
	var itens []string
	mapaLocalizacoes := make(map[string]clockin.Localizacao)

	for _, loc := range localizacoes {
		itens = append(itens, loc.Nome)
		mapaLocalizacoes[loc.Nome] = loc
	}

	prompt := promptui.Select{
		Label: "Selecione a localização",
		Items: itens,
	}

	_, nomeSelecionado, err := prompt.Run()
	if err != nil {
		return clockin.Localizacao{}, fmt.Errorf("erro na seleção: %w", err)
	}

	return mapaLocalizacoes[nomeSelecionado], nil
}

func ExibirMenuOperacao(operacoes []clockin.TipoOperacao) (clockin.TipoOperacao, error) {
	var itens []string
	for _, op := range operacoes {
		itens = append(itens, op.String())
	}

	prompt := promptui.Select{
		Label: "Selecione a operação desejada",
		Items: itens,
	}

	idx, _, err := prompt.Run()
	if err != nil {
		return -1, fmt.Errorf("erro na seleção: %w", err)
	}

	return operacoes[idx], nil
}

func ExibirConfirmacao(operacao clockin.TipoOperacao) (bool, error) {
	prompt := promptui.Prompt{
		Label:     fmt.Sprintf("Confirma a operação '%s'", operacao),
		IsConfirm: true,
	}

	resultado, err := prompt.Run()
	if err != nil {
		return false, fmt.Errorf("erro na confirmação: %w", err)
	}

	return resultado == "y" || resultado == "Y", nil
}
