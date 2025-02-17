package ui

import (
	"fmt"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/manifoldco/promptui"
)

// OpcoesMenu define as opções disponíveis no menu principal
type OpcoesMenu string

const (
	// Opções do menu principal
	OpPontoCompletoSlack OpcoesMenu = "marcar_ponto_completo"
	OpSomentePonto       OpcoesMenu = "somente_ponto"
	OpMensagemSlack      OpcoesMenu = "mensagem_slack"
	OpStatusSlack        OpcoesMenu = "status_slack"
	OpSair               OpcoesMenu = "sair"
)

// menuItem representa um item do menu com sua descrição e valor
type menuItem struct {
	Descricao string
	Valor     OpcoesMenu
	Icone     string
}

// getMenuItems retorna os itens do menu principal
func getMenuItems(slackDisponivel bool) []menuItem {
	items := []menuItem{}

	if slackDisponivel {
		items = append(items, menuItem{
			Descricao: "Marcar ponto + Slack (mensagem e status)",
			Valor:     OpPontoCompletoSlack,
			Icone:     "✨",
		})
	}

	items = append(items, menuItem{
		Descricao: "Marcar ponto",
		Valor:     OpSomentePonto,
		Icone:     "🕒",
	})

	if slackDisponivel {
		items = append(items, []menuItem{
			{
				Descricao: "Enviar mensagem no Slack",
				Valor:     OpMensagemSlack,
				Icone:     "💬",
			},
			{
				Descricao: "Alterar status no Slack",
				Valor:     OpStatusSlack,
				Icone:     "🔄",
			},
		}...)
	}

	items = append(items, menuItem{
		Descricao: "Sair",
		Valor:     OpSair,
		Icone:     "👋",
	})

	return items
}

// ExibirMenuPrincipal displays the main menu
func ExibirMenuPrincipal(slackDisponivel bool) (OpcoesMenu, error) {
	items := getMenuItems(slackDisponivel)

	// Prepara os itens formatados para exibição
	var displayItems []string
	for _, item := range items {
		displayItems = append(displayItems, fmt.Sprintf("%s  %s", item.Icone, item.Descricao))
	}

	prompt := promptui.Select{
		Label: "Selecione a operação desejada",
		Items: displayItems,
		Size:  len(displayItems),
	}

	idx, _, err := prompt.Run()
	if err != nil {
		return "", fmt.Errorf("erro na seleção: %w", err)
	}

	return items[idx].Valor, nil
}

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
