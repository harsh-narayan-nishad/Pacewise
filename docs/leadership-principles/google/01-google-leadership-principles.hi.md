# Google's Leadership Principles (Google के नेतृत्व सिद्धांत)

नीचे के दस headings उस "ten things" सूची का अनुसरण करते हैं जो Google ने अपने बारे में प्रकाशित की थी। हर एक के नीचे का text मौलिक है और दिखाता है कि Pacewise बनाते समय उस विचार का क्या अर्थ है।

## 1. Focus on the user and all else will follow. (user पर ध्यान दें, बाकी सब अपने आप आ जाएगा।)

**In Pacewise:** पाठक app इसलिए खोलता है कि text को तेज़ समझ सके, इसलिए हर screen को सिर्फ़ यही काम करना चाहिए, और कुछ नहीं।

- Story page speed, समय का अनुमान और तीन साफ़ actions वहाँ रखता है जहाँ पाठक की नज़र पहले से होती है।
- पाठक जो आँकड़े देखता है (words per minute, बचा समय, प्रति page समय) वे उसके अपने पढ़ने के बारे में हैं, product के बारे में नहीं।
- जब layout का चुनाव और feature का अनुरोध अलग दिशाओं में खींचें, तो पाठक का ध्यान जीतता है।

## 2. It's best to do one thing really, really well. (एक काम को बहुत अच्छे से करना सबसे बेहतर है।)

**In Pacewise:** वह एक काम है comprehension के साथ पढ़ने का अभ्यास और माप।

- Quizzes, analytics और notes सब एक ही सवाल का जवाब देने के लिए हैं: क्या पढ़ना तेज़ और बेहतर हुआ?
- जो features इस जवाब में मदद नहीं करते वे इंतज़ार करते हैं। Docs site builders के लिए एक reference है, जो पढ़ने के अनुभव से अलग रखी गई है।
- गहराई चौड़ाई से बेहतर है: सही timing वाला एक reader, पाँच अधूरे चलते modes के बजाय।

## 3. Fast is better than slow. (तेज़, धीमे से बेहतर है।)

**In Pacewise:** speed ही product है, इसलिए app खुद धीमा नहीं होना चाहिए।

- जो page 150 ms से कम में load होता है उस पर कोई loader नहीं दिखता, और धीमे page को बीच में एक spinner मिलता है।
- Documentation पहले से build की जाती है और pages eased inertia के साथ scroll होते हैं, इसलिए पढ़ना तुरंत लगता है।
- Search design लगभग 150 ms का end-to-end budget रखता है और उसे हर चरण में बाँट देता है।

## 4. Democracy on the web works. (web पर लोकतंत्र काम करता है।)

**In Pacewise:** भीड़ के शांत संकेत एक उपयोगी input हैं, जिन्हें सावधानी से इस्तेमाल किया जाता है।

- Search design में व्यक्ति के अपने documents के बीच के links votes की तरह काम करते हैं, छोटे weight और एक damping factor के साथ ताकि कोई एक page हावी न हो।
- पाठक जो खोलता और पूरा करता है वह ranking को हल्का धक्का दे सकता है, पर वह सादे text match को कभी नहीं पलटता।
- Stack खुले tools और खुले formats पर निर्भर है, इसलिए contributors बँधे नहीं रहते।

## 5. You don't need to be at your desk to need an answer. (जवाब की ज़रूरत के लिए आपका अपनी desk पर होना ज़रूरी नहीं।)

**In Pacewise:** लोग phones पर पढ़ते हैं, इसलिए product को हाथ में काम करना होगा।

- Documentation sign-in के बाद phone पर QR code से खुलता है।
- Layouts संकरी screens के लिए सिकुड़ जाते हैं, और side rail जैसे अतिरिक्त हिस्से वहाँ छिपा दिए जाते हैं जहाँ वे page को भर देते।
- Touch targets गोल, बड़े और साफ़ labels वाले हैं।

## 6. You can make money without doing evil. (बुराई किए बिना भी पैसा कमाया जा सकता है।)

**In Pacewise:** अगर product कभी कमाई करे, तो नियम उससे पहले तय हो जाते हैं।

- कोई भी paid चीज़ यह नहीं बदल सकती कि पाठक को क्या मिलता है या नतीजे की ranking कैसे होती है।
- जो कुछ भी sponsored है उस पर वैसा label लगता है, और कुछ भी पढ़ने में रुकावट नहीं डालता।
- पढ़ने का personal data बेचा नहीं जाता, और plans को उतनी ही आसानी से रद्द किया जा सकता है जितनी आसानी से वे शुरू होते हैं।

## 7. There's always more information out there. (बाहर हमेशा और जानकारी होती है।)

**In Pacewise:** उपयोगी text सिर्फ़ सादे notes नहीं होता।

- Search design text निकालकर PDFs, scan किए गए pages और photographs तक पहुँचता है, और जहाँ page में text layer नहीं है वहाँ OCR से।
- नतीजे ठीक उसी page की ओर इशारा करते हैं और मिले हुए शब्दों को highlight करते हैं।
- Research folder में नई सामग्री जुड़ती रहती है, इसलिए knowledge base product के साथ बढ़ता है।

## 8. The need for information crosses all borders. (जानकारी की ज़रूरत सभी सीमाएँ पार करती है।)

**In Pacewise:** पाठक कई भाषाएँ इस्तेमाल करते हैं, और speed उन सबमें एक जैसी नहीं होती।

- Index करने से पहले text को normalise किया जाता है और उसकी भाषा पहचानी जाती है।
- Reading-speed के लक्ष्य व्यक्तिगत हैं, किसी एक भाषा के औसत से बँधे नहीं।
- Interface text और docs सरल भाषा में लिखे गए हैं, जिससे उनका अनुवाद भी आसान होता है।

## 9. You can be serious without a suit. (बिना सूट के भी गंभीर हुआ जा सकता है।)

**In Pacewise:** लहजा सहज है और काम सटीक।

- Docs सरल भाषा में असली code, असली आँकड़ों और असली सीमाओं के साथ लिखे गए हैं।
- Tests बिना किसी setup के सादे Node में चलते हैं, इसलिए कुछ जाँचना आसान है और इसीलिए होता है।
- Commit message में मज़ाक ठीक है; बिना test का बदलाव नहीं।

## 10. Great just isn't good enough. (बहुत अच्छा भी काफ़ी नहीं है।)

**In Pacewise:** चलता हुआ feature अगले सुधार की शुरुआत है।

- Speed wheel वहाँ चली गई जहाँ फ़ैसला असल में होता है। Clock अब शून्य के बाद भी गिनती जारी रखती है ताकि दिखे कि पाठक कितना देर से है, क्योंकि अकेला "समय खत्म" बहुत कम बताता था।
- Loaders को कदम-दर-कदम सुधारा गया: contrast, centring, start-up delay और timing, हर एक एक छोटा ईमानदार सुधार।
- Search design अपनी कमज़ोरियाँ खुद सूचीबद्ध करता है और वह संकेत भी जो बताएगा कि कब बदलना है।

---

*Headings प्रकाशित Google सूची का अनुसरण करते हैं। व्याख्याएँ मौलिक हैं और Pacewise के लिए विशिष्ट हैं; वे Google का आधिकारिक बयान नहीं हैं।*
