# Upload किए गए PDF पर गलत owner दिखा

## सवाल
एक व्यक्ति का upload किया हुआ PDF किसी और का दिख रहा था। ऐसा क्यों हुआ?

## निष्कर्ष
- बड़े PDFs browser के localStorage quota से ज़्यादा हो जाते हैं, इसलिए ==save चुपचाप fail हो गया==।
- "यह story user X की है" वाला record उसी step में लिखा जा रहा था, इसलिए वह भी खो गया।
- Owner का कोई record न होने पर app ने उस व्यक्ति को owner मान लिया जो उस समय signed in था।

## Fix
- अब ownership एक अलग छोटी list (`customStoryClaims`) में रखी जाती है जो हमेशा fit हो जाती है।
- `SessionManager.findCustomStoryOwner` किसी और चीज़ पर भरोसा करने से पहले यही list जाँचता है।
- बहुत बड़े PDF वाले case के लिए एक test मौजूद है।

## निर्णय
Ownership को कभी भी बड़े content वाले write के साथ store न करें।
