# Vercel deployments बनाम domain

## सवाल
एक खास deployment URL पर update क्यों नहीं दिखा जबकि main domain पर दिखा?

## निष्कर्ष
- हर deploy को अपना स्थायी URL मिलता है (जैसे `pacewise-xxxx.vercel.app`) जो ==ठीक उसी build== को दिखाता है।
- Production domain हमेशा सबसे नए *production* deployment की ओर point करता है।
- कोई deployment Ready हो सकता है पर promote न हुआ हो, या किसी branch से बना हो, इसलिए उसका URL और domain अलग हो सकते हैं।
- Deployment URLs Vercel authentication से protected भी हो सकते हैं, इसलिए visitors को वे "उपलब्ध नहीं" लग सकते हैं।

## निर्णय
Production domain share करें (और QR code में भी वही इस्तेमाल करें); deployment URLs को per-build previews की तरह मानें।
