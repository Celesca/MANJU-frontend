@echo off
REM Azure Blob Storage Setup for MANJU Voice Files
REM Run this script in PowerShell or CMD with Azure CLI installed

REM ============================================
REM STEP 1: Install Azure CLI (if not installed)
REM ============================================
REM Download and run from: https://aka.ms/installazurecliwindows
REM Or use winget:
REM   winget install Microsoft.AzureCLI

REM ============================================
REM STEP 2: Login to Azure
REM ============================================
az login

REM ============================================
REM STEP 3: Set your subscription (if multiple)
REM ============================================
REM az account set --subscription "YOUR_SUBSCRIPTION_NAME"

REM ============================================
REM STEP 4: Create Resource Group (if needed)
REM ============================================
set RESOURCE_GROUP=manju-rg
set LOCATION=southeastasia
az group create --name %RESOURCE_GROUP% --location %LOCATION%

REM ============================================
REM STEP 5: Create Storage Account
REM ============================================
REM Storage account name must be globally unique, lowercase, 3-24 chars
set STORAGE_ACCOUNT=manjuvoices%RANDOM%
az storage account create ^
    --name %STORAGE_ACCOUNT% ^
    --resource-group %RESOURCE_GROUP% ^
    --location %LOCATION% ^
    --sku Standard_LRS ^
    --kind StorageV2 ^
    --access-tier Hot

REM ============================================
REM STEP 6: Get Connection String
REM ============================================
echo.
echo Getting connection string...
az storage account show-connection-string ^
    --name %STORAGE_ACCOUNT% ^
    --resource-group %RESOURCE_GROUP% ^
    --query connectionString ^
    --output tsv

REM ============================================
REM STEP 7: Create Container with Public Access
REM ============================================
az storage container create ^
    --name voices ^
    --account-name %STORAGE_ACCOUNT% ^
    --public-access blob

echo.
echo ============================================
echo SETUP COMPLETE!
echo ============================================
echo.
echo Storage Account: %STORAGE_ACCOUNT%
echo Container: voices
echo.
echo Add the connection string to your backend/.env:
echo AZURE_STORAGE_CONNECTION_STRING=<paste connection string here>
echo AZURE_STORAGE_CONTAINER=voices
echo.
pause
