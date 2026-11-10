# यूनिट II: Advanced Data Structures

## 2.1 Advanced structures क्यों

- एक साधारण binary search tree (BST) की worst case में height Θ(n) होती है (sorted keys insert करने पर), इसलिए search O(n) हो जाता है। **Balanced** trees (Red-Black, AVL, B-trees) local repairs (rotations, splits) से height को O(log n) रखते हैं।
- Binary heap में insert और extract-min O(log n) में होते हैं, लेकिन **दो heaps को merge करने** में O(n) लगता है। **Mergeable heaps** (binomial, Fibonacci) O(log n) या O(1) में merge होते हैं, और Fibonacci heaps *decrease-key* को O(1) amortized बना देते हैं, जिससे Dijkstra और Prim तेज़ होते हैं।
- B-trees **disks** के लिए बने हैं: एक node = एक disk block, इसलिए बहुत चौड़ा tree (सैकड़ों children) disk reads की संख्या बहुत कम रखता है।

## 2.2 Red-Black trees

> **Red-Black tree:**
>
> 1. हर node या तो red होता है या black।
> 2. Root black होता है।
> 3. हर leaf (NIL sentinel) black होता है।
> 4. अगर कोई node red है, तो उसके दोनों children black होते हैं (लगातार दो red नहीं)।
> 5. हर node के लिए, उससे नीचे descendant leaves तक के सभी simple paths में black nodes की संख्या बराबर होती है (*black-height* bh(x))।

- **Height bound:** x पर rooted subtree में कम से कम 2^bh(x) - 1 internal nodes होते हैं (induction से)। Property 4 से bh(root) ≥ h/2, इसलिए n ≥ 2^(h/2) - 1 और **h ≤ 2 log₂(n + 1)**। Search, minimum, maximum, successor, insert और delete सब O(log n) हैं।
- **Rotation:** एक local O(1) restructuring जो BST का क्रम बनाए रखती है। x पर left rotation उसके right child y को subtree का नया root बना देती है, x, y का left child बन जाता है, और y का पुराना left subtree x का right subtree बन जाता है। Right rotation इसकी mirror image है।

```text
      x                 y
     / \    left        / \
    a   y   ======>    x   c
       / \   rotation  / \
      b   c           a   b
```

### Insertion

सामान्य BST की तरह insert करो, नए node को **red** रंगो (ताकि property 5 न टूटे), फिर node z, उसके parent p, grandparent g और *uncle* u की मदद से संभावित red-red violation ठीक करो:

| Case | शर्त | Fix |
|---|---|---|
| 1 | Uncle red है | Parent और uncle को black, grandparent को red करो; z को g तक ऊपर ले जाओ और दोहराओ |
| 2 | Uncle black है, z एक "inner" child है (zig-zag) | Parent पर rotate करो ताकि यह case 3 बन जाए |
| 3 | Uncle black है, z एक "outer" child है (zig-zig) | Parent को black और grandparent को red करो, grandparent पर rotate करो; पूरा |

हर insert में अधिकतम 2 rotations; recolouring loop O(log n) बार चलता है। अंत में root को black रंग दिया जाता है।

### Deletion

BST की तरह delete करो (दो children वाले node को उसके successor से बदलो)। अगर physically हटाया गया node **black** था, तो x (जो node उसकी जगह आया) पर एक "double black" बन जाता है जिसे ठीक करना पड़ता है; x का sibling w case तय करता है:

| Case | शर्त | Fix |
|---|---|---|
| 1 | Sibling w red है | w को black और parent को red करो, parent पर rotate करो: अब w black है (2, 3 या 4 पर जाओ) |
| 2 | w black, w के दोनों children black | w को red करो, extra black को parent तक ऊपर ले जाओ |
| 3 | w black, near child red, far child black | w पर recolour और rotate करके case 4 बनाओ |
| 4 | w black, far child red | w parent का colour ले लेता है, parent और far child black, parent पर rotate करो; पूरा |

हर delete में अधिकतम 3 rotations। **AVL trees** से तुलना: AVL ज़्यादा सख़्ती से balanced होता है (height ≤ 1.44 log n), इसलिए lookups थोड़े तेज़ हैं, लेकिन Red-Black insert/delete में कम rotations करता है; इसी वजह से `std::map`/`std::set` और Java का `TreeMap` Red-Black trees पर बने हैं।

::include cpp/u2-rb-1.cpp

::include cpp/u2-rb-1.out.txt

## 2.3 B-trees

