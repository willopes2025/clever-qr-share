<#
    Instala o SM Bridge como servico do Windows no computador do quiosque.

    Execute uma vez, como administrador, na instalacao da loja:
        powershell -ExecutionPolicy Bypass -File install-windows.ps1

    Requer Node.js LTS instalado.
#>

param(
    [string]$InstallPath = "$env:ProgramFiles\SoulPDV\bridge",
    [string]$ConfigPath  = "$env:ProgramData\SoulPDV\bridge.json",
    [string]$ServiceName = "SoulBridge"
)

$ErrorActionPreference = 'Stop'

Write-Host "Instalando o SM Bridge..." -ForegroundColor Cyan

# Verifica Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js nao encontrado. Instale o Node LTS antes de continuar."
}

# 1. Copia o agente compilado
Write-Host "Copiando arquivos para $InstallPath..." -ForegroundColor Gray
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Copy-Item -Path "$PSScriptRoot\..\dist\*" -Destination $InstallPath -Recurse -Force

# 2. Cria a configuracao padrao, se nao existir
Write-Host "Criando configuracao..." -ForegroundColor Gray
New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null

if (-not (Test-Path $ConfigPath)) {
    $configContent = @'
{
  "port": 9123,
  "allowedOrigins": ["https://soulmuscle.wideic.com"],
  "printer": { "transport": "tcp", "host": "192.168.0.100", "port": 9100 },
  "drawer": { "enabled": true, "pin": 2 },
  "columns": 48
}
'@
    $configContent | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Host "Configuracao criada em $ConfigPath" -ForegroundColor Yellow
    Write-Host "IMPORTANTE: Ajuste o endereco IP da impressora no JSON antes de usar." -ForegroundColor Yellow
}

# 3. Para servico existente e remove
Write-Host "Registrando servico..." -ForegroundColor Gray
$nodePath = (Get-Command node).Source
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "Removendo servico anterior..." -ForegroundColor Gray
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

# 4. Cria o servico novo
$binPath = "`"$nodePath`" `"$InstallPath\index.js`""
Write-Host "Criando servico com binPath: $binPath" -ForegroundColor Gray
$createOutput = sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= "Soul PDV Bridge"
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar servico: $createOutput"
}
sc.exe description $ServiceName "Agente local do PDV: impressora termica e gaveta" | Out-Null

# Seta variavel de ambiente para o servico
[Environment]::SetEnvironmentVariable('SOUL_BRIDGE_CONFIG', $ConfigPath, 'Machine')

# 5. Inicia o servico
Write-Host "Iniciando servico..." -ForegroundColor Gray
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

# 6. Testa conexao
Write-Host "Testando conexao..." -ForegroundColor Gray
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9123/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "SUCESSO: SM Bridge $($health.version) esta rodando." -ForegroundColor Green
    Write-Host "Impressora acessivel: $($health.printerOk)" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Servico iniciou, mas nao respondeu em http://127.0.0.1:9123" -ForegroundColor Yellow
    Write-Host "Verificar: driver da impressora, IP da impressora, firewall." -ForegroundColor Yellow
}

Write-Host "Instalacao concluida!" -ForegroundColor Green
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Edite $ConfigPath com o IP correto da impressora (se usou rede)" -ForegroundColor Cyan
Write-Host "  2. Execute: Restart-Service SoulBridge" -ForegroundColor Cyan
Write-Host "  3. Teste com: curl -X POST http://127.0.0.1:9123/print/test" -ForegroundColor Cyan
