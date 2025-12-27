# Phone Backend with Twilio and LLM

This directory contains a sample implementation of a phone protocol backend that uses Twilio for voice calls and OpenAI for generating conversational responses.

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configure Environment Variables**:
    - Copy `.env.example` to `.env`.
    - Fill in your `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `OPENAI_API_KEY`.
    - (Optional) Use `ngrok` to expose your local server if you want to test with real calls: `ngrok http 8000`. Set `PUBLIC_URL` in `.env` to your ngrok URL.

3.  **Buy a Phone Number (Optional)**:
    - Run `python manage_number.py` to search for available numbers.
    - To actually buy a number, uncomment the relevant lines in `manage_number.py`.

4.  **Run the Server**:
    ```bash
    python main.py
    ```
    The server will start on `http://localhost:8000`.

5.  **Configure Twilio Webhook**:
    - In your Twilio Console, go to the "Active Numbers" section.
    - Select your phone number.
    - Under "Voice & Fax", set the "A CALL COMES IN" webhook to `https://your-domain.ngrok-free.app/voice`.
    - Ensure the method is set to `HTTP POST`.

## How it Works

-   **`/voice`**: When someone calls the number, Twilio sends a POST request here. The AI greets the caller and starts "gathering" their speech.
-   **`/handle-response`**: When the caller speaks, Twilio transcribes the speech and sends it here. This script then sends the text to OpenAI to generate a natural response.
-   **TwiML**: The backend responds to Twilio with TwiML (XML), telling it what to say back to the user and to keep listening.
