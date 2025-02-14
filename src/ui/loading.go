package ui

import (
	"fmt"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
)

const (
	spinnerCharset = 14 // Dots
	spinnerSpeed   = 100 * time.Millisecond
)

var (
	successColor = color.New(color.FgGreen).SprintFunc()
	errorColor   = color.New(color.FgRed).SprintFunc()
)

type LoadingSpinner struct {
	spinner *spinner.Spinner
	message string
}

// NewLoadingSpinner cria um novo spinner com a mensagem especificada
func NewLoadingSpinner(message string) *LoadingSpinner {
	s := spinner.New(spinner.CharSets[spinnerCharset], spinnerSpeed)
	s.Suffix = fmt.Sprintf(" %s", message)
	return &LoadingSpinner{
		spinner: s,
		message: message,
	}
}

// Start inicia a animação do spinner
func (l *LoadingSpinner) Start() {
	l.spinner.Start()
}

// Stop para a animação do spinner
func (l *LoadingSpinner) Stop() {
	l.spinner.Stop()
}

// Success para o spinner e exibe mensagem de sucesso
func (l *LoadingSpinner) Success() {
	l.Stop()
	fmt.Printf("%s %s\n", successColor("✓"), l.message)
}

// Error para o spinner e exibe mensagem de erro
func (l *LoadingSpinner) Error(err error) {
	l.Stop()
	fmt.Printf("%s %s: %v\n", errorColor("✗"), l.message, err)
}

// Update atualiza a mensagem do spinner
func (l *LoadingSpinner) Update(message string) {
	l.message = message
	l.spinner.Suffix = fmt.Sprintf(" %s", message)
}
