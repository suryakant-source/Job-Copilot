package main

import (
	"testing"
)

func TestInitialModel(t *testing.T) {
	m := initialModel()
	if len(m.jobs) == 0 {
		t.Errorf("Expected initial jobs in model, got 0")
	}
}
