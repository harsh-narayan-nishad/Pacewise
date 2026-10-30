# 13 · HTML & CSS

Interview preparation notes on HTML and CSS fundamentals: semantic HTML, attributes, links, lists and tables, forms, CSS selectors, text/font/background properties, the box model, and positioning. Every example is a complete, runnable snippet; the caption on each shows the file it belongs in (`index.html` or `styles.css`). Written in our own words; practice by retyping each example and changing it.

**How to use:** cover the answer, say it aloud, then compare. For every topic also be ready with a **common mistake** and **how to test it in the browser**.

---

## 1. Semantic HTML

A **semantic element** tells both the browser and the developer what its content *is*. `<div>` and `<span>` say nothing; `<article>`, `<nav>`, `<header>` do.

| Element | Meaning |
| --- | --- |
| `<header>` | Introductory content or navigation links (may appear several times, not inside another header/footer/address) |
| `<nav>` | A major block of navigation links (not every link belongs in one) |
| `<main>` | The main content of the document (one per page) |
| `<section>` | A thematic grouping of content, normally with a heading |
| `<article>` | Independent, self-contained content that makes sense on its own (blog post, forum post, product card) |
| `<aside>` | Content only indirectly related to its surroundings (sidebar) |
| `<figure>` / `<figcaption>` | Self-contained illustration, diagram or code listing with its caption |
| `<footer>` | Authorship, copyright, contact, related links |
| `<details>` / `<summary>` | Content the user can show or hide, and its visible heading |
| `<mark>` / `<time>` | Highlighted text / a date or time |

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

**Semantic vs non-semantic.** Semantic elements have meaning, describe what their content is, and carry built-in behaviour for browsers, search engines and screen readers. Non-semantic elements (`div`, `span`) have no meaning and are styled by `class`/`id`.

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

**Is `<article>` inside `<section>`, or the reverse?** Both occur. The definitions (independent content vs thematic grouping) do not dictate nesting; choose what describes your content.

**Interview answers**
- *Why semantic HTML?* Accessibility (screen readers can skip to `<main>` or `<nav>`), SEO, maintainability, and sensible defaults.
- *`section` vs `div`?* Use `section` when the content is a thematic group with a heading; use `div` purely for styling/layout hooks.
- *Common mistake:* putting every link inside `<nav>`; it is for major navigation blocks only.

---

## 2. Attributes

Attributes give extra information to an element and always go in the **opening tag**.

| Attribute | Purpose |
| --- | --- |
| `src` | Source of media (image, video, audio); required for `<img>` |
| `alt` | Alternative text if the image does not load; used by screen readers |
| `width`, `height` | Dimensions (set them to avoid layout shift) |
| `title` | Advisory text shown on hover |
| `id` | Unique identifier: one per element, once per page |
| `class` | One or more class names; many elements can share one |
| `style` | Inline CSS |
| `href` | Hyperlink reference (target URL) |

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

**Anchor tags.** `<a href>` creates a link. `target="_blank"` opens a new tab (add `rel="noopener noreferrer"` for external links). Linking to an `id` on the same page scrolls to it.

```html title="index.html" principle="Anchors — external link in a new tab, and an internal jump link to an id"
<a href="https://www.example.com" target="_blank" rel="noopener noreferrer">Visit Example</a>

<a href="#myPara">Go to paragraph</a>

<p id="myPara">You scrolled here.</p>
```

**Interview answers:** *id vs class?* `id` is unique and used for one element, anchors and JS hooks; `class` is reusable for styling. *Why `alt`?* Accessibility and fallback. *Why `rel="noopener"`?* A page opened with `_blank` could otherwise access `window.opener`.

---

## 3. Lists and tables

**Lists:** `<ol>` ordered (numbered), `<ul>` unordered (bullets), `<dl>` description list (`<dt>` term, `<dd>` description). Each item of `ol`/`ul` is an `<li>`.

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

