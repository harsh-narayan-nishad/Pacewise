# 13 · HTML और CSS

HTML और CSS की बुनियादी बातों के लिए इंटरव्यू तैयारी के नोट्स: semantic HTML, attributes, links, lists और tables, forms, CSS selectors, text/font/background properties, box model और positioning। हर उदाहरण एक पूरा, चलने लायक snippet है; हर उदाहरण का caption बताता है कि वह किस फ़ाइल का हिस्सा है (`index.html` या `styles.css`)। ये नोट्स हमारे अपने शब्दों में लिखे गए हैं; हर उदाहरण को दोबारा टाइप करके और बदलकर अभ्यास करें।

**कैसे इस्तेमाल करें:** जवाब को ढक लें, ज़ोर से बोलें, फिर मिलाएँ। हर topic के लिए एक **common mistake** (आम गलती) और **browser में उसे कैसे test करें** भी तैयार रखें।

---

## 1. Semantic HTML

एक **semantic element** browser और developer दोनों को बताता है कि उसका content *क्या है*। `<div>` और `<span>` कुछ नहीं बताते; `<article>`, `<nav>`, `<header>` बताते हैं।

| Element | मतलब |
| --- | --- |
| `<header>` | शुरुआती content या navigation links (कई बार आ सकता है, लेकिन किसी दूसरे header/footer/address के अंदर नहीं) |
| `<nav>` | navigation links का एक मुख्य ब्लॉक (हर link यहाँ नहीं रखा जाता) |
| `<main>` | document का मुख्य content (हर page में एक) |
| `<section>` | content का विषय के आधार पर बना समूह, आमतौर पर heading के साथ |
| `<article>` | स्वतंत्र, अपने आप में पूरा content जो अकेले भी समझ में आए (blog post, forum post, product card) |
| `<aside>` | ऐसा content जो आसपास के content से सिर्फ़ परोक्ष रूप से जुड़ा है (sidebar) |
| `<figure>` / `<figcaption>` | अपने आप में पूरा चित्र, diagram या code listing और उसका caption |
| `<footer>` | लेखक, copyright, संपर्क, संबंधित links |
| `<details>` / `<summary>` | ऐसा content जिसे user दिखा या छिपा सकता है, और उसकी दिखने वाली heading |
| `<mark>` / `<time>` | highlight किया हुआ text / कोई तारीख या समय |

```html title="index.html" principle="Semantic HTML — structure describes meaning: header, nav, main, section, article, aside, footer"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Semantic page</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header>
      <h1>Browser news</h1>
      <nav>
        <a href="/html/">HTML</a> |
        <a href="/css/">CSS</a> |
        <a href="/js/">JavaScript</a>
      </nav>
    </header>

    <main>
      <section>
        <h2>Most popular browsers</h2>
        <article>
          <h3>Google Chrome</h3>
          <p>A web browser developed by Google, released in 2008.</p>
        </article>
        <article>
          <h3>Mozilla Firefox</h3>
          <p>An open-source web browser developed by Mozilla.</p>
        </article>
      </section>

      <aside>
        <h4>Did you know?</h4>
        <p>A sidebar is related to the page, but not part of its main flow.</p>
      </aside>
    </main>

    <footer>
      <p>Author: Your Name</p>
      <p><a href="mailto:you@example.com">you@example.com</a></p>
    </footer>
  </body>
</html>
```

**Semantic बनाम non-semantic।** Semantic elements का एक अर्थ होता है, वे बताते हैं कि उनका content क्या है, और browsers, search engines व screen readers के लिए built-in behaviour साथ लाते हैं। Non-semantic elements (`div`, `span`) का कोई अर्थ नहीं होता और उन्हें `class`/`id` से style किया जाता है।

```html title="index.html" principle="Same result, different meaning — the semantic version is readable by machines and assistive technology"
<!-- Non-semantic: the structure is only in class names -->
<div class="header">
  <div class="nav">Menu</div>
</div>

<!-- Semantic: the structure is in the elements -->
<header>
  <nav>Menu</nav>
</header>
```

