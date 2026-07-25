package styles

import "github.com/charmbracelet/lipgloss"

var (
	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FAFAFA")).
			Background(lipgloss.Color("#4338CA")).
			Padding(0, 1)

	ColumnTitleStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#E2E8F0")).
				Background(lipgloss.Color("#1E293B")).
				Padding(0, 1).
				MarginBottom(1)

	CardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#475569")).
			Padding(0, 1).
			MarginBottom(1)

	SelectedCardStyle = CardStyle.Copy().
				BorderForeground(lipgloss.Color("#6366F1")).
				Background(lipgloss.Color("#1E1B4B"))

	TierAStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#22C55E"))
	TierBStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#3B82F6"))
	TierCStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#EAB308"))
	TierDStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#EF4444"))

	StatsStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#94A3B8")).
			Background(lipgloss.Color("#0F172A")).
			Padding(0, 1)
)
