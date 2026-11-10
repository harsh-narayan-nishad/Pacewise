# Story page

वह page जो story load होने पर `/` पर दिखता है (`components/Dashboard/Dashboard.tsx`)।

## Layout (ऊपर से नीचे)
1. **Hero** (`components/Dashboard/StoryHero.tsx`) – story का upload किया गया video muted/looping चलता है, thumbnail उसके poster के रूप में (नहीं हो तो thumbnail, फिर gradient)। Title, एक stats pill, **Read below** और एक नीला **Start reading** (practice mode) button।
2. Author / follow / content actions / Edit।
3. **पूरी story**, डिफ़ॉल्ट रूप से reading mode में (`ReadingModePage` के साथ `embedded`) – किसी toggle की ज़रूरत नहीं।
4. Reading stats, About this story, Reading speed, Start reading + Bookmark।

## Reading extras (सिर्फ़ तब जब article दिख रहा हो)
- **Progress bar** `bottom-0` पर fixed, `BRAND_BLUE` (`#306fdb`, `lib/brand.ts`) में।
- **Section rail** **दाईं** ओर (`ScrollRail side="right"`), active mark उसी नीले रंग में।
- **Text size** A−/A+ pill (80%–180%), `localStorage` (`speed-reader.story-font-scale`) में याद रखा जाता है; `readingMode.css` (`.sr-embedded`) में `--sr-scale` CSS variable से implement किया गया है।

## हटाया गया
"Past test attempts" अब hamburger menu में है और `/history` खोलता है।

## अपरिवर्तित
`/read` (toggle वाला reading mode) अभी भी बाईं rail और navbar progress bar इस्तेमाल करता है।

## Section list और speed wheel
- दाईं ओर की section list चौड़ी screens पर हमेशा खुली रहती है; किसी dash पर click करने से उस section तक scroll होता है और list छिपती/दिखती है (`ScrollRail alwaysOpen`)।
- एक speed wheel (`components/ui/OptionWheel.tsx`, React Bits से; `ReadingMode/SpeedWheel.tsx` द्वारा wrap किया गया) पहले article के बाएँ किनारे पर होता था; अब यह landing hero पर है (नीचे देखें)। कोई भी reading speed चुनने के लिए इसे घुमाएँ।
- Navbar की clock words ÷ wpm से real time में नीचे गिनती करती है। यह तब शुरू होती है जब controls दिखते हैं और कभी scrolling पर निर्भर नहीं करती।
- Reading controls (section list, text size, नीचे का progress bar) hero के scroll होकर निकल जाने पर दिखते हैं और ऊपर से वापस आने पर फिर छिप जाते हैं।

## Story page पर Speed, clock और navigation

- **Landing hero पर speed wheel।** Words-per-minute wheel hero में "day streak" line के ऊपर है, इसलिए पढ़ना शुरू होने से पहले ही speed चुनी जाती है। Wheel सिर्फ़ landing hero पर है (article से हटा दिया गया है)। Speed buttons वहीं रहते हैं जहाँ थे: reader के controls और shortcuts, और reading mode में navbar के -/+।
- **Overtime वाली clock।** Navbar की clock words ÷ speed से नीचे गिनती करती है। 0 पर एक बार alert आता है, clock लाल हो जाती है और "+" के साथ ऊपर गिनती करती है (जैसे `+0:07`), ताकि आप देख सकें कि आप कितने लेट हैं। इसका गणित `lib/readingMode/progress.ts` में `clockFace` है; alert `useOvertimeAlert` है।
- **Hero पर Previous / Next।** गोल, सिर्फ़ icon वाले buttons highlighted action को *Read below*, *Quiz* और *Start reading* के बीच बदलते हैं; hover करने पर दिखता है कि हर एक कौन-सा action चुनता है। ये hover या click पर हिलते नहीं।
- **Opening glitch ठीक किया गया।** App page पर `scroll-behavior: smooth` सेट करता है, इसलिए scroll की हुई landing page से story खोलने पर पहले article दिखता था और फिर वह hero तक glide करता था। `useScrollToTopOnMount` अब पहले paint से पहले तुरंत ऊपर कूद जाता है।
- **Time analysis।** देखें [TIME_ANALYSIS.md](TIME_ANALYSIS.md)।

## Navigation loader

Signed-in app page load होते समय पूरी screen को theme colour और बीच में एक tick spinner से ढक देता है (`contexts/NavLoaderContext.tsx`): कोई भी internal link अपने-आप ढक जाता है और `useNavLoader().push` code से होने वाले navigation (story cards, logo, menu) को ढकता है। 150 ms से कम का load इसे कभी नहीं दिखाता। Docs pages पर full-screen loader नहीं आता: सिर्फ़ उनकी hamburger-menu rows पर एक छोटा spinner दिखता है, और Prev / Next buttons अपना खुद का रखते हैं। Logo अब एक click में landing page पर पहुँचा देता है (story route अब उस story को दोबारा load नहीं करता जिसे अभी clear किया गया हो)।