**क्या `<article>`, `<section>` के अंदर होता है, या उल्टा?** दोनों होते हैं। परिभाषाएँ (स्वतंत्र content बनाम विषय के आधार पर समूह) nesting तय नहीं करतीं; वही चुनें जो आपके content को बेहतर बताए।

**इंटरव्यू के जवाब**
- *Semantic HTML क्यों?* Accessibility (screen readers सीधे `<main>` या `<nav>` पर जा सकते हैं), SEO, maintainability, और समझदार defaults।
- *`section` बनाम `div`?* जब content किसी heading वाला विषयगत समूह हो तब `section` इस्तेमाल करें; `div` सिर्फ़ styling/layout के hook के लिए।
- *आम गलती:* हर link को `<nav>` के अंदर रख देना; यह सिर्फ़ मुख्य navigation ब्लॉक के लिए है।

---

## 2. Attributes

Attributes किसी element को अतिरिक्त जानकारी देते हैं और हमेशा **opening tag** में लिखे जाते हैं।

| Attribute | उद्देश्य |
| --- | --- |
| `src` | media (image, video, audio) का source; `<img>` के लिए ज़रूरी |
| `alt` | image load न होने पर दिखने वाला वैकल्पिक text; screen readers इसे पढ़ते हैं |
| `width`, `height` | आकार (layout shift से बचने के लिए इन्हें सेट करें) |
| `title` | hover पर दिखने वाला सलाहकारी text |
| `id` | अद्वितीय पहचान: हर element के लिए एक, पूरे page में सिर्फ़ एक बार |
| `class` | एक या अधिक class नाम; कई elements एक ही class साझा कर सकते हैं |
| `style` | Inline CSS |
| `href` | Hyperlink reference (लक्ष्य URL) |

```html title="index.html" principle="Attributes — src, alt, width/height, title, id, class on one element"
<img
  src="image.jpg"
  alt="Description of the image"
  width="200"
  height="150"
  title="Title of the image"
  id="image1"
  class="img-fluid"
/>
```

**Anchor tags।** `<a href>` एक link बनाता है। `target="_blank"` नया tab खोलता है (बाहरी links के लिए `rel="noopener noreferrer"` जोड़ें)। उसी page के किसी `id` से link करने पर page वहाँ तक scroll हो जाता है।

```html title="index.html" principle="Anchors — external link in a new tab, and an internal jump link to an id"
<a href="https://www.example.com" target="_blank" rel="noopener noreferrer">Visit Example</a>

<a href="#myPara">Go to paragraph</a>

<p id="myPara">You scrolled here.</p>
```

**इंटरव्यू के जवाब:** *id बनाम class?* `id` अद्वितीय होता है और एक element, anchors व JS hooks के लिए इस्तेमाल होता है; `class` styling के लिए दोबारा इस्तेमाल की जा सकती है। *`alt` क्यों?* Accessibility और fallback के लिए। *`rel="noopener"` क्यों?* `_blank` से खुला page वरना `window.opener` तक पहुँच सकता है।

---

## 3. Lists और tables

**Lists:** `<ol>` क्रमबद्ध (numbered), `<ul>` अक्रमबद्ध (bullets), `<dl>` description list (`<dt>` शब्द, `<dd>` विवरण)। `ol`/`ul` का हर item एक `<li>` होता है।

```html title="index.html" principle="Three kinds of list — ordered, unordered, description"
<ol>
  <li>Write HTML</li>
  <li>Write CSS</li>
</ol>

<ul>
  <li>Chrome</li>
  <li>Firefox</li>
</ul>

<dl>
  <dt>HTML</dt>
  <dd>Structure of a page</dd>
  <dt>CSS</dt>
  <dd>Presentation of a page</dd>
</dl>
```

**Tables:** `<table>` → `<tr>` पंक्तियाँ → `<th>` header cells / `<td>` data cells। इन्हें `<thead>`, `<tbody>`, `<tfoot>` से समूहित करें, और `<caption>` से शीर्षक दें। `colspan` columns को मिलाता है, `rowspan` rows को।

