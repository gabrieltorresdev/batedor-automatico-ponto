package slack

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
	"github.com/manifoldco/promptui"
)

// Status predefinidos
var (
	StatusTrabalhoPresencial = Status{
		Emoji:    ":ot:",
		Mensagem: "Trabalhando Presencialmente",
	}

	StatusHomeOffice = Status{
		Emoji:    ":house_with_garden:",
		Mensagem: "Trabalhando remotamente",
	}

	StatusAlmoco = Status{
		Emoji:    ":knife_fork_plate:",
		Mensagem: "Almoçando",
	}

	StatusCafe = Status{
		Emoji:    ":coffee:",
		Mensagem: "Hora do Café",
	}

	StatusFimExpediente = Status{
		Emoji:    ":bed:",
		Mensagem: "Fora do Expediente",
	}
)

// FormatStatus formata um status para exibição
func FormatStatus(status *Status) string {
	if status == nil {
		return color.New(color.FgYellow).Sprint("Nenhum status definido")
	}
	return fmt.Sprintf("%s %s", color.HiCyanString(status.Emoji), color.CyanString(status.Mensagem))
}

// ExibirStatusAtual exibe o status atual formatado
func ExibirStatusAtual(status *Status) {
	fmt.Printf("\nStatus atual: %s\n", FormatStatus(status))
}

// DeterminarStatus determina o status com base no tipo de operação
func DeterminarStatus(operacao clockin.TipoOperacao, localizacao string) Status {
	switch operacao {
	case clockin.Entrada:
		if localizacao == "Home Office" {
			return StatusHomeOffice
		}
		return StatusTrabalhoPresencial
	case clockin.Almoco:
		return StatusAlmoco
	case clockin.Saida:
		return StatusFimExpediente
	default:
		return Status{}
	}
}

// SelecionarStatus exibe um menu para selecionar um status
func SelecionarStatus(statusAtual *Status) (Status, error) {
	// Exibe o status atual antes de mostrar as opções
	ExibirStatusAtual(statusAtual)

	opcoes := []struct {
		Label string
		Value Status
	}{
		{"Trabalhando remotamente", StatusHomeOffice},
		{"Trabalhando presencialmente", StatusTrabalhoPresencial},
		{"Almoçando", StatusAlmoco},
		{"Hora do café", StatusCafe},
		{"Fora do expediente", StatusFimExpediente},
	}

	var items []string
	for _, op := range opcoes {
		items = append(items, fmt.Sprintf("%s %s", op.Value.Emoji, op.Value.Mensagem))
	}

	prompt := promptui.Select{
		Label: "Selecione o novo status",
		Items: items,
	}

	idx, _, err := prompt.Run()
	if err != nil {
		return Status{}, fmt.Errorf("erro na seleção: %w", err)
	}

	return opcoes[idx].Value, nil
}

// ConfirmarAlteracaoStatus exibe um prompt de confirmação para alterar o status
func ConfirmarAlteracaoStatus(statusAtual *Status, novoStatus Status) (bool, error) {
	// Exibe o status atual e o novo status
	ExibirStatusAtual(statusAtual)
	fmt.Printf("Novo status: %s\n", FormatStatus(&novoStatus))

	prompt := promptui.Prompt{
		Label:     "Confirma a alteração",
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			return false, nil
		}
		return false, fmt.Errorf("erro na confirmação: %w", err)
	}

	return resultado == "y" || resultado == "Y", nil
}

// ConfirmarLimpezaStatus exibe um prompt de confirmação para limpar o status
func ConfirmarLimpezaStatus(statusAtual *Status) (bool, error) {
	// Exibe o status atual
	ExibirStatusAtual(statusAtual)

	if statusAtual == nil {
		fmt.Println("\n⚠️  Não há status para limpar")
		return false, nil
	}

	prompt := promptui.Prompt{
		Label:     "Confirma limpar o status atual",
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			return false, nil
		}
		return false, fmt.Errorf("erro na confirmação: %w", err)
	}

	return resultado == "y" || resultado == "Y", nil
}
