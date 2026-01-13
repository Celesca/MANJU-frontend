from f5_tts.cleantext.thaig2p_modules import main 
import re
from pythainlp.util import expand_maiyamok
from phonemizer import phonemize
from langdetect import detect

def eng_ipa(text):
    ipa = phonemize(
        text,
        language='en-us',
        backend='espeak',
        strip=True,
        punctuation_marks=';:,.!?¡¿—…"«»“”()',
        preserve_punctuation=True,
        with_stress=True
    )
    return ipa

def ENG2IPA(text):
    ipa_result = eng_ipa(text)
    return ipa_result 

def clean_text(text):
    return re.sub(r'[^\u0E00-\u0E7F\s]', '', text).strip()

def th_to_g2p(text):
    cleaned_text = clean_text(text)
    cleaned_text = expand_maiyamok(cleaned_text)  # Expand Maiyamok characters
    result = main.g2p(cleaned_text, 'ipa')
    return result

def any_ipa(text):
    lang = detect(text)
    if lang == "th":
        ipa_text = th_to_g2p(text)
    elif lang == "en":
        ipa_text = ENG2IPA(text)
    else:
        ipa_text = ENG2IPA(text)

    return ipa_text