```html title="index.html" principle="Accessible table — caption, thead/tbody/tfoot, scope on headers, colspan and rowspan"
<table border="1">
  <caption>Team scores</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Age</th>
      <th scope="col">Country</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Harry Depp</td>
      <td>28</td>
      <td>Britain</td>
    </tr>
    <tr>
      <td>John Smith</td>
      <td>35</td>
      <td>USA</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2">Total</td>
      <td>2</td>
    </tr>
  </tfoot>
</table>

<table border="1">
  <tr>
    <th colspan="4">DIVING</th>
  </tr>
  <tr>
    <td colspan="2">cols 1 and 2, row 2</td>
    <td colspan="2">cols 3 and 4, row 2</td>
  </tr>
  <tr>
    <td>col 1</td>
    <td>col 2</td>
    <td>col 3</td>
    <td>col 4</td>
  </tr>
</table>
```

**Homework सवाल (इंटरव्यू में पूछा जाता है):** *`<th>` पर `scope` attribute क्या करता है?* यह बताता है कि header किसी column (`col`) पर लागू होता है या row (`row`) पर, ताकि screen readers हर cell के लिए सही header बोल सकें।

---

## 4. Forms

Form user का input इकट्ठा करता है। `<form>` container है; इसके ज़रूरी attributes हैं `action` (data कहाँ भेजा जाए, आमतौर पर एक API URL), `method` (`GET` data को URL के साथ जोड़ता है और डेटा पाने के लिए है; `POST` उसे request body में भेजता है, बड़े या संवेदनशील data के लिए) और `name`।

मुख्य controls: `<input>` (कई `type`), `<option>` वाला `<select>`, `<textarea>` (कई पंक्तियाँ), `<button>`, और `<label>` (label पर click करने से उसके input पर focus जाता है — इन्हें `for`/`id` से जोड़ें)।

आम input types: `text`, `password`, `email`, `number`, `range`, `color`, `checkbox`, `radio`, `file`, `submit`, `reset`, `button`।

```html title="index.html" principle="Form — action and method, labelled controls, one control of every common type"
<form action="/api/register" method="post" name="signup">
  <label for="name">Text input:</label>
  <input type="text" id="name" name="name" required />

  <label for="pw">Password:</label>
  <input type="password" id="pw" name="password" minlength="8" />

  <label for="age">Number:</label>
  <input type="number" id="age" name="age" min="1" max="120" />

  <label for="email">Email:</label>
  <input type="email" id="email" name="email" />

  <label for="volume">Range:</label>
  <input type="range" id="volume" name="volume" min="0" max="10" />

  <label for="colour">Colour:</label>
  <input type="color" id="colour" name="colour" />

  <label><input type="checkbox" name="terms" /> Accept terms</label>

  <label><input type="radio" name="plan" value="free" /> Free</label>
  <label><input type="radio" name="plan" value="pro" /> Pro</label>

  <label for="country">Country:</label>
  <select id="country" name="country">
    <option value="in">India</option>
    <option value="uk">Britain</option>
  </select>

  <label for="msg">Message:</label>
  <textarea id="msg" name="message" rows="4"></textarea>

  <label for="file">File upload:</label>
  <input type="file" id="file" name="file" />

  <button type="submit">Submit</button>
  <button type="reset">Reset</button>
</form>
```

**इंटरव्यू के जवाब:** *GET बनाम POST?* GET: data URL में, cache हो सकता है, bookmark हो सकता है, पढ़ने के लिए। POST: data body में, URL में नहीं, लिखने (write) के लिए। *`<label for>` क्यों?* क्लिक करने का बड़ा क्षेत्र और accessibility। *Radio बनाम checkbox?* एक ही `name` वाले radios में सिर्फ़ एक चुना जा सकता है; checkboxes में कई।

---

## 5. CSS selectors

CSS syntax: `selector { property: value; }`। Selector elements को चुनता है; declarations उन्हें style करती हैं। CSS **presentation को content से अलग** रखती है।

