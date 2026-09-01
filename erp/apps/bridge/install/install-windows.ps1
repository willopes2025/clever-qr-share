<#
    Instala o SM Bridge como serviço do Windows no computador do quiosque.

    Execute uma vez, como administrador, na instalação da loja:
        powershell -ExecutionPolicy Bypass -File install-windows.ps1

    Requer Node.js LTS instalado. O empacotamento em executável único ainda
    está pendente — ver README do agente.
#>

param(
    [string]$InstallPath = "$env:ProgramFiles\SoulPDV\bridge",
    [string]$ConfigPath  = "$env:ProgramData\SoulPDV\bridge.json",
    [string]$ServiceName = "SoulBridge"
)

$ErrorActionPreference = 'Stop'

Write-Host "Instalando o SM Bridge..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js nao encontrado. Instale o Node LTS antes de continuar."
}

# 1. Copia o agente compilado
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Copy-Item -Path "$PSScriptRoot\..\dist\*" -Destination $InstallPath -Recurse -Force

# 2. Cria a configuração padrão, se ainda nao existir
New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null
if (-not (Test-Path $ConfigPath)) {
    @'
{
  "port": 9123,
  "allowedOrigins": ["https://soulmuscle.wideic.com"],
  "printer": { "transport": "tcp", "host": "192.168.0.100", "port": 9100 },
  "drawer": { "enabled": true, "pin": 2 },
  "columns": 48
}
'@ | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Host "Configuracao criada em $ConfigPath — ajuste o endereco da impressora." -ForegroundColor Yellow
}

# 3. Registra como serviço, para subir junto com o computador
$nodePath = (Get-Command node).Source
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-Service -Name $ServiceName -Force
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

sc.exe create $ServiceName `
    binPath= "`"$nodePath`" `"$InstallPath\index.js`"" `
    start= auto `
    DisplayName= "Soul PDV Bridge" | Out-Null

sc.exe description $ServiceName "Agente local do PDV: impressora termica e gaveta" | Out-Null
[Environment]::SetEnvironmentVariable('SOUL_BRIDGE_CONFIG', $ConfigPath, 'Machine')

Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

# 4. Confere que o agente respondeu
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9123/health" -TimeoutSec 5
    Write-Host "SM Bridge $($health.version) no ar. Impressora acessivel: $($health.printerOk)" -ForegroundColor Green
    Write-Host "Rode o teste de impressao pela retaguarda antes de liberar o caixa."
} catch {
    Write-Host "O servico subiu, mas nao respondeu em 127.0.0.1:9123. Verifique o log do servico." -ForegroundColor Red
}
