from pathlib import Path
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize client with API key
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

speech_file_path = Path(__file__).parent / "speech_thai.mp3"

with client.audio.speech.with_streaming_response.create(
    model="tts-1",
    voice="alloy",
    input="สวัสดีค่ะ วันนี้เป็นวันที่ดีมากที่จะสร้างสิ่งที่คนรักษ์",
) as response:
    response.stream_to_file(speech_file_path)

print(f"Thai speech saved to {speech_file_path}")