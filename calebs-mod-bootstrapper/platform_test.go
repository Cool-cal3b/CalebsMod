package main

import (
	"os"
	"path/filepath"
	"testing"
)

// The 0.17 release shipped a stray `wails dev` binary alongside the real one.
// It sorts first, so the walk picked it and installed a client that exits
// immediately without a dev server.
func TestFindClientInDirIgnoresDevBuild(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"CalebsModClient-dev.exe", "CalebsModClient.exe"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	got := findClientInDir(dir)
	if filepath.Base(got) != "CalebsModClient.exe" {
		t.Fatalf("picked %q, want CalebsModClient.exe", filepath.Base(got))
	}
}

// A dev build on its own is still not a client worth installing.
func TestFindClientInDirRejectsDevBuildAlone(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "CalebsModClient-dev.exe"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := findClientInDir(dir); got != "" {
		t.Fatalf("picked %q, want no match", got)
	}
}

// The extra top-level folder some zip tools introduce must still work.
func TestFindClientInDirNestedFolder(t *testing.T) {
	dir := t.TempDir()
	nested := filepath.Join(dir, "CalebsModClient-0.18")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nested, "CalebsModClient.exe"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := findClientInDir(dir); filepath.Base(got) != "CalebsModClient.exe" {
		t.Fatalf("picked %q, want CalebsModClient.exe", got)
	}
}
