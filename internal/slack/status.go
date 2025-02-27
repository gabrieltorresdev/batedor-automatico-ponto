package slack

import (
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/clockin"
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
