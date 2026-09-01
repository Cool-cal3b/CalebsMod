package go_services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

type DocumentationSummary struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type DocumentationDocument struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Markdown string `json:"markdown"`
}

func GetDocumentationList() ([]DocumentationSummary, error) {
	var documents []DocumentationSummary
	if err := getDocumentationJSON(GetServerUrl()+"/api/documentation", &documents); err != nil {
		return nil, err
	}
	return documents, nil
}

func GetDocumentation(id string) (DocumentationDocument, error) {
	var document DocumentationDocument
	endpoint := GetServerUrl() + "/api/documentation/" + url.PathEscape(id)
	if err := getDocumentationJSON(endpoint, &document); err != nil {
		return DocumentationDocument{}, err
	}
	return document, nil
}

func getDocumentationJSON(endpoint string, target interface{}) error {
	resp, err := http.Get(endpoint)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("documentation request failed: %s", resp.Status)
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("invalid documentation response: %w", err)
	}
	return nil
}
