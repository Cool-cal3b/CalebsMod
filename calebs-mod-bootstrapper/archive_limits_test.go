package main

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRejectOversizedReleaseEntryBeforeExtraction(t *testing.T) {
	var data bytes.Buffer
	writer := zip.NewWriter(&data)
	entry, err := writer.Create("large.bin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = entry.Write([]byte("test")); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	content := data.Bytes()
	central := bytes.Index(content, []byte{'P', 'K', 1, 2})
	if central < 0 {
		t.Fatal("missing central directory")
	}
	binary.LittleEndian.PutUint32(content[central+24:], uint32(maxExtractedFileBytes+1))
	source := filepath.Join(t.TempDir(), "release.zip")
	if err = os.WriteFile(source, content, 0600); err != nil {
		t.Fatal(err)
	}
	dest := t.TempDir()
	err = extractZip(source, dest)
	if err == nil || !strings.Contains(err.Error(), "size limits") {
		t.Fatalf("expected size limit rejection, got %v", err)
	}
	if _, err = os.Stat(filepath.Join(dest, "large.bin")); !os.IsNotExist(err) {
		t.Fatal("oversized entry was created")
	}
}
