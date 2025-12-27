import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

# Twilio authentication
account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
client = Client(account_sid, auth_token)

def search_and_buy_number(area_code='415'):
    """
    Search for a local phone number and purchase it.
    """
    print(f"Searching for available numbers in area code {area_code}...")
    
    try:
        local_numbers = client.available_phone_numbers('US').local.list(
            area_code=area_code,
            limit=1
        )

        if not local_numbers:
            print("No numbers found.")
            return

        number_to_buy = local_numbers[0].phone_number
        print(f"Found number: {number_to_buy}")

        # Uncomment the following lines to actually buy the number
        # purchased_number = client.incoming_phone_numbers.create(
        #     phone_number=number_to_buy
        # )
        # print(f"Successfully purchased: {purchased_number.sid}")
        
        print("Note: Purchase command is commented out for safety.")
        return number_to_buy

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if not account_sid or not auth_token:
        print("Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env file")
    else:
        search_and_buy_number()