| Selector | उदाहरण | क्या चुनता है |
| --- | --- | --- |
| Universal | `*` | हर element |
| Type | `p` | सभी `<p>` elements |
| ID | `#myID` | उस id वाला element |
| Class | `.myClass` | उस class वाले elements |
| Pseudo-class | `a:hover` | किसी state में मौजूद element (hover, focus, first-child…) |
| Child combinator | `div > p` | वे `p` जो `div` के सीधे children हैं |
| Adjacent sibling | `h2 + p` | `h2` के ठीक बाद आने वाला `p` |
| Attribute | `[type="text"]` | उस attribute value वाले elements |

```css title="styles.css" principle="Selector types — universal, type, id, class, pseudo-class, combinators, attribute"
/* Universal selector */
* {
  font-family: Arial, sans-serif;
}

/* Type selector */
p {
  color: red;
}

/* ID selector */
#myID {
  font-weight: bold;
}

/* Class selector */
.myClass {
  background-color: yellow;
  padding: 10px;
}

/* Pseudo-class */
a:hover {
  color: purple;
}

/* Child combinator */
div > p {
  font-style: italic;
}

/* Attribute selector */
[type="text"] {
  border: 1px solid blue;
  margin-bottom: 10px;
}

/* Adjacent sibling */
h2 + p {
  margin-top: 20px;
}

/* Direct children of a list */
ul > li {
  list-style-type: square;
}
```

```html title="index.html" principle="The markup that the selectors above act on"
<p>This is a paragraph.</p>
<p id="myID">This paragraph has an ID.</p>

<div class="myClass">
  <p>This paragraph has a class and is a child of a div.</p>
</div>

<a href="#">Hover over me</a>

<input type="text" placeholder="Text input" />

<h2>Heading 2</h2>
<p>This paragraph follows an h2.</p>

<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
```

**Specificity (पसंदीदा सवाल)।** कमज़ोर से मज़बूत की ओर: type < class/attribute/pseudo-class < id < inline style < `!important`। बराबर होने पर **बाद वाला rule जीतता है**। `!important` से बचें; लंबी chains से बचें; classes को प्राथमिकता दें।

**Files को जोड़ना।** Rules को `styles.css` में रखें और `<head>` में `<link rel="stylesheet" href="styles.css" />` से load करें।

---

## 6. Text और font properties

| Property | क्या करती है |
| --- | --- |
| `color` | Text का रंग (नाम, hex, `rgb()`, `rgba()`, `hsl()`) |
| `text-align` | `left`, `right`, `center`, `justify` |
| `text-decoration` | `underline`, `overline`, `line-through` (साथ में colour/style/line की sub-properties) |
| `text-transform` | `uppercase`, `lowercase`, `capitalize`, `none` |
| `line-height` | एक पंक्ति की ऊँचाई (बिना unit के सबसे अच्छा) |
| `text-shadow` | Offset-x, offset-y, blur, colour |
| `text-indent` | पहली पंक्ति का indent |
| `text-overflow` | बाहर निकलता text कैसे दिखे (`ellipsis`, `clip`) |
| `letter-spacing`, `word-spacing` | अक्षरों / शब्दों के बीच की जगह |
| `font-family` | Fonts की क्रमबद्ध सूची, जो एक generic family पर खत्म होती है |
| `font-size` | `px`, `em`, `rem`, `%` |
| `font-weight` | `normal`, `bold`, या 100–900 |
| `font-style` | `normal`, `italic`, `oblique` |
| `font-variant`, `font-stretch` | Small-caps; संकरे/चौड़े अक्षर |

```css title="styles.css" principle="Text and font properties on body, h1, p and a highlight class"
body {
  font-family: Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #333;
}

h1 {
  text-align: center;
  text-transform: uppercase;
  font-weight: bold;
  font-size: 2em;
  color: #009688;
  text-decoration: underline;
  letter-spacing: 2px;
  margin-bottom: 20px;
}

p {
  text-align: justify;
  text-indent: 20px;
  text-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3);
  margin-bottom: 20px;
}

.highlight {
  background-color: yellow;
  font-weight: bold;
  font-style: italic;
}
```

