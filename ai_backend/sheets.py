"""
Google Sheets Integration Module
Handles check-in data logging to Google Sheets using gspread library.
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import os

# Bangkok timezone (UTC+07:00)
BANGKOK_TZ = timezone(timedelta(hours=7))


class GoogleSheetsService:
    """Service for logging check-in/check-out data to Google Sheets"""
    
    def __init__(self, credentials_file: str = "client_secret.json", spreadsheet_name: str = "DeepCapitalFaceRecognition"):
        """
        Initialize Google Sheets service
        
        Args:
            credentials_file: Path to the service account JSON credentials file
            spreadsheet_name: Name of the Google Spreadsheet to use
        """
        self.credentials_file = credentials_file
        # Main spreadsheet (contains per-day worksheets)
        self.spreadsheet_name = spreadsheet_name
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None
        self.worksheet: Optional[gspread.Worksheet] = None
        self.is_initialized = False
        
    def initialize(self) -> bool:
        """
        Initialize Google Sheets client and prepare the worksheet
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            # Define the scope
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Load credentials
            if not os.path.exists(self.credentials_file):
                print(f"⚠️ Warning: '{self.credentials_file}' not found. Google Sheets integration disabled.")
                print(f"   Please add your service account credentials to enable this feature.")
                return False
            
            # Authorize and create client
            credentials = ServiceAccountCredentials.from_json_keyfile_name(
                self.credentials_file, 
                scope
            )
            self.client = gspread.authorize(credentials)
            
            # Open spreadsheet (create if doesn't exist)
            try:
                self.spreadsheet = self.client.open(self.spreadsheet_name)
                print(f"✅ Opened existing spreadsheet: {self.spreadsheet_name}")
            except gspread.SpreadsheetNotFound:
                # Create new spreadsheet if it doesn't exist
                self.spreadsheet = self.client.create(self.spreadsheet_name)
                print(f"✅ Created new spreadsheet: {self.spreadsheet_name}")
            
            # Select or create a worksheet for today's date (YYYY-MM-DD)
            sheet_title = datetime.now(BANGKOK_TZ).strftime("%Y-%m-%d")
            try:
                self.worksheet = self.spreadsheet.worksheet(sheet_title)
                print(f"✅ Opened existing worksheet: {sheet_title}")
            except Exception:
                # Create new worksheet for the date
                try:
                    self.worksheet = self.spreadsheet.add_worksheet(title=sheet_title, rows="1000", cols="10")
                    print(f"✅ Created worksheet: {sheet_title}")
                except Exception as e:
                    # Fallback to first sheet
                    try:
                        self.worksheet = self.spreadsheet.sheet1
                    except Exception:
                        self.worksheet = None

            # Initialize headers for the selected worksheet if available
            if self.worksheet:
                self._initialize_headers()
            
            self.is_initialized = True
            print(f"✅ Google Sheets integration initialized successfully")
            print(f"   Spreadsheet: {self.spreadsheet_name}")
            print(f"   Worksheet: {self.worksheet.title}")
            
            return True
            
        except FileNotFoundError:
            print(f"❌ Error: '{self.credentials_file}' not found.")
            print(f"   Please make sure the file is in the correct directory.")
            return False
        except Exception as e:
            print(f"❌ Error initializing Google Sheets: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_all_records(self) -> List[Dict[str, Any]]:
        """
        Retrieve all records from the worksheet
        
        Returns:
            List of records as dictionaries
        """
        if not self.is_initialized or not self.worksheet:
            print("⚠️ Google Sheets not initialized.")
            return []
        
        try:
            records = self.worksheet.get_all_records()
            return records
        except Exception as e:
            print(f"❌ Error reading from Google Sheets: {str(e)}")
            return []
    
    def clear_all_data(self, keep_headers: bool = True) -> bool:
        """
        Clear all data from the worksheet
        
        Args:
            keep_headers: If True, keeps the header row
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_initialized or not self.worksheet:
            print("⚠️ Google Sheets not initialized.")
            return False
        
        try:
            if keep_headers:
                # Clear from row 2 onwards
                self.worksheet.delete_rows(2, self.worksheet.row_count)
                print("✅ Cleared all data (kept headers)")
            else:
                # Clear everything
                self.worksheet.clear()
                print("✅ Cleared all data including headers")
            
            return True
            
        except Exception as e:
            print(f"❌ Error clearing Google Sheets: {str(e)}")
            return False

# Singleton instance
_sheets_service: Optional[GoogleSheetsService] = None


def get_sheets_service(
    credentials_file: str = "client_secret.json",
    spreadsheet_name: str = "DeepCapitalFaceRecognition"
) -> Optional[GoogleSheetsService]:
    """
    Get or create Google Sheets service instance
    
    Args:
        credentials_file: Path to service account credentials
        spreadsheet_name: Name of the spreadsheet
        
    Returns:
        GoogleSheetsService instance if initialized, None otherwise
    """
    global _sheets_service
    
    if _sheets_service is None:
        _sheets_service = GoogleSheetsService(
            credentials_file=credentials_file,
            spreadsheet_name=spreadsheet_name
        )
        # Initialize immediately
        success = _sheets_service.initialize()
        if not success:
            # Return the instance anyway, but it will be disabled
            # This allows the app to continue running without Google Sheets
            pass
    
    return _sheets_service


def initialize_sheets_on_startup(
    credentials_file: str = "client_secret.json",
    spreadsheet_name: str = "DeepCapitalFaceRecognition"
) -> bool:
    """
    Initialize Google Sheets service on application startup
    
    This function should be called from FastAPI's @app.on_event("startup")
    
    Args:
        credentials_file: Path to service account credentials
        spreadsheet_name: Name of the spreadsheet
        
    Returns:
        True if initialization successful, False otherwise
    """
    service = get_sheets_service(credentials_file, spreadsheet_name)
    return service.is_initialized if service else False
