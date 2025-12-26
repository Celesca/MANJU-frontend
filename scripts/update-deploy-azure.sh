#!/bin/bash

# Update Deployment Script for MANJU Universe
# This script rebuilds and redeploys the backend and ai_backend containers
# without recreating the infrastructure (Resource Group, ACR, Database, etc.)

# Configuration - must match deploy-azure.sh
RESOURCE_GROUP="manju-universe-rg"
ACR_NAME="manjuuniverseacr"
ACA_ENV_NAME="manju-env"
BACKEND_APP_NAME="manju-backend"
AI_BACKEND_APP_NAME="manju-ai-backend"

# Flags for selective deployment
DEPLOY_BACKEND=true
DEPLOY_AI_BACKEND=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            DEPLOY_AI_BACKEND=false
            shift
            ;;
        --ai-only)
            DEPLOY_BACKEND=false
            shift
            ;;
        --help)
            echo "Usage: ./update-deploy-azure.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-only    Deploy only the backend service"
            echo "  --ai-only         Deploy only the AI backend service"
            echo "  --help            Show this help message"
            echo ""
            echo "By default, both services are deployed."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

echo "=============================================="
echo "MANJU Universe - Update Deployment"
echo "=============================================="
echo "Resource Group: $RESOURCE_GROUP"
echo "ACR Name: $ACR_NAME"
echo "Deploy Backend: $DEPLOY_BACKEND"
echo "Deploy AI Backend: $DEPLOY_AI_BACKEND"
echo "=============================================="

# Verify Azure login
echo "Checking Azure login status..."
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Get ACR credentials
echo "Fetching ACR credentials..."
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
if [ -z "$ACR_LOGIN_SERVER" ]; then
    echo "Error: Could not get ACR login server. Make sure the ACR exists."
    exit 1
fi

ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

echo "ACR Login Server: $ACR_LOGIN_SERVER"

# Generate unique tag based on timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "Deployment Timestamp: $TIMESTAMP"

# Build and Deploy AI Backend
if [ "$DEPLOY_AI_BACKEND" = true ]; then
    echo ""
    echo "----------------------------------------------"
    echo "Building AI Backend..."
    echo "----------------------------------------------"
    az acr build --registry $ACR_NAME --image $AI_BACKEND_APP_NAME:latest --image $AI_BACKEND_APP_NAME:$TIMESTAMP ./ai_backend
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to build AI Backend image."
        exit 1
    fi
    
    echo ""
    echo "Updating AI Backend Container App..."
    az containerapp update \
      --name $AI_BACKEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $ACR_LOGIN_SERVER/$AI_BACKEND_APP_NAME:$TIMESTAMP
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to update AI Backend Container App."
        exit 1
    fi
    
    echo "AI Backend updated successfully!"
fi

# Build and Deploy Backend
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "----------------------------------------------"
    echo "Building Backend..."
    echo "----------------------------------------------"
    az acr build --registry $ACR_NAME --image $BACKEND_APP_NAME:latest --image $BACKEND_APP_NAME:$TIMESTAMP ./backend
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to build Backend image."
        exit 1
    fi
    
    echo ""
    echo "Updating Backend Container App..."
    az containerapp update \
      --name $BACKEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $ACR_LOGIN_SERVER/$BACKEND_APP_NAME:$TIMESTAMP
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to update Backend Container App."
        exit 1
    fi
    
    echo "Backend updated successfully!"
fi

# Get deployment URLs
echo ""
echo "=============================================="
echo "Fetching deployment information..."
echo "=============================================="

if [ "$DEPLOY_BACKEND" = true ]; then
    BACKEND_URL=$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)
    echo "Backend URL: https://$BACKEND_URL"
fi

if [ "$DEPLOY_AI_BACKEND" = true ]; then
    AI_BACKEND_URL=$(az containerapp show --name $AI_BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)
    echo "AI Backend URL: https://$AI_BACKEND_URL"
fi

echo ""
echo "=============================================="
echo "Update deployment complete!"
echo "Deployment Tag: $TIMESTAMP"
echo "=============================================="
