# Frontend

**Operating system · Frontend।** Browser आपके app के लिए एक छोटा operating system है: वह काम schedule करता है, memory सीमित करता है, tabs को अलग रखता है और आपको storage देता है। यह page उन विचारों को Pacewise के code से जोड़ता है।

## Tab एक process है; page JavaScript का एक thread है
- हर tab अपने **process** (browser sandbox) में चलता है, इसलिए एक tab का crash या leak दूसरे को नहीं छूता।
- आपका code **main thread** पर एक **event loop** के साथ चलता है: एक समय में एक task। Rendering, clicks और आपका code उसी thread को साझा करते हैं, इसलिए लंबा loop screen को freeze कर देता है (एक "long task", 50 ms से ऊपर)। धीमा PDF parsing इसका मानक उदाहरण है।
- **Web Worker**: PDF library अपने अलग thread में चलती है (`/pdf.worker.min.mjs`) ताकि parsing scrolling को block न करे। Workers की memory अलग होती है और वे messages (**IPC**) से बात करते हैं।

## Scheduling
| API | किसलिए उपयोग |
|---|---|
| `setTimeout` | sync से पहले 400 ms debounce, tracking events का 3 s flush, navigation loader की देरी |
| `setInterval` | 5 s reading heartbeat (`PresenceTracker`), 15 s backend poll |
| `requestAnimationFrame` | सहज animations, screen के refresh के साथ synchronised |
| Page Visibility (`visibilitychange`) | Tab छिपा होने पर reading time रोकता है और queue में रखा data flush करता है; browsers background tabs में timers को throttle भी करते हैं, इसीलिए बीता हुआ समय ticks गिनने के बजाय `performance.now()` से मापा जाता है |

## Memory
- Tab के पास सीमित heap होता है जिसे एक **garbage collector** संभालता है: कोई object तब मुक्त होता है जब कोई उसे reference नहीं करता। भूले हुए timers, event listeners और बड़े arrays सामान्य leaks हैं, इसीलिए effects एक cleanup function लौटाते हैं (`clearInterval`, `removeEventListener`)।
- बड़ी files (PDFs) सबसे ज़्यादा memory खाती हैं। सिर्फ़ पढ़ा जा रहा page और कुछ पड़ोसी pages load करने की योजना browser में लागू किया गया **demand paging** और **prefetching** है।
- `data:` text के रूप में रखी images और PDF pages binary से लगभग एक तिहाई ज़्यादा memory लेती हैं।

## Storage और file system
- `localStorage` एक छोटा key-value store है (प्रति साइट लगभग 5 MB), **synchronous**: हर `setItem` data लिखे जाने तक main thread को block करता है। हर click के बाद पूरा data store लिखना investigation की "random pauses" वाली खोज है।
- Quota के बाद write exception फेंकता है, इसलिए हर write `try/catch` में लपेटा गया है और app memory में चलता रहता है।
- Keys हर user के हिसाब से namespaced हैं (`srt:v2:u:<userId>:<feature>`), जो **per-user directories और permissions** का एक छोटा रूप है।
- Files file picker से आती हैं (browser page के लिए file खोलता है, page को कभी path नहीं मिलता), जो **sandbox** का विचार है: app सिर्फ़ वही देखता है जो user उसे सौंपता है।

## एक browser के अंदर Concurrency
- एक ही साइट के दो tabs `localStorage` साझा करते हैं। वे एक-दूसरे को overwrite कर सकते हैं (एक **race condition**); app इससे बचने के लिए data हर user के हिसाब से रखता है और ज़रूरत पड़ने पर दोबारा पढ़ता है।
- **Single-flight refresh** (token renewal के लिए एक साझा promise) एक promise से लिखा गया mutex है: पहला caller काम करता है, बाकी उसके नतीजे का इंतज़ार करते हैं।

## आपसे पूछे जा सकने वाले सवाल
- Long task क्या है और उसे कैसे हटाएँ?
- समय को timer ticks गिनने के बजाय `performance.now()` से क्यों मापें?
- Process, thread और Web Worker में क्या अंतर है?
- `localStorage` भर जाने पर क्या होता है?
