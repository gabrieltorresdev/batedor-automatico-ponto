package common

// LoadingSpinner defines the interface for loading spinners
type LoadingSpinner interface {
	// Start starts the spinner animation
	Start()

	// Stop stops the spinner animation
	Stop()

	// Success stops the spinner and shows a success message
	Success()

	// Error stops the spinner and shows an error message
	Error(err error)

	// Update updates the spinner message
	Update(message string)
}