> **Minimum degree t ≥ 2 वाला B-tree:**
>
> - हर node अपनी keys sorted क्रम में रखता है; k keys वाले node (internal nodes) के k+1 children होते हैं;
> - root को छोड़कर हर node में कम से कम **t-1** और अधिकतम **2t-1** keys होती हैं (यानी t से 2t children); root में कम से कम 1 key होती है (अगर tree खाली नहीं है);
> - सभी leaves एक ही depth पर होते हैं।

- **Height:** n ≥ 1 + (t-1)·Σ 2·t^(i-1) = 2t^h - 1, इसलिए **h ≤ log_t((n+1)/2)**। t = 500 के साथ एक अरब keys वाले tree की height अधिकतम 4 होती है, यानी अधिकतम लगभग 4 disk reads।
- **Search:** हर node में key के लिए binary/linear search करो, सही child में नीचे जाओ: O(t·log_t n) time और O(log_t n) disk accesses।
- **Insert (एक ही downward pass):** नीचे चलो; जब भी कोई *full* node (2t-1 keys) मिले, उसे उसकी median key के चारों ओर **split** करो (median ऊपर parent में चली जाती है, दोनों halves t-1 keys वाले दो nodes बन जाते हैं)। फिर ऐसे leaf में insert करो जिसमें जगह होना गारंटीशुदा है। अगर root full है, तो tree की height एक बढ़ जाती है (height बढ़ने का यही एकमात्र तरीक़ा है)।
- **Delete (यह भी एक ही downward pass, और कभी ऐसे node में नहीं जाते जिसमें सिर्फ़ t-1 keys हों, जब तक पहले उसे ठीक न कर लें):**
    1. Key leaf में है: उसे हटा दो।
    2. Key internal node में है: उसे उसके predecessor (अगर left child में ≥ t keys हों) या successor (अगर right child में ≥ t keys हों) से बदलो और उसे recursively delete करो; अगर दोनों children में ठीक t-1 keys हों, तो उन्हें key के साथ **merge** करो और merged node से delete करो।
    3. Key इस node में नहीं है: सिर्फ़ t-1 keys वाले child c में उतरने से पहले उसे बड़ा करो: ≥ t keys वाले sibling से एक key **borrow** करो (parent के through rotate करके) या sibling के साथ **merge** करो। अगर root खाली हो जाए, तो height एक घट जाती है।
- **B+ tree** (databases और file systems में इस्तेमाल होता है): सारे records leaves में रहते हैं, internal nodes में सिर्फ़ routing keys होती हैं, leaves एक list में linked होते हैं ताकि range queries sequential हों। **B∗-tree** nodes को कम से कम 2/3 भरा रखता है।
- सभी operations O(log n) हैं; 2-3-4 trees, t = 2 वाले B-trees हैं और Red-Black trees के equivalent हैं।

::include cpp/u2-b-1.cpp

::include cpp/u2-b-1.out.txt

## 2.4 Binomial heaps

> **Binomial tree B<sub>k</sub>:** B<sub>0</sub> एक single node है; B<sub>k</sub>, B<sub>k-1</sub> की दो copies को link करके बनता है (एक दूसरे के root का सबसे बायाँ child बन जाता है)। गुण: 2^k nodes; height k; root की degree k; depth i पर ठीक C(k, i) nodes (इसीलिए यह नाम); root के children, B<sub>k-1</sub>, B<sub>k-2</sub>, ..., B<sub>0</sub> के roots होते हैं।<br /> **Binomial heap:** binomial trees का एक collection, जिनमें से हर एक min-heap property (parent ≤ children) मानता है, और हर degree का अधिकतम *एक* tree होता है। Roots एक linked list में बढ़ती degree के क्रम में रखे जाते हैं।

- n nodes वाले heap में tree B<sub>i</sub> ठीक तब होता है जब n के binary representation का bit i 1 हो, इसलिए उसमें अधिकतम ⌊log₂ n⌋ + 1 trees होते हैं। n = 13 = 1101₂ के लिए heap में B₀, B₂, B₃ होते हैं।
- **Union (मुख्य operation):** दोनों root lists को degree के हिसाब से merge करो (sorted lists के merge की तरह), फिर उस पर चलो: जब दो trees की degree बराबर हो, उन्हें link करो (छोटे root वाला parent बनता है)। यह ठीक **carries के साथ binary addition** है: O(log n)।
- **Insert:** एक-node वाले heap के साथ union: worst case में O(log n), amortized O(1)।
- **Find-min:** root list scan करो: O(log n)।
- **Extract-min:** minimum root हटाओ; उसके children, उलटे क्रम में, एक binomial heap बनाते हैं; उसे बाक़ी के साथ union करो: O(log n)।
- **Decrease-key:** key बदलो और जब तक वह अपने parent से छोटी हो, उसे ऊपर bubble करो: O(log n)। **Delete:** key को -∞ तक decrease करो और extract-min करो: O(log n)।

