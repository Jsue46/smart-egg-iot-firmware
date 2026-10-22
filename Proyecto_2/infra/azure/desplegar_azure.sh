#!/usr/bin/env bash
# ==============================================================================
# Despliegue en Azure CLI - SmartEgg Fase 3
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="rg-smartegg-arqui2"
LOCATION="centralus"
VM_NAME="vm-smartegg"
VM_SIZE="Standard_B2s"
ADMIN_USER="azureuser"

echo "=== Despliegue SmartEgg en Azure ==="

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none

az network nsg create --resource-group "$RESOURCE_GROUP" --name nsg-smartegg --location "$LOCATION" -o none

priority=1000
for port in 22 1883 9001 3000 3001 5000 80; do
  az network nsg rule create \
    --resource-group "$RESOURCE_GROUP" \
    --nsg-name nsg-smartegg \
    --name "Allow-$port" \
    --priority "$priority" \
    --destination-port-ranges "$port" \
    --protocol Tcp \
    --access Allow \
    --direction Inbound \
    --source-address-prefixes '*' \
    -o none
  priority=$((priority + 10))
done

VM_INFO=$(az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --image Ubuntu2204 \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys \
  --nsg nsg-smartegg \
  --public-ip-sku Standard \
  -o json)

PUBLIC_IP=$(echo "$VM_INFO" | grep -o '"publicIpAddress": "[^"]*' | cut -d'"' -f4)
echo "VM creada: $PUBLIC_IP"

az vm auto-shutdown --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --time "0500" -o none

echo "Despliegue finalizado. IP: $PUBLIC_IP"
