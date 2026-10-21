#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# Actualizar paquetes e instalar dependencias
apt-get update -y
apt-get install -y ca-certificates curl gnupg git

# Instalar Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

ARCH=$(dpkg --print-architecture)
CODENAME=$(lsb_release -cs)
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker azureuser || true

# Clonar repo y levantar stack SmartEgg
mkdir -p /opt/smartegg
cd /opt/smartegg
git clone https://github.com/Jsue46/AYC2_G7.git repo || true
cd repo/Proyecto_2
git checkout fase3-completa || git checkout develop || true

# Generar variables de entorno
cat <<EOF > .env
NODE_ID=SE-01
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_WS_PORT=9001
POSTGRES_DB=smartegg
POSTGRES_USER=smartegg
POSTGRES_PASSWORD=cambiar_esta_clave
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
EOF

# Levantar Docker Compose
docker compose up -d --build