```html title="index.html" principle="Using the .highlight class on inline spans"
<h1>Text Properties Example</h1>

<p>
  Reading is faster when <span class="highlight">line height</span> and
  <span class="highlight">font size</span> are chosen with care.
</p>
```

**टिप्स:** `font-family` में एक fallback ज़रूर रखें (जैसे `"Inter", Arial, sans-serif`); sizes के लिए `rem` को प्राथमिकता दें ताकि वे user की browser settings का पालन करें; `line-height` बिना unit के इस्तेमाल करें।

---

## 7. Background properties

| Property | Values |
| --- | --- |
| `background-color` | नामित रंग, RGB, HSL, hex |
| `background-image` | `url('…')` |
| `background-size` | लंबाई, प्रतिशत, `contain` (अंदर फिट करे), `cover` (भर दे, कट सकती है) |
| `background-position` | लंबाई, प्रतिशत, `top bottom left right center` |
| `background-repeat` | `repeat` (default), `repeat-x`, `repeat-y`, `no-repeat` |

```css title="styles.css" principle="All five background properties on one element"
.background-example {
  width: 300px;
  height: 200px;
  background-color: lightblue; /* colour shown if the image is missing */
  background-image: url("example.jpg");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
```

**इंटरव्यू का जवाब:** *`cover` बनाम `contain`?* `cover` तब तक scale करता है जब तक पूरा box भर न जाए (image कट सकती है); `contain` तब तक scale करता है जब तक पूरी image दिखने न लगे (खाली जगह बच सकती है)।

---

## 8. Box model

हर element एक आयताकार box होता है जिसकी चार परतें होती हैं, अंदर से बाहर: **content → padding → border → margin।**

- **Width/height** content क्षेत्र का आकार तय करते हैं; निरपेक्ष units (`px`, `cm`) या सापेक्ष units (parent का `%`, viewport के `vw`/`vh`) इस्तेमाल करें।
- **`box-sizing`** तय करता है कि width का मतलब क्या है: `content-box` (default) padding और border को ऊपर से जोड़ता है; `border-box` उन्हें width के अंदर ही गिनता है। ज़्यादातर projects में `border-box` को globally सेट किया जाता है।

```css title="styles.css" principle="Box model — border-box sizing makes width include padding and border"
*,
*::before,
*::after {
  box-sizing: border-box;
}

.card {
  width: 300px;      /* total width, because of border-box */
  padding: 16px;     /* inside the border */
  border: 2px solid #333;
  margin: 24px auto; /* outside; auto centres horizontally */
}
```

### Margin

Element के **चारों ओर** की जगह; यह element का अपना आकार नहीं बदलता। Default 0। Units: `px`, `cm`, `mm`, `%`; `auto` किसी block को क्षैतिज रूप से बीच में रखता है।

| Values | मतलब | उदाहरण |
| --- | --- | --- |
| एक | चारों तरफ़ | `margin: 20px;` |
| दो | ऊपर-नीचे, बाएँ-दाएँ | `margin: 20px 30px;` |
| तीन | ऊपर, बाएँ-दाएँ, नीचे | `margin: 20px 30px 40px;` |
| चार | ऊपर, दाएँ, नीचे, बाएँ (घड़ी की दिशा में) | `margin: 20px 30px 40px 50px;` |

**Margin collapsing:** जब दो पास-पास के block elements के vertical margins आपस में छूते हैं, तो सिर्फ़ बड़ा वाला बचता है।

```css title="styles.css" principle="Margin collapsing — the gap between these two blocks is 40px, not 60px"
.first  { margin-bottom: 40px; }
.second { margin-top: 20px; }
```

### Border

तीन हिस्से जो साथ चलते हैं: **width**, **style** (`solid`, `dotted`, `dashed`, `double`, `groove`, `ridge`, `inset`, `outset`, `none`) और **colour**; साथ में गोल कोनों के लिए `border-radius`। Shorthand है `border: width style colour`। Style के बिना कोई border नहीं दिखता।

