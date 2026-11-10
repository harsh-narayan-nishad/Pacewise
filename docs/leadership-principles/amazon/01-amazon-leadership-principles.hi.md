# Amazon's Leadership Principles (Amazon के नेतृत्व सिद्धांत)

नीचे के सोलह headings Amazon की प्रकाशित सूची का अनुसरण करते हैं। हर एक के नीचे का text मौलिक है: वह बताता है कि जब product Pacewise हो, तो उस सिद्धांत का क्या अर्थ है। Pacewise एक reading-speed और comprehension platform है जिसमें quizzes, personal analytics, documentation और एक search engine है।

## Customer Obsession

**In Pacewise:** customer वह व्यक्ति है जो तेज़ पढ़ना चाहता है और फिर भी समझना चाहता है। हर feature को इस पर परखा जाता है कि क्या वह उस व्यक्ति को कहानी पूरी करने और उसे याद रखने में मदद करता है।

- Speed कहानी के landing page पर, clock शुरू होने से पहले चुनी जाती है, ताकि पढ़ने में खुद कुछ भी झंझट वाला न रहे।
- Quiz समझ को मापता है, सिर्फ़ speed को नहीं, इसलिए words-per-minute का ऊँचा आँकड़ा कमज़ोर comprehension को छिपा नहीं सकता।
- Loader तभी दिखता है जब कोई page सचमुच 150 ms से ज़्यादा लेता है, क्योंकि तेज़ page पर spinner वह शोर है जो पाठक ने कभी माँगा ही नहीं।

**पूछने वाला सवाल:** क्या यह न होता तो पाठक को पता चलता, और क्या वह इसके लिए हमारा धन्यवाद करता?

## Ownership

**In Pacewise:** एक ही व्यक्ति पूरे product का मालिक है, sign-in और per-user storage से लेकर docs और search design तक। किसी आधी-सुलझी समस्या को आगे सौंपने के लिए नीचे कोई नहीं है।

- "landing page तक पहुँचने के लिए दो click" वाला bug button पर patch करके नहीं सुलझाया गया। कारण एक story page था जो story को clear किए जाने के तुरंत बाद उसे दोबारा load कर देता था, और fix वहीं किया गया।
- Fix तब पूरा होता है जब user पुष्टि कर दे, तब नहीं जब code compile हो जाए। इसी कारण hydration error दो बार report किया गया।
- Documentation feature का हिस्सा है: अगर behaviour बदलता है, तो doc उसी delivery में बदलता है।

**पूछने वाला सवाल:** अगर यह अगले महीने टूटे, तो यह किसकी समस्या है? अगर जवाब "मेरी" है, तो यह एक test और एक note का हक़दार है।

## Invent and Simplify

**In Pacewise:** सिर्फ़ वहीं नया बनाएँ जहाँ मौजूदा tools फ़िट नहीं बैठते, और फिर नतीजे को छोटा रखें।

- Docs के लिए Markdown renderer में कोई dependency नहीं है, वह ठीक वही सपोर्ट करता है जो docs को चाहिए (tables, caption वाला code, diagrams), और पहले सब कुछ escape करता है।
- लगभग खाली पन्ने रखने के बजाय कई syllabus chapters को मिलाकर एक Overview बना दिया गया।
- Select-and-highlight tool को docs से हटा दिया गया क्योंकि उसने बोझ बढ़ाया पर किसी को पढ़ने में मदद नहीं की।

**पूछने वाला सवाल:** क्या यह कम हिस्सों से हो सकता है, और अगर हमें कुछ हटाना पड़े तो हम क्या हटाएँगे?

## Are Right, A Lot

**In Pacewise:** सही होने का तरीका जाँचना है, पक्का महसूस करना नहीं।

- शुद्ध logic (grading, page timing, overtime clock, session isolation) छोटे functions में रहता है, जिनके tests सादे Node में चलते हैं।
- Search design में capacity के आँकड़े मान्यताओं (assumptions) के रूप में लिखे जाते हैं और दोबारा गणना किए जाते हैं, ताकि उन पर बहस की जा सके।
- जब assistant app को browser में नहीं चला सकता, तो delivery यह बता देती है, ताकि owner को पता रहे कि किस चीज़ की असली जाँच बाकी है।

**पूछने वाला सवाल:** मुझे क्या गलत साबित करेगा, और क्या मैंने उसे ढूँढा है?

## Learn and Be Curious

**In Pacewise:** प्रोजेक्ट में एक Research folder और एक Interview prep folder है क्योंकि सीखना काम का हिस्सा है।

