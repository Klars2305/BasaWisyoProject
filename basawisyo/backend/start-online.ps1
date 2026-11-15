$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run the BasaWisyo local server."
}

$previousKey = $env:OPENAI_API_KEY
try {
  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    $secureKey = Read-Host "Enter your new OpenAI API key" -AsSecureString
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
      $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
  }

  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    throw "An OpenAI API key is required for Online AI."
  }

  Write-Host "Starting BasaWisyo with Online AI at http://127.0.0.1:8765/index.html"
  node (Join-Path $PSScriptRoot "server.js")
} finally {
  if ($null -eq $previousKey) {
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  } else {
    $env:OPENAI_API_KEY = $previousKey
  }
}
