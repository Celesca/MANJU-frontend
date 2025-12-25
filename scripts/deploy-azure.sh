#!/bin/bash

# Configuration
RESOURCE_GROUP="manju-universe-rg"
LOCATION="southeastasia"
ACR_NAME="manjuacr$(date +%s)" # Unique ACR name
ACA_ENV_NAME="manju-env"
BACKEND_APP_NAME="manju-backend"
AI_BACKEND_APP_NAME="manju-ai-backend"

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

# Build and Push Backend Image
echo "Building and pushing Backend..."
az acr build --registry $ACR_NAME --image $BACKEND_APP_NAME:latest ./backend

# Build and Push AI Backend Image
echo "Building and pushing AI Backend..."
az acr build --registry $ACR_NAME --image $AI_BACKEND_APP_NAME:latest ./ai_backend

# Create Container Apps Environment
az containerapp env create --name $ACA_ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION

# Deploy AI Backend first (so backend can point to it)
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
  --env-vars AI_SERVICE_PORT=5000

AI_BACKEND_URL=$(az containerapp show --name $AI_BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)
echo "AI Backend URL: https://$AI_BACKEND_URL"

# Deploy Backend
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
  --env-vars AI_SERVICE_URL=https://$AI_BACKEND_URL

BACKEND_URL=$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)
echo "Backend URL: https://$BACKEND_URL"

echo "Deployment complete!"
