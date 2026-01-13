import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from faster_whisper import WhisperModel
from deep_translator import GoogleTranslator

def transribe_inference(model="large-v3-turbo",compute_type="float16",input_audio="",language="Auto"):
    
    model_size = model

    # Run on GPU with FP16
    model = WhisperModel(model_size, device="cuda", compute_type=compute_type)
    
    ref_audio = input_audio

    segments, info = model.transcribe(
        ref_audio,
        language=None if language == "Auto" else language,
        beam_size=5,
        task="transcribe",
        condition_on_previous_text=False,
        without_timestamps=True,
        chunk_length=40,
        vad_filter=True
    )

    print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

    # Concatenate all segment texts into one line
    output_text = " ".join([segment.text.strip() for segment in segments])
    print("Transcribe Text :",output_text)

    return output_text

def translate_inference(text=str,target="th"):
    translated = GoogleTranslator(source='auto', target=target).translate(text=text)
    print("Translated Text:",translated)
    return translated

#input_ref_audio = "ref/ref_gen_7_jp_male,คิโซนโนเอบุไซโตะโอโคเอะตะ โคมุนิเคชั่นโอจิตสึเกน..wav"
#tranlsate = False

#if tranlsate:
#    translate_inference(text=transribe_inference(input_audio=input_ref_audio))
#else:
#    transribe_inference(input_audio=input_ref_audio)