::include cpp/u2-binom-1.cpp

::include cpp/u2-binom-1.out.txt

## 2.5 Fibonacci heaps

- **Structure:** min-heap-ordered trees का एक collection जिनके roots एक circular doubly linked list में हैं, और सबसे छोटे root की ओर एक pointer `min` है। हर node key, degree, parent, एक child pointer (children भी एक circular doubly linked list बनाते हैं) और एक **mark** bit रखता है (क्या इस node ने, जब से यह किसी दूसरे node का child बना, तब से कोई child खोया है?)। Operations *lazy* हैं: काम extract-min तक टाल दिया जाता है।
- **Insert:** root list में एक नया single-node tree जोड़ो, min update करो: O(1)। **Union:** root lists को concatenate करो: O(1)। **Find-min:** O(1)।
- **Extract-min:** min root हटाओ, उसके children को root list में जोड़ो, फिर **consolidate** करो: बराबर degree वाले roots को link करो (degree से indexed array इस्तेमाल करके) जब तक सभी roots की degrees अलग-अलग न हो जाएँ; min pointer दोबारा बनाओ। Amortized O(log n)।
- **Decrease-key:** key घटाओ; अगर parent के साथ heap order टूटता है, तो node को **cut** करके root list में डाल दो। अगर parent पहले से marked था, तो उसे भी cut करो (**cascading cut**), वरना उसे mark करो। O(1) amortized: cascade की cost potential से चुकाई जाती है।
- **Delete:** decrease-key को -∞ तक, फिर extract-min: O(log n) amortized।
- **Potential function:** Φ = t(H) + 2·m(H) (roots की संख्या + 2 × marked nodes)। Consolidation roots की संख्या घटाता है, जो अपनी cost खुद चुका देता है; cascading cut nodes को un-mark करता है, हर cut की actual cost O(1) है लेकिन Φ घटाता है।
- **Degree bound log n क्यों:** cuts का नियम (एक node अपने cut होने से पहले अधिकतम एक child खोता है) गारंटी देता है कि degree k वाले node के subtree का size कम से कम F<sub>k+2</sub> ≥ φ^k होता है (φ = 1.618, golden ratio, Fibonacci numbers; इसी से नाम पड़ा)। इसलिए maximum degree D(n) ≤ log_φ n = O(log n) है।
- **Application:** Fibonacci heap के साथ Dijkstra और Prim O(E + V log V) में चलते हैं (E decrease-keys O(1) पर और V extract-mins O(log V) पर), O(E log V) के बजाय। Constants बड़े हैं, इसलिए व्यवहार में binary heaps अक्सर जीतते हैं।

::include cpp/u2-fib-1.cpp

::include cpp/u2-fib-1.out.txt

## 2.6 Heaps की तुलना

| Operation | Binary heap (worst) | Binomial heap (worst) | Fibonacci heap (amortized) |
|---|---|---|---|
| Make-heap | Θ(1) | Θ(1) | Θ(1) |
| Insert | Θ(log n) | Θ(log n) | Θ(1) |
| Find-min | Θ(1) | Θ(log n) (min pointer के साथ O(1)) | Θ(1) |
| Extract-min | Θ(log n) | Θ(log n) | O(log n) |
| Union (meld) | Θ(n) | Θ(log n) | Θ(1) |
| Decrease-key | Θ(log n) | Θ(log n) | Θ(1) |
| Delete | Θ(log n) | Θ(log n) | O(log n) |

| Structure | Balance का नियम | Height | सबसे अच्छा किसके लिए |
|---|---|---|---|
| AVL tree | Siblings की heights में अंतर ≤ 1 | ≤ 1.44 log₂ n | Lookup-heavy in-memory dictionaries |
| Red-Black tree | Colour के नियम (5 properties) | ≤ 2 log₂(n+1) | सामान्य dictionaries (`std::map`), कम rotations |
| B-tree | Node का भराव t-1 से 2t-1 keys के बीच, leaves बराबर depth पर | ≤ log_t((n+1)/2) | Databases, file systems (disk blocks) |

> **Exam tip:** इनके लिए तैयार रहो: (1) keys का एक sequence Red-Black tree और B-tree में insert करना और हर step के बाद result बनाना, इस्तेमाल हुए case का नाम बताते हुए; (2) B-tree से एक key delete करना, borrow और merge दिखाते हुए; (3) n keys के लिए binomial heap बनाना (binary addition की तरह link करके); (4) Fibonacci heap का potential function और amortized costs बताना।