- असली systems के case studies (tracker-network design, collaborative editing, search engines) का अध्ययन किया गया, फिर उन्हें प्रोजेक्ट के अपने शब्दों में लिखा गया।
- छोटी बातें अंदाज़े से नहीं, खोजकर देखी गईं: spinner कैसे शुरू होना चाहिए, कितनी देर की प्रतीक्षा छिपाने लायक है, blur material कैसे व्यवहार करता है।
- हर नई technique के लिए docs में एक छोटा note जुड़ता है ताकि सीखा हुआ खो न जाए।

**पूछने वाला सवाल:** एक महीने पहले हमें क्या नहीं पता था जो अब हमारे बनाने का तरीका बदल देता है?

## Hire and Develop the Best

**In Pacewise:** अभी कोई hiring नहीं है, इसलिए यह सिद्धांत बन जाता है "अगले contributor को जल्दी काबिल बनाओ"।

- Architecture doc एक छोटी recipe के साथ खत्म होता है कि per-user feature कैसे जोड़ें: एक repository class, registration की एक line।
- Docs हर फ़ैसले का कारण समझाते हैं, ताकि नया व्यक्ति सिर्फ़ code नहीं, सोच भी सीखे।
- Interview prep के पन्ने प्रोजेक्ट के अपने काम को अभ्यास की सामग्री में बदल देते हैं।

**पूछने वाला सवाल:** क्या कोई नया व्यक्ति सिर्फ़ docs की मदद से दूसरे ही दिन कोई feature जोड़ सकता है?

## Insist on the Highest Standards

**In Pacewise:** "मेरी machine पर चलता है" कोई पैमाना नहीं है।

- Motion reduced-motion setting का सम्मान करता है, controls पर labels हैं, और सिर्फ़ icon वाले buttons hover करने पर खुद को समझाते हैं।
- Hydration की समस्याएँ, scroll की गड़बड़ियाँ और layout का overlap खामियाँ माने जाते हैं, सजावट नहीं।
- हर बदलाव tests, syntax check और इसकी ईमानदार सूची के साथ आता है कि क्या verify नहीं हुआ।

**पूछने वाला सवाल:** क्या यह ऐसे reviewer के सामने टिकेगा जो खामी ढूँढना चाहता है?

## Think Big

**In Pacewise:** उस आकार के लिए design करें जिस तक product पहुँच सकता है, भले ही अभी वह छोटा हो।

- Search-engine design दस लाख users और सैकड़ों करोड़ documents मानकर चलता है, और दिखाता है कि storage आसान है जबकि OCR, isolation और ranking कठिन हैं।
- Features seams पर बनाए जाते हैं (हर feature के लिए एक repository, storage के ऊपर एक facade) ताकि screens को दोबारा लिखे बिना local storage की जगह असली backend आ सके।
- Phases में बना roadmap बड़े विचार और अगले छोटे कदम को साथ-साथ दिखाता रखता है।

**पूछने वाला सवाल:** अगर कल दस हज़ार गुना ज़्यादा लोग इसका उपयोग करें, तो सबसे पहले क्या टूटेगा?

## Bias for Action

**In Pacewise:** यहाँ के ज़्यादातर फ़ैसले पलटे जा सकते हैं, इसलिए वे जल्दी लिए जाते हैं और छोटे कदमों में ship किए जाते हैं।

- काम छोटे rounds में दिया जाता है, हर एक ऐसा working build जिसे owner आज़मा और सुधार सके।
- Search का पहला phase एक छोटा bundled index है, cluster नहीं, क्योंकि उसे बाद में बदला जा सकता है।
- धीमे या अपरिवर्तनीय फ़ैसलों (किसी व्यक्ति के बारे में कौन सा data रखा जाए, क्या delete हो) पर ज़्यादा सोचा जाता है, क्योंकि उन्हें वापस नहीं लिया जा सकता।

**पूछने वाला सवाल:** क्या यह फ़ैसला पलटा जा सकता है? अगर हाँ, तो अभी तय करें।

## Frugality

**In Pacewise:** सीमाएँ product को बेहतर बनाती हैं।

- Documentation build के समय bundle हो जाता है, इसलिए पैसे देकर चलाने के लिए कोई docs server नहीं है।
- नए लिखने से पहले मौजूदा components (cards, buttons, loader) दोबारा इस्तेमाल किए जाते हैं।
- Diagrams हाथ से लिखी SVG files हैं, कोई licensed tool नहीं, और भारी libraries CDN से तभी load होती हैं जब कोई diagram खुलता है।

**पूछने वाला सवाल:** अगर यह free tier पर चलाना पड़े, तो हम क्या बनाएँगे?

## Earn Trust

**In Pacewise:** भरोसा इस बात को साफ़-साफ़ बताने से बना रहता है कि product व्यक्ति के data के साथ क्या करता है और क्या नहीं कर सकता।

