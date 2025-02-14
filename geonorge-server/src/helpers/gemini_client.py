import google.generativeai as genai
from config import CONFIG

class GeminiClient:
    def __init__(self):
        self.api_key = "AIzaSyDapi3JKu23c32hiPfyxzvp6hjSXxiGQVc"
        genai.configure(api_key=self.api_key)
        
    async def generate_content(self, prompt: str, context: str = "", history: str = "") -> str:
        full_prompt = f"{prompt}\n\nContext: {context}\n\nHistory: {history}"
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(full_prompt, stream=True)
        
        full_text = ""
        try:
            for chunk in response:
                if chunk.text:
                    full_text += chunk.text
            return full_text
        except Exception as e:
            print(f"Error generating content: {e}")
            return "Sorry, I encountered an error while generating the response."