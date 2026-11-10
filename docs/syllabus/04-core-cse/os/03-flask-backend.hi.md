# Flask backend

**Operating system · Flask backend।** Pacewise की API Express है। यह page दिखाता है कि backend Flask (Python) हो तो वही operating-system विचार कैसे दिखते हैं। यहाँ की कोई चीज़ अभी Pacewise में बनी नहीं है।

## Processes और threads: सबसे बड़ा अंतर
| | Node / Express | Python / Flask |
|---|---|---|
| Concurrency model | हर process में event loop वाला एक thread | **WSGI workers**: gunicorn कई processes शुरू करता है; हर एक एक समय में एक request (sync) या कई (threads) संभालता है |
| सभी CPU cores इस्तेमाल करना | कई processes (replicas) चलाएँ | `gunicorn -w 4` (लगभग 2 × cores + 1) |
| एक process में parallel threads | JavaScript code के लिए नहीं | **GIL** से सीमित: एक समय में सिर्फ़ एक thread Python bytecode चलाता है, लेकिन I/O (database, network) का इंतज़ार करते समय threads फिर भी मदद करते हैं |
| CPU-भारी काम | Loop को block करता है | सिर्फ़ उसी worker को block करता है; बाकी workers serve करते रहते हैं |
| Idle connections (SSE) | सस्ते | हर एक के लिए एक worker या thread, जब तक `gevent` या async framework न हो |

## GIL सरल शब्दों में
Global Interpreter Lock एक process में एक समय पर एक thread को Python code चलाने देता है। MongoDB का इंतज़ार करते समय यह छूट जाता है, इसलिए कई threads फिर भी I/O को overlap करते हैं। शुद्ध गणना ज़्यादा threads से तेज़ नहीं होती, सिर्फ़ ज़्यादा processes से होती है। `bcrypt` package से password hashing C में चलती है और lock छोड़ देती है, इसलिए वह दूसरे threads को उस तरह नहीं रोकती जैसे pure-JavaScript `bcryptjs` Node के loop को रोकता है।

## Process management
- **Master/worker model**: gunicorn का master process workers को fork करता है और जो मर जाए उसे दोबारा शुरू करता है। `--max-requests 1000 --max-requests-jitter 100` workers को recycle करता है ताकि memory की धीमी वृद्धि सीमित रहे।
- **Signals**: `SIGTERM` gunicorn से स्वीकार करना बंद करवाता है, चल रही requests पूरी करवाता है (`--graceful-timeout`) और exit करवाता है; `SIGHUP` configuration दोबारा load करता है; `SIGKILL` को पकड़ा नहीं जा सकता।
- **Fork और shared memory**: हर worker के पास globals की अपनी copy होती है, इसलिए in-memory rate-limit dictionary हर worker की अपनी होती है। साझा state Redis या database में जाती है, ठीक वैसे ही जैसे Express replicas के साथ।
- **Timeouts**: `--timeout 30` एक request पर अटके worker को मार देता है ताकि वह slot को हमेशा के लिए न पकड़े रहे।

## Environment और files
- Configuration environment variables (`os.environ`) से या शुरुआत में load हुई `.env` से; एक बार validate होती है ताकि `MONGODB_URI` गायब हो तो start-up रुक जाए।
- Upload की गई files को container की disk पर नहीं लिखना चाहिए (redeploy पर वह गायब हो जाती है); मौजूदा design की तरह signed URLs के साथ S3 इस्तेमाल करें।
- खुले sockets और files file descriptors हैं; `ulimit -n` उन्हें हर process पर सीमित करता है।

## आपसे पूछे जा सकने वाले सवाल
- GIL क्या है और वह कब मायने रखता है?
- gunicorn कई processes क्यों इस्तेमाल करता है?
- Flask API के लिए threads बनाम processes बनाम async?
- Container को SIGTERM मिलने पर in-flight requests का क्या होता है?
