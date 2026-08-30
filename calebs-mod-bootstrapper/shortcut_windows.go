//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

// The Start Menu entry the client is reachable through when someone presses
// the Windows key and types. A bare executable under %LOCALAPPDATA% is never
// indexed by Start search no matter how it is signed; a .lnk in this folder
// is exactly what that search reads.
const (
	shortcutBaseName    = "Caleb's Mod Client"
	shortcutDescription = "Launch Caleb's Mod Client"
)

// ensureClientShortcut puts a Start Menu shortcut in place if one is not
// already there. It is deliberately a create-if-missing: a user who moved or
// renamed their shortcut keeps it, and the common case of "already installed"
// costs one os.Stat. The shortcut points at the fixed install path, so it
// keeps working across every update - the swap replaces the file behind that
// path, never the path itself - and neither updater has to touch it again.
//
// Every failure is returned for the caller to log and shrug off. A missing
// Start Menu entry is a papercut; it must never stop the client from launching.
func ensureClientShortcut(clientExePath string) error {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return fmt.Errorf("APPDATA is not set")
	}

	programs := filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs")
	if err := os.MkdirAll(programs, 0o755); err != nil {
		return fmt.Errorf("could not create the Start Menu folder: %w", err)
	}

	lnkPath := filepath.Join(programs, shortcutBaseName+".lnk")
	if _, err := os.Stat(lnkPath); err == nil {
		return nil
	}

	if _, err := os.Stat(clientExePath); err != nil {
		return fmt.Errorf("client executable not found at %s: %w", clientExePath, err)
	}

	return createShortcut(lnkPath, clientExePath, filepath.Dir(clientExePath), shortcutDescription, clientExePath)
}

// --- Minimal COM binding for IShellLinkW + IPersistFile ----------------------
//
// This is done by hand through syscall rather than a helper library so the
// bootstrapper keeps its "no dependencies" property. The client links the same
// file and could use go-ole, but sharing one implementation is worth more than
// the few lines it would save there.

var (
	modole32             = syscall.NewLazyDLL("ole32.dll")
	procCoInitializeEx   = modole32.NewProc("CoInitializeEx")
	procCoUninitialize   = modole32.NewProc("CoUninitialize")
	procCoCreateInstance = modole32.NewProc("CoCreateInstance")
)

const (
	coinitApartmentThreaded = 0x2
	clsctxInprocServer      = 0x1
	rpcEChangedMode         = 0x80010106
)

type comGUID struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

var (
	clsidShellLink = comGUID{0x00021401, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidShellLinkW  = comGUID{0x000214F9, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidPersistFile = comGUID{0x0000010B, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
)

type iShellLinkWVtbl struct {
	QueryInterface      uintptr
	AddRef              uintptr
	Release             uintptr
	GetPath             uintptr
	GetIDList           uintptr
	SetIDList           uintptr
	GetDescription      uintptr
	SetDescription      uintptr
	GetWorkingDirectory uintptr
	SetWorkingDirectory uintptr
	GetArguments        uintptr
	SetArguments        uintptr
	GetHotkey           uintptr
	SetHotkey           uintptr
	GetShowCmd          uintptr
	SetShowCmd          uintptr
	GetIconLocation     uintptr
	SetIconLocation     uintptr
	SetRelativePath     uintptr
	Resolve             uintptr
	SetPath             uintptr
}

type iShellLinkW struct{ vtbl *iShellLinkWVtbl }

type iPersistFileVtbl struct {
	QueryInterface uintptr
	AddRef         uintptr
	Release        uintptr
	GetClassID     uintptr
	IsDirty        uintptr
	Load           uintptr
	Save           uintptr
	SaveCompleted  uintptr
	GetCurFile     uintptr
}

type iPersistFile struct{ vtbl *iPersistFileVtbl }

func createShortcut(lnkPath, targetPath, workingDir, description, iconPath string) error {
	// COM apartment state is per-thread, so this work has to stay on one.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hr, _, _ := procCoInitializeEx.Call(0, coinitApartmentThreaded)
	switch uint32(hr) {
	case 0, 1: // S_OK, S_FALSE (already initialized on this thread, same mode)
		defer procCoUninitialize.Call()
	case rpcEChangedMode: // COM already up on this thread in another mode; use it as-is
	default:
		return fmt.Errorf("CoInitializeEx failed: 0x%x", uint32(hr))
	}

	var psl *iShellLinkW
	hr, _, _ = procCoCreateInstance.Call(
		uintptr(unsafe.Pointer(&clsidShellLink)),
		0,
		clsctxInprocServer,
		uintptr(unsafe.Pointer(&iidShellLinkW)),
		uintptr(unsafe.Pointer(&psl)),
	)
	if uint32(hr) != 0 || psl == nil {
		return fmt.Errorf("CoCreateInstance(ShellLink) failed: 0x%x", uint32(hr))
	}
	defer syscall.SyscallN(psl.vtbl.Release, uintptr(unsafe.Pointer(psl)))

	if err := shellLinkSetString(psl.vtbl.SetPath, psl, targetPath); err != nil {
		return fmt.Errorf("SetPath: %w", err)
	}
	if workingDir != "" {
		_ = shellLinkSetString(psl.vtbl.SetWorkingDirectory, psl, workingDir)
	}
	if description != "" {
		_ = shellLinkSetString(psl.vtbl.SetDescription, psl, description)
	}
	if iconPath != "" {
		if p, err := syscall.UTF16PtrFromString(iconPath); err == nil {
			syscall.SyscallN(psl.vtbl.SetIconLocation, uintptr(unsafe.Pointer(psl)), uintptr(unsafe.Pointer(p)), 0)
		}
	}

	var ppf *iPersistFile
	hr, _, _ = syscall.SyscallN(psl.vtbl.QueryInterface,
		uintptr(unsafe.Pointer(psl)),
		uintptr(unsafe.Pointer(&iidPersistFile)),
		uintptr(unsafe.Pointer(&ppf)),
	)
	if uint32(hr) != 0 || ppf == nil {
		return fmt.Errorf("QueryInterface(IPersistFile) failed: 0x%x", uint32(hr))
	}
	defer syscall.SyscallN(ppf.vtbl.Release, uintptr(unsafe.Pointer(ppf)))

	lnkPtr, err := syscall.UTF16PtrFromString(lnkPath)
	if err != nil {
		return err
	}
	hr, _, _ = syscall.SyscallN(ppf.vtbl.Save,
		uintptr(unsafe.Pointer(ppf)),
		uintptr(unsafe.Pointer(lnkPtr)),
		1, // fRemember
	)
	if uint32(hr) != 0 {
		return fmt.Errorf("IPersistFile.Save failed: 0x%x", uint32(hr))
	}
	return nil
}

func shellLinkSetString(method uintptr, psl *iShellLinkW, s string) error {
	p, err := syscall.UTF16PtrFromString(s)
	if err != nil {
		return err
	}
	hr, _, _ := syscall.SyscallN(method, uintptr(unsafe.Pointer(psl)), uintptr(unsafe.Pointer(p)))
	if uint32(hr) != 0 {
		return fmt.Errorf("0x%x", uint32(hr))
	}
	return nil
}