- Reading time, test time और documentation time एक sign-in किए हुए user के होते हैं और कभी किसी दूसरे के साथ नहीं मिलते।
- पन्ने एक "Limits" section पर खत्म होते हैं जो बताता है कि क्या शामिल नहीं है।
- जिन third-party images और posts के अधिकार साफ़ नहीं थे उन्हें इस उम्मीद में रखने के बजाय हटा दिया गया कि किसी को आपत्ति नहीं होगी।

**पूछने वाला सवाल:** अगर user ठीक-ठीक पढ़ ले कि यह कैसे काम करता है, तो क्या मैं सहज रहूँगा?

## Dive Deep

**In Pacewise:** लक्षण (symptom) कभी जवाब नहीं होता।

- जो story page ऊपर तक glide करने से पहले अपना बीच का हिस्सा flash करता था, उसकी वजह page-wide smooth scrolling और सहेजी गई scroll position का मेल निकला। Fix था paint से पहले एक instant scroll।
- जो rendering error एक fix के बाद भी बचा रहा, उसका पता quotes वाले style text से चला, और उसे तीन जगह उसके स्रोत पर ठीक किया गया।
- User को दिखाए जाने वाले आँकड़े (प्रति page समय, कुल) tests में ज्ञात inputs से दोबारा निकाले जाते हैं।

**पूछने वाला सवाल:** क्या मैंने असली कारण देखा है, या सिर्फ़ उसका अंदाज़ा लगाया है?

## Have Backbone; Disagree and Commit

**In Pacewise:** जब कोई अनुरोध product को नुकसान पहुँचाएगा तो साफ़ कहें, फिर जो तय हुआ वही बनाएँ।

- चिंता को कारण और एक विकल्प के साथ, एक बार, लिखित में रखें।
- Sign-in के पीछे docs रखना साफ़ कारण से लिया गया फ़ैसला है (समय को व्यक्ति के नाम किया जा सकता है), जिसे फिर पूरी तरह लागू किया गया।
- फ़ैसले docs में दर्ज किए जाते हैं, ताकि बाद का कोई बदलाव सोच-समझकर पलटना हो, दुर्घटना नहीं।

**पूछने वाला सवाल:** क्या मैंने अपनी राय कह दी है, और फ़ैसला होने के बाद क्या मैं उसे पूरी तरह बना रहा हूँ?

## Deliver Results

**In Pacewise:** नतीजे वे आँकड़े हैं जो दिखाते हैं कि product काम करता है।

- मुख्य inputs हैं: reading speed जो quiz के दबाव में भी टिके, quiz की accuracy, पहली उपयोगी screen तक का समय और search latency।
- हर delivery बताती है कि क्या बदला, क्या पास हुआ, और किसे अब भी इंसान को आज़माना है।
- झटके (fail हुआ test, खराब regular expression) ठीक करके दोबारा भेजे जाते हैं, छिपाए नहीं जाते।

**पूछने वाला सवाल:** इस काम की वजह से कौन सा आँकड़ा हिला?

## Strive to be Earth's Best Employer

**In Pacewise:** इसे ऐसे पढ़ें: "इसे बनाने वालों के लिए काम करने की सबसे अच्छी जगह बनो और रोज़ इस्तेमाल करने वालों के लिए सबसे अच्छा product।"

- Break tracker दिखाता है कि आराम effective reading speed को कैसे प्रभावित करता है, इसलिए product खुद स्वस्थ गति को बढ़ावा देता है।
- Text size, contrast themes और reduced motion विकल्प हैं, बाद में सोची गई चीज़ें नहीं।
- साफ़ docs और छोटा, test करने लायक code लिखने से contributor सब कुछ तोड़ देने के डर के बिना आगे बढ़ पाता है।

**पूछने वाला सवाल:** क्या इसे इस्तेमाल करने या बनाने वाला व्यक्ति एक साल बाद इससे बेहतर स्थिति में होगा?

## Success and Scale Bring Broad Responsibility

**In Pacewise:** जैसे-जैसे audience बढ़ता है, ज़िम्मेदारियाँ भी बढ़ती हैं।

- Personal data हर user के लिए अलग रखा जाता है, उस user द्वारा clear किया जा सकता है, और design में हटाया गया document एक दिन के भीतर search से हट जाता है।
- सिर्फ़ वही content प्रकाशित होता है जिसे साझा किया जा सकता है, और श्रेय वहीं दिया जाता है जहाँ वह बनता है।
- लागत, ऊर्जा और bandwidth पर नज़र रखी जाती है: छोटे pages, lazy loading, और कोई बेकार background काम नहीं।

**पूछने वाला सवाल:** अगर दस लाख लोग इस पर निर्भर हों तो यह कैसा दिखेगा?

---

*Headings प्रकाशित Amazon सूची का अनुसरण करते हैं। व्याख्याएँ मौलिक हैं और Pacewise के लिए विशिष्ट हैं; वे Amazon का आधिकारिक बयान नहीं हैं।*
