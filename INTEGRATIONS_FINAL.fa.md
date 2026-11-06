# FEZI HostBridge AI — بسته یکپارچه‌سازی

این نسخه شامل برنامه Node.js، رابط فارسی، ابزارهای موجود، و راهنمای افزونه Heretic است. ثبت مدل در فهرست به معنی نصب خودکار وزن یا اجرای آن نیست.

## مدل‌های رایگان یا وزن‌باز
- Ollama: https://github.com/ollama/ollama
- Qwen2.5-Coder: https://ollama.com/library/qwen2.5-coder
- DeepSeek-R1: https://ollama.com/library/deepseek-r1
- Dolphin3: https://ollama.com/library/dolphin3
- Mistral: https://ollama.com/library/mistral
- Gemma3: https://ollama.com/library/gemma3

## عامل‌های برنامه‌نویسی
- Goose: https://github.com/block/goose
- OpenCode: https://github.com/anomalyco/opencode
- OpenHands: https://github.com/OpenHands/OpenHands
- Cline: https://github.com/cline/cline
- Aider: https://github.com/Aider-AI/aider
- Qwen Code: https://github.com/QwenLM/qwen-code

## تولید تصویر و ویدیو
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- SDXL: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
- FLUX.1 schnell: https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Wan 2.2 TI2V 5B: https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B
- LTX-Video: https://github.com/Lightricks/LTX-Video
- CogVideoX: https://github.com/THUDM/CogVideo
- HunyuanVideo: https://github.com/Tencent/HunyuanVideo

## افزونه تغییر رفتار مدل زبانی
- Heretic: https://github.com/p-e-w/heretic
- OBLITERATUS: https://github.com/elder-plinius/OBLITERATUS

Heretic روی مدل‌های زبانی سازگار و وزن‌های قابل تغییر اجرا می‌شود؛ روی Stable Diffusion، FLUX و Wan افزونه مستقیم نیست. کلید روشن/خاموش واقعی باید بین دو نسخه مستقل از مدل جابه‌جا شود. اجرای Heretic و نصب وزن مدل در این بسته خودکار نیست.

## راه‌اندازی
`npm test` و سپس تنظیم `.env` با رمز امن و اجرای `npm start`؛ برای انتشار عمومی HTTPS، کنترل دسترسی و تنظیمات کوکی امن ضروری است. فایل `.env` واقعی و کلیدهای API را هرگز به GitHub نفرستید.

## وضعیت انتشار
این بسته یک نسخه قابل دریافت و توسعه است، نه ادعای فعال بودن همه سرویس‌ها یا انتشار عمومی در GitHub.
