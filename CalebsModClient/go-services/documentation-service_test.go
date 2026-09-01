package go_services

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetDocumentationJSONDecodesResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"id":"guide","title":"Guide"}]`))
	}))
	defer server.Close()

	var documents []DocumentationSummary
	if err := getDocumentationJSON(server.URL, &documents); err != nil {
		t.Fatalf("getDocumentationJSON: %v", err)
	}
	if len(documents) != 1 || documents[0].ID != "guide" || documents[0].Title != "Guide" {
		t.Fatalf("unexpected documents: %#v", documents)
	}
}

func TestGetDocumentationJSONRejectsNonOKResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "missing", http.StatusNotFound)
	}))
	defer server.Close()

	err := getDocumentationJSON(server.URL, &DocumentationDocument{})
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("expected a 404 error, got %v", err)
	}
}

func TestGetDocumentationJSONRejectsMalformedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":`))
	}))
	defer server.Close()

	err := getDocumentationJSON(server.URL, &DocumentationDocument{})
	if err == nil || !strings.Contains(err.Error(), "invalid documentation response") {
		t.Fatalf("expected a decoding error, got %v", err)
	}
}
