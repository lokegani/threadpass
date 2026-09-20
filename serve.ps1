<#
    ThreadPass local web server
    ---------------------------------------------------------------------
    Serves the site folder over http://localhost:8000 using the .NET
    HttpListener that ships with Windows. No Node, no Python, nothing to
    install.

    Run it:      powershell -ExecutionPolicy Bypass -File D:\ThreadPass\serve.ps1
    Stop it:     press Ctrl+C in this window

    Why a server at all, rather than double-clicking the HTML file?
    Opening a page from file:// puts the browser in a much stricter security
    mode, where some of what this app does is blocked outright. Serving over
    http://localhost behaves the way a real deployment will.
#>

param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "site"
if (-not (Test-Path $root)) {
    Write-Host "Could not find the site folder at: $root" -ForegroundColor Red
    exit 1
}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".txt"  = "text/plain; charset=utf-8"
    ".pdf"  = "application/pdf"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "Could not start the server on port $Port." -ForegroundColor Red
    Write-Host "Something else may already be using it. Try a different port:" -ForegroundColor Yellow
    Write-Host "    powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port 8080" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  ThreadPass is running" -ForegroundColor Green
Write-Host "  http://localhost:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Serving: $root"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

while ($listener.IsListening) {

    try {
        $context = $listener.GetContext()
    } catch {
        break
    }

    $request  = $context.Request
    $response = $context.Response

    try {
        # Strip the query string and decode %20 and friends.
        $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        if ($relative -eq "/" -or $relative -eq "") { $relative = "/index.html" }

        $relative = $relative.TrimStart("/").Replace("/", "\")
        $path = Join-Path $root $relative

        # Refuse anything that escapes the site folder. A static server that
        # can be talked into serving C:\Windows\... is a real vulnerability,
        # not a hypothetical one.
        $fullRoot = [System.IO.Path]::GetFullPath($root)
        $fullPath = [System.IO.Path]::GetFullPath($path)

        if (-not $fullPath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            Write-Host ("  403  " + $request.Url.AbsolutePath) -ForegroundColor Red
            continue
        }

        # Browsers ask for /favicon.ico on their own, whatever the page's
        # <link rel="icon"> says. Answer with the SVG rather than letting a
        # spurious 404 sit in the console during a demonstration.
        if ((-not (Test-Path $fullPath -PathType Leaf)) -and ($relative -ieq "favicon.ico")) {
            $fullPath = Join-Path $root "favicon.svg"
        }

        if (Test-Path $fullPath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $type = $mime[$extension]
            if (-not $type) { $type = "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.StatusCode = 200
            $response.ContentType = $type
            # Never cache during development, or you will edit a file, reload,
            # and spend twenty minutes debugging the previous version.
            $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ("  200  " + $request.Url.AbsolutePath) -ForegroundColor DarkGray
        }
        else {
            $response.StatusCode = 404
            $body = "404 Not Found`n`n" + $request.Url.AbsolutePath
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ("  404  " + $request.Url.AbsolutePath) -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host ("  500  " + $_.Exception.Message) -ForegroundColor Red
        try { $response.StatusCode = 500 } catch {}
    }
    finally {
        try { $response.Close() } catch {}
    }
}

$listener.Stop()
$listener.Close()
