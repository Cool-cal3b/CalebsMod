//go:build windows

package go_services

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
	shortcutBaseName     = "Caleb's Mod Client"
	shortcutDescription  = "Launch Caleb's Mod Client"
	clientExeName        = "CalebsModClient.exe"
	clientAppUserModelID = "CalebWashburn.CalebsModClient"
)

// EnsureClientShortcut puts the Start Menu shortcut in place and refreshes its
// notification identity. Rewriting it is intentional: older releases created
// the shortcut without the AppUserModelID Windows requires for native toasts.
//
// The shortcut points at the fixed install path, %LOCALAPPDATA%\CalebsMod\
// CalebsModClient.exe. A self-update replaces the file behind that path, never
// the path itself, so the shortcut keeps working across every update without
// being rewritten - the reason both the startup path and the updater can call
// this and neither has to recreate anything.
//
// Every failure is returned for the caller to log and shrug off. A missing
// Start Menu entry is a papercut; it must never break launching or updating.
func EnsureClientShortcut() error {
	installDir, err := InstallDir()
	if err != nil {
		return err
	}
	clientExe := filepath.Join(installDir, clientExeName)

	appData := os.Getenv("APPDATA")
	if appData == "" {
		return fmt.Errorf("APPDATA is not set")
	}
	programs := filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs")
	if err := os.MkdirAll(programs, 0o755); err != nil {
		return fmt.Errorf("could not create the Start Menu folder: %w", err)
	}

	lnkPath := filepath.Join(programs, shortcutBaseName+".lnk")
	if _, err := os.Stat(clientExe); err != nil {
		return fmt.Errorf("client executable not found at %s: %w", clientExe, err)
	}

	return createShortcut(lnkPath, clientExe, filepath.Dir(clientExe), shortcutDescription, clientExe)
}

// --- Minimal COM binding for IShellLinkW + IPersistFile ----------------------
//
// Done by hand through syscall so the identical file drops into the
// dependency-free bootstrapper. go-ole is already in this module's graph and
// would work here, but one shared implementation is worth more than the few
// lines it saves.

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
	clsidShellLink   = comGUID{0x00021401, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidShellLinkW    = comGUID{0x000214F9, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidPersistFile   = comGUID{0x0000010B, 0x0000, 0x0000, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidPropertyStore = comGUID{0x886D8EEB, 0x8CF2, 0x4446, [8]byte{0x8D, 0x02, 0xCD, 0xBA, 0x1D, 0xBD, 0xCF, 0x99}}
	appUserModelKey  = propertyKey{
		FmtID: comGUID{0x9F4C2855, 0x9F79, 0x4B39, [8]byte{0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3}},
		PID:   5,
	}
)

type propertyKey struct {
	FmtID comGUID
	PID   uint32
}
type propVariant struct {
	VT                              uint16
	Reserved1, Reserved2, Reserved3 uint16
	Value                           uintptr
	Value2                          uintptr
}

type iPropertyStoreVtbl struct {
	QueryInterface uintptr
	AddRef         uintptr
	Release        uintptr
	GetCount       uintptr
	GetAt          uintptr
	GetValue       uintptr
	SetValue       uintptr
	Commit         uintptr
}
type iPropertyStore struct{ vtbl *iPropertyStoreVtbl }

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

	// Unpackaged desktop apps need this property on their Start shortcut for
	// Windows to attribute native toast notifications to the application.
	var store *iPropertyStore
	hr, _, _ = syscall.SyscallN(psl.vtbl.QueryInterface,
		uintptr(unsafe.Pointer(psl)),
		uintptr(unsafe.Pointer(&iidPropertyStore)),
		uintptr(unsafe.Pointer(&store)),
	)
	if uint32(hr) != 0 || store == nil {
		return fmt.Errorf("QueryInterface(IPropertyStore) failed: 0x%x", uint32(hr))
	}
	defer syscall.SyscallN(store.vtbl.Release, uintptr(unsafe.Pointer(store)))
	appIDPtr, err := syscall.UTF16PtrFromString(clientAppUserModelID)
	if err != nil {
		return err
	}
	value := propVariant{VT: 31, Value: uintptr(unsafe.Pointer(appIDPtr))} // VT_LPWSTR
	hr, _, _ = syscall.SyscallN(store.vtbl.SetValue, uintptr(unsafe.Pointer(store)), uintptr(unsafe.Pointer(&appUserModelKey)), uintptr(unsafe.Pointer(&value)))
	if uint32(hr) != 0 {
		return fmt.Errorf("IPropertyStore.SetValue(AppUserModelID) failed: 0x%x", uint32(hr))
	}
	hr, _, _ = syscall.SyscallN(store.vtbl.Commit, uintptr(unsafe.Pointer(store)))
	if uint32(hr) != 0 {
		return fmt.Errorf("IPropertyStore.Commit failed: 0x%x", uint32(hr))
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
