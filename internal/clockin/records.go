package clockin

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"time"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/config"
)

type PunchRecord struct {
	Timestamp time.Time    `json:"timestamp"`
	Type      TipoOperacao `json:"type"`
	Location  string       `json:"location,omitempty"`
}

type PunchRecords struct {
	Records []PunchRecord `json:"records"`
}

func GetPunchRecordsPath() (string, error) {
	return config.GetPunchRecordsFilePath()
}

func LoadPunchRecords() (*PunchRecords, error) {
	path, err := GetPunchRecordsPath()
	if err != nil {
		return nil, err
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		log.Printf("Punch records file does not exist at %s, creating new empty records", path)
		return &PunchRecords{Records: []PunchRecord{}}, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("error reading punch records file: %w", err)
	}

	var records PunchRecords
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("error parsing punch records file: %w", err)
	}

	log.Printf("Loaded %d punch records from %s", len(records.Records), path)
	return &records, nil
}

func SavePunchRecords(records *PunchRecords) error {
	path, err := GetPunchRecordsPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return fmt.Errorf("error serializing punch records: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("error writing punch records file: %w", err)
	}

	log.Printf("Saved %d punch records to %s", len(records.Records), path)
	return nil
}

func AddPunchRecord(operationType TipoOperacao, location string) error {
	records, err := LoadPunchRecords()
	if err != nil {
		return err
	}

	now := time.Now()
	record := PunchRecord{
		Timestamp: now,
		Type:      operationType,
		Location:  location,
	}

	log.Printf("Adding new punch record: Type=%s, Time=%s, Location=%s",
		operationType.String(), now.Format(time.RFC3339), location)

	records.Records = append(records.Records, record)

	sort.Slice(records.Records, func(i, j int) bool {
		return records.Records[i].Timestamp.Before(records.Records[j].Timestamp)
	})

	return SavePunchRecords(records)
}

func GetTodayPunchRecords() ([]PunchRecord, error) {
	records, err := LoadPunchRecords()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var todayRecords []PunchRecord
	for _, record := range records.Records {
		if record.Timestamp.After(startOfDay) && record.Timestamp.Before(endOfDay) {
			todayRecords = append(todayRecords, record)
		}
	}

	log.Printf("Found %d punch records for today (%s)",
		len(todayRecords), startOfDay.Format("2006-01-02"))
	return todayRecords, nil
}

func GetFormattedTimelineData() (map[string]interface{}, error) {
	records, err := GetTodayPunchRecords()
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"records": records,
	}

	log.Printf("Formatted timeline data with %d records", len(records))
	return result, nil
}

func SavePunchRecord(record PunchRecord) error {
	records, err := LoadPunchRecords()
	if err != nil {
		return err
	}

	log.Printf("Saving punch record with timestamp: %s, Type: %s, Location: %s",
		record.Timestamp.Format(time.RFC3339), record.Type.String(), record.Location)

	records.Records = append(records.Records, record)

	sort.Slice(records.Records, func(i, j int) bool {
		return records.Records[i].Timestamp.Before(records.Records[j].Timestamp)
	})

	return SavePunchRecords(records)
}
