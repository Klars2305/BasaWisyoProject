$ErrorActionPreference = "Stop"
$address = "http://127.0.0.1:8765"
$page = "$address/index.html"
$statusUrl = "$address/api/chat/status"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run BasaWisyo."
}

function Test-BasaServer {
  try {
    $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 2
    return $status.provider -in @("GroqCloud", "OpenAI Responses API")
  } catch {
    return $false
  }
}

if (Test-BasaServer) {
  Start-Process $page
  Write-Host "BasaWisyo is already running. Restart its server after changing backend/.env.local."
  return
}

$nodePath = (Get-Command node).Source
$server = Start-Process -FilePath $nodePath -ArgumentList "server.js" `
  -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Test-BasaServer) { $ready = $true; break }
    if ($server.HasExited) { break }
    Start-Sleep -Milliseconds 350
  }
  if (-not $ready) {
    throw "BasaWisyo could not start on port 8765. Close any other server using that port and try again."
  }
  Start-Process $page
  Write-Host "BasaWisyo is open. Keep this window running; press Ctrl+C to stop its server."
  Wait-Process -Id $server.Id
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue }
}
