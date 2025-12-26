#!/bin/bash

# Configuration
RESOURCE_GROUP="manju-universe-rg"
LOCATION="southeastasia"
ACR_NAME="manjuuniverseacr"
ACA_ENV_NAME="manju-env"
FRONTEND_APP_NAME="manju-frontend"
BACKEND_APP_NAME="manju-backend"

echo "=============================================="
echo "MANJU Universe - Deploy Frontend to Azure"
echo "=============================================="

# Get ACR details
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Get Backend URL to set VITE_API_URL
echo "Fetching Backend URL..."
BACKEND_URL=$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)

if [ -z "$BACKEND_URL" ]; then
    echo "Warning: Could not find Backend URL. Please make sure the backend is deployed first."
    echo "Using fallback: http://localhost:8080"
    API_URL="http://localhost:8080"
else
    API_URL="https://$BACKEND_URL"
fi

echo "Setting VITE_API_URL to: $API_URL"

# Build and Push Frontend Image with Build Args
echo "Building and pushing Frontend..."
az acr build --registry $ACR_NAME \
  --image $FRONTEND_APP_NAME:latest \
  --build-arg VITE_API_URL=$API_URL \
  .

# Deploy Frontend Container App
echo "Deploying Frontend Container App..."
az containerapp create \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV_NAME \
  --image $ACR_LOGIN_SERVER/$FRONTEND_APP_NAME:latest \
  --target-port 80 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --min-replicas 1 \
  --max-replicas 3

FRONTEND_URL=$(az containerapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)

echo "Frontend URL: https://$FRONTEND_URL"

# Update Backend with Frontend URL and Redirect URI for CORS/OAuth
echo ""
echo "Updating Backend configuration (CORS origin and Redirect URI)..."
az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    FRONTEND_URL=https://$FRONTEND_URL \
    REDIRECT_URI=https://$BACKEND_URL/auth/callback/google

echo "Backend updated with CORS origin: https://$FRONTEND_URL"
echo "Backend updated with Redirect URI: https://$BACKEND_URL/auth/callback/google"
echo "---------------------------------------------------"
