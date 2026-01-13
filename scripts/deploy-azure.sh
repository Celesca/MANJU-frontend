#!/bin/bash

# Configuration
RESOURCE_GROUP="manju-universe-rg"
LOCATION="southeastasia"
ACR_NAME="manjuuniverseacr"
ACA_ENV_NAME="manju-env"
BACKEND_APP_NAME="manju-backend"
AI_BACKEND_APP_NAME="manju-ai-backend"

# PostgreSQL Configuration
DB_SERVER_NAME=""
DB_NAME=""
DB_USER=""
DB_PASSWORD=""

echo "Using Resource Group: $RESOURCE_GROUP"
echo "Using Location: $LOCATION"
echo "Using ACR Name: $ACR_NAME"

# Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Create Azure Database for PostgreSQL Flexible Server
echo "Creating Azure Database for PostgreSQL Flexible Server..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_USER \
  --admin-password $DB_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --database-name $DB_NAME \
  --yes

# Add firewall rule for current IP to allow initialization
echo "Adding firewall rule for your current IP..."
CURRENT_IP=$(curl -s https://api.ipify.org)
if [ ! -z "$CURRENT_IP" ]; then
    az postgres flexible-server firewall-rule create \
      --resource-group $RESOURCE_GROUP \
      --name $DB_SERVER_NAME \
      --rule-name AllowMyIP \
      --start-ip-address $CURRENT_IP \
      --end-ip-address $CURRENT_IP
    echo "Added firewall rule for IP: $CURRENT_IP"
else
    echo "Warning: Could not determine your public IP. You may need to add a firewall rule in the Azure portal manually."
fi


DB_HOST="$DB_SERVER_NAME.postgres.database.azure.com"

# Build and Push Backend Image
echo "Building and pushing Backend..."
az acr build --registry $ACR_NAME --image $BACKEND_APP_NAME:latest ./backend

# Build and Push AI Backend Image
echo "Building and pushing AI Backend..."
az acr build --registry $ACR_NAME --image $AI_BACKEND_APP_NAME:latest ./ai_backend

# Create Container Apps Environment
az containerapp env create --name $ACA_ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION

# Deploy AI Backend
echo "Deploying AI Backend..."
az containerapp create \
  --name $AI_BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV_NAME \
  --image $ACR_LOGIN_SERVER/$AI_BACKEND_APP_NAME:latest \
  --target-port 5000 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars AI_SERVICE_PORT=5000

AI_BACKEND_URL=$(az containerapp show --name $AI_BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)

# Deploy Backend with DB Connection
echo "Deploying Backend..."
az containerapp create \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV_NAME \
  --image $ACR_LOGIN_SERVER/$BACKEND_APP_NAME:latest \
  --target-port 8080 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --env-vars \
    AI_SERVICE_URL=https://$AI_BACKEND_URL \
    DB_HOST=$DB_HOST \
    DB_PORT=5432 \
    DB_USER=$DB_USER \
    DB_PASSWORD=$DB_PASSWORD \
    DB_NAME=$DB_NAME \
    SSL_MODE=require \
    CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" \
    CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" \
  --min-replicas 1 \
  --max-replicas 3

BACKEND_URL=$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)

echo "---------------------------------------------------"
echo "Deployment complete!"
echo "Backend URL: https://$BACKEND_URL"
echo "AI Backend URL: https://$AI_BACKEND_URL"
echo "PostgreSQL Host: $DB_HOST"
echo "---------------------------------------------------"
echo "To initialize the database, run: ./scripts/init-db.sh $DB_HOST $DB_USER $DB_PASSWORD $DB_NAME"
