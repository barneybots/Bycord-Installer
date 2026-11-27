package main

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"path/filepath"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// O ícone de cada Discord vem da própria instalação (app.ico ou o .exe), como o Windows mostra.
// Assim o instalador não carrega o logo do Discord dentro dele.

var (
	user32             = windows.NewLazySystemDLL("user32.dll")
	gdi32              = windows.NewLazySystemDLL("gdi32.dll")
	procPrivateExtract = user32.NewProc("PrivateExtractIconsW")
	procGetIconInfo    = user32.NewProc("GetIconInfo")
	procDestroyIcon    = user32.NewProc("DestroyIcon")
	procGetDC          = user32.NewProc("GetDC")
	procReleaseDC      = user32.NewProc("ReleaseDC")
	procGetDIBits      = gdi32.NewProc("GetDIBits")
	procDeleteObject   = gdi32.NewProc("DeleteObject")
	iconCache          = map[string]string{}
	iconCacheMu        sync.Mutex
)

const iconSize = 64

type iconInfo struct {
	fIcon    int32
	xHotspot uint32
	yHotspot uint32
	hbmMask  windows.Handle
	hbmColor windows.Handle
}

type bitmapInfoHeader struct {
	biSize          uint32
	biWidth         int32
	biHeight        int32
	biPlanes        uint16
	biBitCount      uint16
	biCompression   uint32
	biSizeImage     uint32
	biXPelsPerMeter int32
	biYPelsPerMeter int32
	biClrUsed       uint32
	biClrImportant  uint32
}

// iconSource escolhe de onde tirar o ícone de uma instalação.
func iconSource(inst DiscordInstall) string {
	if ico := filepath.Join(inst.Path, "app.ico"); exists(ico) {
		return ico
	}
	if inst.Branch == "phoenix" {
		return filepath.Join(inst.Path, "app", "Discord.exe")
	}
	if appDir, _ := latestAppDir(inst.Path); appDir != "" {
		return filepath.Join(appDir, discordExe[inst.Branch])
	}
	return ""
}

// discordIconDataURL devolve o ícone como "data:image/png;base64,...", ou "" se não der para ler.
func discordIconDataURL(inst DiscordInstall) string {
	path := iconSource(inst)
	if path == "" || !exists(path) {
		return ""
	}

	iconCacheMu.Lock()
	defer iconCacheMu.Unlock()
	if url, ok := iconCache[path]; ok {
		return url
	}

	url := ""
	if img := extractIcon(path); img != nil {
		var buf bytes.Buffer
		if png.Encode(&buf, img) == nil {
			url = "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
		}
	}
	iconCache[path] = url
	return url
}

func extractIcon(path string) image.Image {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil
	}
	var hicon windows.Handle
	n, _, _ := procPrivateExtract.Call(uintptr(unsafe.Pointer(p)), 0, iconSize, iconSize, uintptr(unsafe.Pointer(&hicon)), 0, 1, 0)
	if n == 0 || n == 0xFFFFFFFF || hicon == 0 {
		return nil
	}
	defer procDestroyIcon.Call(uintptr(hicon))

	var info iconInfo
	if ok, _, _ := procGetIconInfo.Call(uintptr(hicon), uintptr(unsafe.Pointer(&info))); ok == 0 {
		return nil
	}
	defer procDeleteObject.Call(uintptr(info.hbmColor))
	defer procDeleteObject.Call(uintptr(info.hbmMask))
	if info.hbmColor == 0 {
		return nil
	}

	hdc, _, _ := procGetDC.Call(0)
	defer procReleaseDC.Call(0, hdc)

	bmi := bitmapInfoHeader{biWidth: iconSize, biHeight: -iconSize, biPlanes: 1, biBitCount: 32}
	bmi.biSize = uint32(unsafe.Sizeof(bmi))
	pixels := make([]byte, iconSize*iconSize*4)
	lines, _, _ := procGetDIBits.Call(hdc, uintptr(info.hbmColor), 0, iconSize, uintptr(unsafe.Pointer(&pixels[0])), uintptr(unsafe.Pointer(&bmi)), 0)
	if lines == 0 {
		return nil
	}

	// Ícones antigos sem canal alfa vêm com alfa zerado: nesse caso, considera tudo opaco.
	hasAlpha := false
	for i := 3; i < len(pixels); i += 4 {
		if pixels[i] != 0 {
			hasAlpha = true
			break
		}
	}

	img := image.NewNRGBA(image.Rect(0, 0, iconSize, iconSize))
	for i := 0; i < iconSize*iconSize; i++ {
		b, g, r, a := pixels[i*4], pixels[i*4+1], pixels[i*4+2], pixels[i*4+3]
		if !hasAlpha {
			a = 255
		}
		// GetDIBits devolve as cores já multiplicadas pelo alfa; desfaz para o PNG.
		if a > 0 && a < 255 {
			r = uint8(min(255, int(r)*255/int(a)))
			g = uint8(min(255, int(g)*255/int(a)))
			b = uint8(min(255, int(b)*255/int(a)))
		}
		img.SetNRGBA(i%iconSize, i/iconSize, color.NRGBA{R: r, G: g, B: b, A: a})
	}
	return img
}
