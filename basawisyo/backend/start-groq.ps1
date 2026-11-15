$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run the BasaWisyo local server."
}

$previousKey = $env:GROQ_API_KEY
try {
  if ([string]::IsNullOrWhiteSpace($env:GROQ_API_KEY)) {
    $secureKey = Read-Host "Enter your GroqCloud API key" -AsSecureString
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
      $env:GROQ_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
  }

  if ([string]::IsNullOrWhiteSpace($env:GROQ_API_KEY)) {
    throw "A GroqCloud API key is required for Online AI."
  }

  Write-Host "Starting BasaWisyo with GroqCloud at http://127.0.0.1:8765/index.html"
  node (Join-Path $PSScriptRoot "server.js")
} finally {
  if ($null -eq $previousKey) {
    Remove-Item Env:GROQ_API_KEY -ErrorAction SilentlyContinue
  } else {
    $env:GROQ_API_KEY = $previousKey
  }
}
