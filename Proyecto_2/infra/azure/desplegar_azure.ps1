# ==============================================================================
# Script de Despliegue Automatizado en Azure - SmartEgg Fase 3
# ==============================================================================
# - Crea Resource Group y VM Linux (Ubuntu 22.04 LTS) con tamaño economico (Standard_B2s).
# - Configura Auto-Shutdown automatico a las 23:00 hrs para NO gastar creditos de estudiante.
# - Abre puertos de seguridad: 22 (SSH), 1883 (MQTT), 9001 (MQTT WS), 3000 (Grafana), 3001 (frontend), 5000 (API).
# - Instala Docker & Docker Compose y levanta el stack completo en la nube.
# - Crea Storage Account con Hosting Estatico para el Dashboard p5.js.
# ==============================================================================

param(
    [string]$ResourceGroup = "rg-smartegg-fase3",
    [string]$Location = "northcentralus",
    [string]$VmName = "vm-smartegg",
    [string]$VmSize = "Standard_B2as_v2", # AMD x86_64, 2 vCPU, 8GB RAM (~$0.04/hr, optimizado para Docker)
    [string]$AdminUser = "azureuser"
)

$ErrorActionPreference = "Stop"

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "   SmartEgg Fase 3 - Despliegue Automatizado en Microsoft Azure" -ForegroundColor Cyan
Write-Host "======================================================================`n" -ForegroundColor Cyan

# 1. Crear Resource Group
Write-Host "[1/6] Creando Resource Group '$ResourceGroup' en $Location..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none
Write-Host "-> Resource Group listo." -ForegroundColor Green

# 2. Crear Network Security Group (NSG) y Reglas de Firewall
Write-Host "`n[2/6] Configurando reglas de firewall (NSG)..." -ForegroundColor Yellow
$NsgName = "nsg-smartegg"
az network nsg create --resource-group $ResourceGroup --name $NsgName --location $Location --output none

# Abrir puertos obligatorios por la rubrica
$Rules = @(
    @{ Name="Allow-SSH"; Port=22; Priority=1000 },
    @{ Name="Allow-MQTT"; Port=1883; Priority=1010 },
    @{ Name="Allow-MQTT-WS"; Port=9001; Priority=1020 },
    @{ Name="Allow-Grafana"; Port=3000; Priority=1030 },
    @{ Name="Allow-Frontend"; Port=3001; Priority=1040 },
    @{ Name="Allow-Backend"; Port=5000; Priority=1050 },
    @{ Name="Allow-HTTP"; Port=80; Priority=1060 }
)

foreach ($r in $Rules) {
    az network nsg rule create `
        --resource-group $ResourceGroup `
        --nsg-name $NsgName `
        --name $r.Name `
        --priority $r.Priority `
        --destination-port-ranges $r.Port `
        --protocol Tcp `
        --access Allow `
        --direction Inbound `
        --source-address-prefixes '*' `
        --output none
}
Write-Host "-> Reglas de puertos abiertas: 22, 1883, 9001, 3000, 3001, 5000, 80." -ForegroundColor Green

# 3. Crear Maquina Virtual
Write-Host "`n[3/6] Creando Maquina Virtual '$VmName' ($VmSize, Ubuntu 22.04 LTS)..." -ForegroundColor Yellow
$vmResult = az vm create `
    --resource-group $ResourceGroup `
    --name $VmName `
    --image Ubuntu2204 `
    --size $VmSize `
    --admin-username $AdminUser `
    --generate-ssh-keys `
    --nsg $NsgName `
    --public-ip-sku Standard `
    --output json | ConvertFrom-Json

$PublicIp = $vmResult.publicIpAddress
Write-Host "-> VM creada exitosamente con IP Publica: $PublicIp" -ForegroundColor Green

# 4. Configurar Auto-Shutdown a las 23:00 hrs para proteger creditos de estudiante
Write-Host "`n[4/6] Configurando Auto-Apagado automatico (23:00 hrs)..." -ForegroundColor Yellow
az vm auto-shutdown `
    --resource-group $ResourceGroup `
    --name $VmName `
    --time "0500" `
    --output none # 05:00 UTC = 23:00 GMT-6 (Guatemala)
Write-Host "-> Auto-apagado programado a las 11:00 PM (previene consumo de creditos)." -ForegroundColor Green

# 5. Instalar Docker y levantar el Stack en la VM remota
Write-Host "`n[5/6] Instalando Docker y arrancando stack SmartEgg en la VM..." -ForegroundColor Yellow

az vm run-command invoke `
    --resource-group $ResourceGroup `
    --name $VmName `
    --command-id RunShellScript `
    --scripts "@infra/azure/init_vm.sh" `
    --output none

Write-Host "-> Stack Docker desplegado y en ejecucion en la nube." -ForegroundColor Green

# 6. Hosting Estatico en Azure Blob Storage para Dashboard p5.js
Write-Host "`n[6/6] Desplegando Dashboard p5.js en Azure Blob Storage (Static Website)..." -ForegroundColor Yellow
$StorageName = "smartegg" + (Get-Random -Minimum 10000 -Maximum 99999)
az storage account create `
    --name $StorageName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --output none

$StorageKey = (az storage account keys list --resource-group $ResourceGroup --account-name $StorageName --query "[0].value" --output tsv)

# Habilitar sitio web estatico
az storage blob service-properties update `
    --account-name $StorageName `
    --account-key $StorageKey `
    --static-website `
    --index-document "index.html" `
    --output none

# Subir dashboard p5.js inyectando la IP publica de la nube
$p5Content = Get-Content -Path "dashboard_p5\index.html" -Raw
$p5Content = $p5Content -replace "let brokerHost = urlParams.get\('host'\) \|\| window.location.hostname \|\| `"localhost`";", "let brokerHost = urlParams.get('host') || '$PublicIp';"
Set-Content -Path "dashboard_p5\index_cloud.html" -Value $p5Content

az storage blob upload `
    --account-name $StorageName `
    --account-key $StorageKey `
    --container-name '$web' `
    --name "index.html" `
    --file "dashboard_p5\index_cloud.html" `
    --content-type "text/html" `
    --overwrite `
    --output none

$StorageEndpoint = (az storage account show --name $StorageName --resource-group $ResourceGroup --query "primaryEndpoints.web" --output tsv).TrimEnd('/')

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "   ¡DESPLIEGUE EN AZURE COMPLETADO CON EXITO!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "IP Publica de la VM:       $PublicIp" -ForegroundColor Cyan
Write-Host "Broker MQTT (Nube):        $PublicIp`:1883" -ForegroundColor Cyan
Write-Host "MQTT WebSockets (Nube):    ws://$PublicIp`:9001" -ForegroundColor Cyan
Write-Host "Grafana Dashboards:        http://$PublicIp`:3000 (admin / admin)" -ForegroundColor Cyan
Write-Host "Backend API & Healthcheck: http://$PublicIp`:5000/health" -ForegroundColor Cyan
Write-Host "Dashboard p5.js (Bucket):  $StorageEndpoint/index.html" -ForegroundColor Cyan
Write-Host "======================================================================`n" -ForegroundColor Green

Write-Host "Para conectar tus scripts locales a la nube:" -ForegroundColor Yellow
Write-Host "  python backend/serial_bridge.py --mqtt-host $PublicIp" -ForegroundColor White
Write-Host "  python vision/detector_vision.py --mqtt-host $PublicIp" -ForegroundColor White
