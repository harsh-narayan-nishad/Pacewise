# Scaling, security और test notifier

## सवाल
Pacewise को real backend के साथ बड़े scale पर सुरक्षित तरीके से चलाने के लिए क्या करना होगा, और "test दो / revise करो" वाला reminder कैसे काम करना चाहिए?

## निष्कर्ष
- ==State को browser से बाहर जाना होगा।== अभी progress, sessions और stories localStorage में रहती हैं; backend में हर user के लिए एक ही source of truth चाहिए, जो API के पीछे हो।
- **Reads ज़्यादा होते हैं।** Story pages और notes लिखे कम और पढ़े ज़्यादा जाते हैं, इसलिए ये CDN और cache के लिए सही बैठते हैं; user progress में writes ज़्यादा होते हैं, इसलिए यह per-user partitioning वाले database के लिए सही है।
- **Security की बुनियादी बातें** जिनकी लागत कम है और जो ज़्यादातर incidents रोक देती हैं: hashed passwords, कम समय वाले tokens, हर query पर per-user authorisation, login और upload पर rate limits, और हर boundary पर input validation।
- **Uploads** (PDFs) signed URL के ज़रिए सीधे object storage में जाते हैं; server सिर्फ़ metadata और owner id रखता है।
- **Monitoring**: structured logs, request-level metrics (latency, errors), और अकेली failures के बजाय error rate पर alerts।

## Notifier algorithm
Spaced repetition इस्तेमाल करें: हर test के बाद अगला review ऐसे interval पर schedule करें जो score अच्छा होने पर बढ़े और खराब होने पर घटे।

| Score | अगला review |
| --- | --- |
| 50% से कम | अगले दिन |
| 50–80% | 3 दिन में |
| 80% से ऊपर | 7 दिन में, फिर हर बार दोगुना |

एक scheduler job उन users को चुनता है जिनका next-review समय बीत चुका है और हर user को एक reminder भेजता है, ==दिन में एक से ज़्यादा कभी नहीं==।

## निर्णय
फ़िलहाल मौजूदा client-side design रखें; backend जोड़ते समय पहले state, फिर uploads, फिर reminders को move करें।
