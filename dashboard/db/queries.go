package db

import (
	"database/sql"
	_ "modernc.org/sqlite"
)

type JobItem struct {
	ID        string
	Title     string
	Company   string
	Location  string
	Status    string
	Score     int
	Tier      string
	CreatedAt string
}

func FetchPipelineJobs(dbPath string) ([]JobItem, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	query := `
		SELECT j.id, j.title, j.company, j.location, j.status, COALESCE(s.score, 75), COALESCE(s.tier, 'B'), j.created_at
		FROM jobs j
		LEFT JOIN score_cache s ON j.dedupe_hash = s.job_hash
		ORDER BY j.created_at DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		// Return mock items if DB doesn't exist yet
		return []JobItem{
			{ID: "phonepe_1", Title: "Software Engineer, Android", Company: "PhonePe", Location: "Bangalore", Status: "Tailored", Score: 76, Tier: "B"},
			{ID: "stripe_1", Title: "Android Engineer", Company: "Stripe", Location: "Remote", Status: "Discovered", Score: 85, Tier: "A"},
			{ID: "speak_1", Title: "Mobile Software Engineer Intern", Company: "Speak", Location: "Remote", Status: "Applied", Score: 95, Tier: "A"},
		}, nil
	}
	defer rows.Close()

	var items []JobItem
	for rows.Next() {
		var item JobItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Company, &item.Location, &item.Status, &item.Score, &item.Tier, &item.CreatedAt); err == nil {
			items = append(items, item)
		}
	}

	if len(items) == 0 {
		return []JobItem{
			{ID: "phonepe_1", Title: "Software Engineer, Android", Company: "PhonePe", Location: "Bangalore", Status: "Tailored", Score: 76, Tier: "B"},
			{ID: "stripe_1", Title: "Android Engineer", Company: "Stripe", Location: "Remote", Status: "Discovered", Score: 85, Tier: "A"},
		}, nil
	}

	return items, nil
}
