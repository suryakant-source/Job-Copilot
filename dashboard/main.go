package main

import (
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/antigravity/job-copilot-dash/db"
	"github.com/antigravity/job-copilot-dash/styles"
)

type ViewMode int

const (
	KanbanView ViewMode = iota
	TableView
	DetailView
)

var stages = []string{
	"Discovered", "Scored", "Tailored", "Applied", "Screening", "Interviewing", "Offer", "Rejected",
}

type model struct {
	jobs         []db.JobItem
	activeCol    int
	activeRow    int
	view         ViewMode
	selectedJob  *db.JobItem
	statusMsg    string
	searchFilter string
}

func initialModel() model {
	jobs, _ := db.FetchPipelineJobs("./job-copilot.db")
	return model{
		jobs:      jobs,
		activeCol: 0,
		activeRow: 0,
		view:      KanbanView,
		statusMsg: "Nav: h/j/k/l | Move: H/L | Toggle Table: Tab | Detail: Enter | Quit: q",
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "tab":
			if m.view == KanbanView {
				m.view = TableView
			} else {
				m.view = KanbanView
			}
		case "h":
			if m.activeCol > 0 {
				m.activeCol--
			}
		case "l":
			if m.activeCol < len(stages)-1 {
				m.activeCol++
			}
		case "j":
			m.activeRow++
		case "k":
			if m.activeRow > 0 {
				m.activeRow--
			}
		case "H":
			// Move card left in stage
			if m.activeCol > 0 {
				colJobs := m.getJobsInStage(stages[m.activeCol])
				if len(colJobs) > 0 && m.activeRow < len(colJobs) {
					targetJob := colJobs[m.activeRow]
					m.updateJobStatus(targetJob.ID, stages[m.activeCol-1])
					m.activeCol--
				}
			}
		case "L":
			// Move card right in stage
			if m.activeCol < len(stages)-1 {
				colJobs := m.getJobsInStage(stages[m.activeCol])
				if len(colJobs) > 0 && m.activeRow < len(colJobs) {
					targetJob := colJobs[m.activeRow]
					m.updateJobStatus(targetJob.ID, stages[m.activeCol+1])
					m.activeCol++
				}
			}
		case "enter":
			colJobs := m.getJobsInStage(stages[m.activeCol])
			if len(colJobs) > 0 && m.activeRow < len(colJobs) {
				m.selectedJob = &colJobs[m.activeRow]
				m.view = DetailView
			}
		case "esc":
			m.view = KanbanView
		}
	}
	return m, nil
}

func (m *model) updateJobStatus(jobID string, newStatus string) {
	for i := range m.jobs {
		if m.jobs[i].ID == jobID {
			m.jobs[i].Status = newStatus
			m.statusMsg = fmt.Sprintf("Moved %s -> %s", m.jobs[i].Company, newStatus)
			break
		}
	}
}

func (m model) getJobsInStage(stage string) []db.JobItem {
	var list []db.JobItem
	for _, j := range m.jobs {
		if strings.EqualFold(j.Status, stage) {
			list = append(list, j)
		}
	}
	return list
}

func (m model) View() string {
	b := strings.Builder{}

	// Header
	header := styles.HeaderStyle.Render("🤖 AI JOB SEARCH CO-PILOT DASHBOARD")
	b.WriteString(header + "\n\n")

	if m.view == DetailView && m.selectedJob != nil {
		b.WriteString(fmt.Sprintf("=== JOB DETAILS: %s at %s ===\n", m.selectedJob.Title, m.selectedJob.Company))
		b.WriteString(fmt.Sprintf("Status:   %s\n", m.selectedJob.Status))
		b.WriteString(fmt.Sprintf("Score:    %d/100 (Tier %s)\n", m.selectedJob.Score, m.selectedJob.Tier))
		b.WriteString(fmt.Sprintf("Location: %s\n\n", m.selectedJob.Location))
		b.WriteString("Press ESC to return to Kanban board.\n")
		return b.String()
	}

	if m.view == TableView {
		b.WriteString("COMPANY | TITLE | LOCATION | STATUS | SCORE | TIER\n")
		b.WriteString("--------------------------------------------------\n")
		for _, j := range m.jobs {
			b.WriteString(fmt.Sprintf("%s | %s | %s | %s | %d | %s\n", j.Company, j.Title, j.Location, j.Status, j.Score, j.Tier))
		}
		b.WriteString("\nPress Tab to switch to Kanban View.\n")
		return b.String()
	}

	// Kanban Board Rendering
	var cols []string
	for i, stage := range stages {
		stageJobs := m.getJobsInStage(stage)
		colStr := fmt.Sprintf("[%s (%d)]\n", stage, len(stageJobs))

		for jIdx, j := range stageJobs {
			cardText := fmt.Sprintf("%s\n%s\nScore: %d (%s)", j.Company, j.Title, j.Score, j.Tier)
			if i == m.activeCol && jIdx == m.activeRow {
				colStr += styles.SelectedCardStyle.Render(cardText) + "\n"
			} else {
				colStr += styles.CardStyle.Render(cardText) + "\n"
			}
		}
		cols = append(cols, colStr)
	}

	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, cols...))
	b.WriteString("\n\n" + styles.StatsStyle.Render(m.statusMsg))

	return b.String()
}

func main() {
	p := tea.NewProgram(initialModel())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error running dashboard: %v\n", err)
		os.Exit(1)
	}
}