**Tables:** `<table>` → `<tr>` rows → `<th>` header cells / `<td>` data cells. Group with `<thead>`, `<tbody>`, `<tfoot>`, and title it with `<caption>`. `colspan` merges columns, `rowspan` merges rows.

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

**Homework question (asked in interviews):** *What does the `scope` attribute do on `<th>`?* It states whether a header applies to a column (`col`) or a row (`row`), so screen readers can announce the right header for each cell.

---

## 4. Forms

A form collects user input. `<form>` is the container; its important attributes are `action` (where the data is sent, usually an API URL), `method` (`GET` appends data to the URL and is for retrieving; `POST` sends it in the request body, for large or sensitive data) and `name`.

Main controls: `<input>` (many `type`s), `<select>` with `<option>`, `<textarea>` (multi-line), `<button>`, and `<label>` (clicking the label focuses its input — link them with `for`/`id`).

Common input types: `text`, `password`, `email`, `number`, `range`, `color`, `checkbox`, `radio`, `file`, `submit`, `reset`, `button`.

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

**Interview answers:** *GET vs POST?* GET: data in the URL, cacheable, bookmarkable, for reads. POST: data in the body, not in the URL, for writes. *Why `<label for>`?* Larger click target and accessibility. *Radio vs checkbox?* Radios with the same `name` allow one choice; checkboxes allow many.

---

## 5. CSS selectors

CSS syntax: `selector { property: value; }`. The selector chooses elements; the declarations style them. CSS keeps **presentation separate from content**.

| Selector | Example | Selects |
| --- | --- | --- |
| Universal | `*` | Every element |
| Type | `p` | All `<p>` elements |
| ID | `#myID` | The element with that id |
| Class | `.myClass` | Elements with that class |
| Pseudo-class | `a:hover` | An element in a state (hover, focus, first-child…) |
| Child combinator | `div > p` | `p` that are direct children of `div` |
| Adjacent sibling | `h2 + p` | A `p` immediately after an `h2` |
| Attribute | `[type="text"]` | Elements with that attribute value |

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

**Specificity (a favourite question).** From weakest to strongest: type < class/attribute/pseudo-class < id < inline style < `!important`. When equal, the **later rule wins**. Avoid `!important`; avoid long chains; prefer classes.

**Linking the files.** Put the rules in `styles.css` and load them with `<link rel="stylesheet" href="styles.css" />` in the `<head>`.

---

## 6. Text and font properties

| Property | What it does |
| --- | --- |
| `color` | Text colour (names, hex, `rgb()`, `rgba()`, `hsl()`) |
| `text-align` | `left`, `right`, `center`, `justify` |
| `text-decoration` | `underline`, `overline`, `line-through` (plus colour/style/line sub-properties) |
| `text-transform` | `uppercase`, `lowercase`, `capitalize`, `none` |
| `line-height` | Height of a line (unitless is best) |
| `text-shadow` | Offset-x, offset-y, blur, colour |
| `text-indent` | Indent of the first line |
| `text-overflow` | How overflowing text is shown (`ellipsis`, `clip`) |
| `letter-spacing`, `word-spacing` | Space between letters / words |
| `font-family` | Ordered list of fonts, ending with a generic family |
| `font-size` | `px`, `em`, `rem`, `%` |
| `font-weight` | `normal`, `bold`, or 100–900 |
| `font-style` | `normal`, `italic`, `oblique` |
| `font-variant`, `font-stretch` | Small-caps; condensed/expanded letters |

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

**Tips:** list a fallback in `font-family` (for example `"Inter", Arial, sans-serif`); prefer `rem` for sizes so they follow the user's browser settings; use a unitless `line-height`.

---

## 7. Background properties

| Property | Values |
| --- | --- |
| `background-color` | Named colour, RGB, HSL, hex |
| `background-image` | `url('…')` |
| `background-size` | Lengths, percentages, `contain` (fit inside), `cover` (fill, may crop) |
| `background-position` | Lengths, percentages, `top bottom left right center` |
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

