package ui

import (
	"fmt"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/common"
)

const (
	spinnerCharset = 14 // Dots
	spinnerSpeed   = 100 * time.Millisecond
)

var (
	successColor = color.New(color.FgGreen).SprintFunc()
	errorColor   = color.New(color.FgRed).SprintFunc()
)

// LoadingSpinner implements the common.LoadingSpinner interface
type LoadingSpinner struct {
	spinner *spinner.Spinner
	message string
}

// NewLoadingSpinner creates a new loading spinner with the specified message
func NewLoadingSpinner(message string) common.LoadingSpinner {
	s := spinner.New(spinner.CharSets[spinnerCharset], spinnerSpeed)
	s.Suffix = fmt.Sprintf(" %s", message)
	return &LoadingSpinner{
		spinner: s,
		message: message,
	}
}

// Start starts the spinner animation
func (l *LoadingSpinner) Start() {
	l.spinner.Start()
}

// Stop stops the spinner animation
func (l *LoadingSpinner) Stop() {
	l.spinner.Stop()
}

// Success stops the spinner and shows a success message
func (l *LoadingSpinner) Success() {
	l.Stop()
	fmt.Printf("%s %s\n", successColor("✓"), l.message)
}

// Error stops the spinner and shows an error message
func (l *LoadingSpinner) Error(err error) {
	l.Stop()
	fmt.Printf("%s %s: %v\n", errorColor("✗"), l.message, err)
}

// Update updates the spinner message
func (l *LoadingSpinner) Update(message string) {
	l.message = message
	l.spinner.Suffix = fmt.Sprintf(" %s", message)
}
