package ui

import (
	"fmt"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/src/clockin"
	"github.com/manifoldco/promptui"
)

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
		return clockin.Localizacao{}, fmt.Errorf("erro na seleção: %v", err)
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
		return -1, fmt.Errorf("erro na seleção: %v", err)
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
		return false, fmt.Errorf("erro na confirmação: %v", err)
	}

	return resultado == "y" || resultado == "Y", nil
}