**Interview answer:** *`cover` vs `contain`?* `cover` scales until the whole box is filled (may crop); `contain` scales until the whole image is visible (may leave gaps).

---

## 8. The box model

Every element is a rectangular box with four layers, from inside out: **content → padding → border → margin.**

- **Width/height** size the content area; use absolute units (`px`, `cm`) or relative ones (`%` of the parent, `vw`/`vh` of the viewport).
- **`box-sizing`** decides what width means: `content-box` (default) adds padding and border on top; `border-box` includes them in the width. Most projects set `border-box` globally.

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

Space **around** an element; it does not change the element's own size. Default 0. Units: `px`, `cm`, `mm`, `%`; `auto` centres a block horizontally.

| Values | Meaning | Example |
| --- | --- | --- |
| one | all four sides | `margin: 20px;` |
| two | top and bottom, left and right | `margin: 20px 30px;` |
| three | top, left and right, bottom | `margin: 20px 30px 40px;` |
| four | top, right, bottom, left (clockwise) | `margin: 20px 30px 40px 50px;` |

**Margin collapsing:** when the vertical margins of two adjacent block elements touch, only the larger one remains.

```css title="styles.css" principle="Margin collapsing — the gap between these two blocks is 40px, not 60px"
.first  { margin-bottom: 40px; }
.second { margin-top: 20px; }
```

### Border

Three parts that go together: **width**, **style** (`solid`, `dotted`, `dashed`, `double`, `groove`, `ridge`, `inset`, `outset`, `none`) and **colour**; plus `border-radius` for rounded corners. The shorthand is `border: width style colour`. Without a style, no border shows.

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

The `position` property decides how an element is placed.

| Value | Behaviour |
| --- | --- |
| `static` | Default; normal document flow; `top/left/right/bottom` have no effect |
| `relative` | Stays in flow but can be offset from its **own normal position** with `top/left/right/bottom`; also becomes the reference for absolute children |
| `absolute` | Removed from the flow; placed relative to the **nearest positioned ancestor** (or the page if there is none) |
| `fixed` | Placed relative to the **viewport**; does not move when you scroll (chat button, cookie bar) |
| `sticky` | Behaves like `relative` until a scroll threshold, then like `fixed` (sticky headers) |

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

**Interview answers**
- *`relative` vs `absolute`?* Relative keeps its space in the flow and offsets from itself; absolute leaves the flow and offsets from the nearest positioned ancestor.
- *`fixed` vs `sticky`?* Fixed is always relative to the viewport; sticky is in the flow until the threshold, then sticks within its container.
- *Why does my `absolute` element jump to the page corner?* None of its ancestors is positioned; give the intended parent `position: relative`.
- *Create a sticky header, a fixed sidebar and a modal* are common practical tasks: they use `sticky`, `fixed` and `fixed` + a backdrop respectively.

---

## 10. Self-check

1. Name five semantic elements and one thing each replaces.
2. What is the difference between `id` and `class`, and which wins in specificity?
3. What does `scope` do on a table header?
4. Why use `label for`? What does `method="post"` change?
5. Write a selector for "paragraphs that directly follow an `h2`".
6. What does `box-sizing: border-box` change about `width`?
7. Two blocks: bottom margin 40px and top margin 20px. How big is the gap, and why?
8. Which `position` value would you use for a header that stays visible while scrolling, but only after you pass it?

## References

- MDN Web Docs — HTML elements: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
- MDN Web Docs — CSS: https://developer.mozilla.org/en-US/docs/Web/CSS
- MDN — Box model: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model
- MDN — Mastering margin collapsing: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model/Mastering_margin_collapsing
- MDN — position: https://developer.mozilla.org/en-US/docs/Web/CSS/position
- MDN — Table accessibility (`scope`): https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Table_accessibility
- W3C — HTML specification (semantic elements): https://html.spec.whatwg.org/multipage/semantics.html
- W3Schools — HTML and CSS tutorials: https://www.w3schools.com/
