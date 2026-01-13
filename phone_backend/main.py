import os
from fastapi import FastAPI, Request, Response
from twilio.twiml.voice_response import VoiceResponse, Gather
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# OpenAI Client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are a helpful AI assistant answering a phone call. 
Keep your responses concise and naturally spoken, as they will be converted to speech.
Avoid using special characters or markdown that might sound strange when read aloud.
"""

@app.post("/voice")
async def voice(request: Request):
    """
    Endpoint handle incoming calls from Twilio.
    """
    response = VoiceResponse()
    
    # Greet the caller and gather input
    gather = Gather(input='speech', action='/handle-response', timeout=3)
    gather.say("Hello! This is your AI assistant. How can I help you today?")
    response.append(gather)

    # If no input is received, redirect back to /voice to try again
    response.redirect('/voice')
    
    return Response(content=str(response), media_type="application/xml")

@app.post("/handle-response")
async def handle_response(request: Request):
    """
    Handle the speech input from the caller.
    """
    form_data = await request.form()
    user_speech = form_data.get('SpeechResult', '')

    response = VoiceResponse()

    if user_speech:
        print(f"User said: {user_speech}")
        
        # Generate LLM response
        try:
            ai_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_speech}
                ]
            )
            llm_text = ai_response.choices[0].message.content
        except Exception as e:
            print(f"Error generating LLM response: {e}")
            llm_text = "I'm sorry, I'm having trouble thinking right now. Could you repeat that?"

        # Say the LLM response and gather more input
        gather = Gather(input='speech', action='/handle-response', timeout=3)
        gather.say(llm_text)
        response.append(gather)
    else:
        # If we didn't hear anything, ask again
        gather = Gather(input='speech', action='/handle-response', timeout=3)
        gather.say("I'm sorry, I didn't catch that. Could you say it again?")
        response.append(gather)

    response.redirect('/handle-response')

    return Response(content=str(response), media_type="application/xml")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