```css title="styles.css" principle="Border shorthand, removing a border, and a circle with border-radius"
.box {
  border: 10px solid red;
}

.box-none {
  border-style: none;
}

#EG8 {
  width: 120px;
  height: 120px;
  border: 4px solid red;
  border-radius: 50%; /* a square becomes a circle */
}
```

---

## 9. Positioning

`position` property तय करती है कि element कैसे रखा जाए।

| Value | व्यवहार |
| --- | --- |
| `static` | Default; सामान्य document flow; `top/left/right/bottom` का कोई असर नहीं |
| `relative` | Flow में ही रहता है लेकिन `top/left/right/bottom` से अपनी **सामान्य स्थिति** से खिसकाया जा सकता है; absolute children के लिए संदर्भ भी बन जाता है |
| `absolute` | Flow से हट जाता है; **सबसे नज़दीकी positioned ancestor** के सापेक्ष रखा जाता है (कोई न हो तो page के सापेक्ष) |
| `fixed` | **Viewport** के सापेक्ष रखा जाता है; scroll करने पर हिलता नहीं (chat button, cookie bar) |
| `sticky` | किसी scroll सीमा तक `relative` की तरह चलता है, फिर `fixed` की तरह (sticky headers) |

```css title="styles.css" principle="Position — a sticky header, a fixed corner button, and an absolute badge inside a relative card"
.sticky-header {
  position: sticky;
  top: 0;            /* sticks when it reaches the top of the viewport */
  background: white;
}

.chat-button {
  position: fixed;   /* stays in the corner while scrolling */
  right: 16px;
  bottom: 16px;
}

.card {
  position: relative;  /* reference box for the badge */
}

.card .badge {
  position: absolute;
  top: 0;
  right: 0;            /* top-right corner of .card */
}
```

**इंटरव्यू के जवाब**
- *`relative` बनाम `absolute`?* Relative flow में अपनी जगह बनाए रखता है और खुद से खिसकता है; absolute flow से बाहर निकल जाता है और सबसे नज़दीकी positioned ancestor से खिसकता है।
- *`fixed` बनाम `sticky`?* Fixed हमेशा viewport के सापेक्ष होता है; sticky सीमा तक flow में रहता है, फिर अपने container के अंदर चिपक जाता है।
- *मेरा `absolute` element page के कोने में क्यों कूद जाता है?* उसके किसी भी ancestor को position नहीं दी गई है; इच्छित parent को `position: relative` दें।
- *Sticky header, fixed sidebar और modal बनाना* आम practical काम हैं: ये क्रमशः `sticky`, `fixed` और `fixed` + एक backdrop इस्तेमाल करते हैं।

---

## 10. Self-check

1. पाँच semantic elements के नाम बताएँ और हर एक किस चीज़ की जगह लेता है।
2. `id` और `class` में क्या अंतर है, और specificity में कौन जीतता है?
3. Table header पर `scope` क्या करता है?
4. `label for` क्यों इस्तेमाल करें? `method="post"` क्या बदलता है?
5. "वे paragraphs जो सीधे `h2` के बाद आते हैं" के लिए एक selector लिखें।
6. `box-sizing: border-box`, `width` के बारे में क्या बदलता है?
7. दो blocks: नीचे का margin 40px और ऊपर का margin 20px। gap कितना होगा, और क्यों?
8. ऐसे header के लिए, जो scroll करते समय दिखता रहे लेकिन सिर्फ़ तब जब आप उसे पार कर लें, कौन-सा `position` value इस्तेमाल करेंगे?

## References

- MDN Web Docs — HTML elements: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
- MDN Web Docs — CSS: https://developer.mozilla.org/en-US/docs/Web/CSS
- MDN — Box model: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model
- MDN — Mastering margin collapsing: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model/Mastering_margin_collapsing
- MDN — position: https://developer.mozilla.org/en-US/docs/Web/CSS/position
- MDN — Table accessibility (`scope`): https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Table_accessibility
- W3C — HTML specification (semantic elements): https://html.spec.whatwg.org/multipage/semantics.html
- W3Schools — HTML and CSS tutorials: https://www.w3schools.com/
