/* === src/utils/core.js === */
/* ==========================================================================
   BasaWisyo Core Application Logic
   ========================================================================== */

const LG = "assets/images/wisyo.png";
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Reading difficulty tiers
const DIFF_KEYS = ["easy", "medium", "hard", "extreme"];
const DIFF_NAMES = {
  easy: "Easy (Madali)",
  medium: "Medium (Katamtaman)",
  hard: "Hard (Mahirap)",
  extreme: "Extreme (Sukdulan)"
};

// DepEd Phil-IRI standard levels
const PHIL_IRI_LEVELS = ["Frustration", "Instructional", "Independent", "Mastery"];



/* === src/data/dictionary.js === */
/* ==========================================================================
   Comprehensive Trilingual Vocabulary Dictionary (D)
   Filipino | Bisaya (Cebuano) | English definition + Part of Speech
   ========================================================================== */
const D = {
  // Foundational & Community (Easy)
  net: ["lambat", "pukot", "A mesh used for catching fish in coastal communities.", "noun"],
  harvest: ["ani", "ani", "Gathering ripe crops such as rice, corn, or vegetables.", "verb / noun"],
  carabao: ["kalabaw", "kabaw", "The Philippine domestic water buffalo, partner of farmers.", "noun"],
  paddies: ["palayan", "kahumayan", "Flooded parcels of arable land used for growing rice.", "noun"],
  wallowing: ["paglulublob", "pagpaligid sa lapok", "Rolling about in mud or water to stay cool.", "verb"],
  sampaguita: ["sampaguita", "sampagita", "The national flower of the Philippines, known for sweet fragrance.", "noun"],
  garlands: ["kuwintas ng bulaklak", "kulintas nga bulaklak", "Wreaths of flowers strung together for honor or faith.", "noun"],
  inspection: ["pagsisiyasat", "pagsusi", "Careful examination or scrutiny by agricultural quarantine officers.", "noun"],
  quarantine: ["kuwarantenas", "kwarantina", "Strict isolation to prevent the spread of agricultural pests.", "noun"],
  prohibits: ["nagbabawal", "nagadili", "Officially forbids someone from bringing unauthorized items.", "verb"],
  banig: ["banig", "banig", "Handwoven traditional Philippine sleeping or sitting mat made from reeds.", "noun"],
  reeds: ["tambo o tikog", "tikog", "Tall slender aquatic grasses dried and dyed for weaving.", "noun"],
  monsoonal: ["hanging habagat", "habagat", "Seasonal wind system bringing torrential rains and tropical moisture.", "adjective"],
  champorado: ["tsamporado", "tsamporado", "Traditional sweet chocolate rice porridge eaten with salted fish.", "noun"],

  // Ecology, Science & Contemporary (Medium)
  biodiversity: ["biyodibersidad", "kadaiyahan sa kinabuhi", "The variety of plant and animal life in a habitat.", "noun"],
  sanctuary: ["santwaryo", "dangpanan", "A protected nature reserve where wildlife can thrive safely.", "noun"],
  atoll: ["bahurang bilog", "atol", "A ring-shaped coral reef enclosing a lagoon.", "noun"],
  dynamite: ["dinamita", "dinamita", "Explosive used illegally in blast fishing that destroys fragile coral.", "noun"],
  poaching: ["ilegal na pangangaso", "ilegal nga pagpangayam", "Illegal hunting, capturing, or fishing in protected areas.", "noun / verb"],
  organ: ["organo", "organo", "A large musical instrument with keyboard and pipes sounded by air.", "noun"],
  bamboo: ["kawayan", "kawayan", "Giant woody grass widely used in Philippine architecture and crafts.", "noun"],
  preservation: ["pagpapanatili", "pagpreserba", "Maintaining something in its original, undamaged state.", "noun"],
  termites: ["anay", "anay", "Wood-eating insects that decompose timber.", "noun"],
  modernization: ["modernisasyon", "modernisasyon", "Updating traditional systems to meet modern safety and efficiency.", "noun"],
  jeepney: ["dyipni", "dyip", "Iconic Philippine passenger vehicle derived from post-WWII military jeeps.", "noun"],
  commuters: ["mga pasahero", "mga sumasakay", "People who travel regularly from home to work or school.", "noun"],
  emissions: ["usok o polusyon", "aso o hugaw", "Gases and pollutants released into the air by combustion.", "noun"],
  cooperative: ["kooperatiba", "kooperatiba", "An autonomous association of people united voluntarily to meet economic goals.", "noun"],
  indigenous: ["katutubo", "tumindok", "Originating naturally in a particular region or culture.", "adjective"],
  ancestral: ["ninuno", "katigulangan", "Pertaining to forebears and inherited sacred lands.", "adjective"],
  endemic: ["katutubo sa isang pook", "makaplagan lang sa usa ka lugar", "Found exclusively in a specific geographic location.", "adjective"],
  orchid: ["orkidyas", "orkidya", "A diverse family of flowering plants with complex blossoms.", "noun"],
  microgrid: ["maliit na sistema ng kuryente", "gamayng linya sa kuryente", "A localized group of electricity sources that operate autonomously.", "noun"],
  resilience: ["katatagan", "kalig-on", "The capacity to recover quickly from difficulties and disasters.", "noun"],
  karst: ["apog na bato", "anapog nga yuta", "Landscape formed from the dissolution of soluble limestone rocks.", "noun"],
  weathering: ["pagkagasgas sa bato", "pagkahilis sa bato", "The breaking down of rocks through wind, water, and climate.", "noun"],

  // History, Literature & Advanced (Hard)
  propaganda: ["kilusang propaganda", "propagandista", "Peaceful reform movement using published writings to advocate rights.", "noun"],
  censorship: ["sensura", "sensura", "Suppression of speech, public communication, or writing considered objectionable.", "noun"],
  exile: ["pagpapatapon", "paghingilin", "State of being barred from one's native country.", "noun"],
  satire: ["panunuya", "pagbiaybiay", "The use of humor, irony, or ridicule to expose stupidity or vices.", "noun"],
  colonial: ["kolonyal", "kolonyal", "Relating to a country's control over a foreign territory and people.", "adjective"],
  ivatan: ["ibatan", "ivatan", "The indigenous ethnolinguistic group native to the Batanes archipelago.", "noun / adjective"],
  limestone: ["apog", "anapog", "Sedimentary rock composed mainly of calcium carbonate from ancient marine life.", "noun"],
  impervious: ["hindi tinatablan", "dili matuhop", "Not allowing fluid or storms to pass through.", "adjective"],
  typhoons: ["mga bagyo", "mga bagyo", "Violent tropical cyclones originating in the northwestern Pacific Ocean.", "noun"],
  spine: ["gulugod o bundok", "bukobuko o tagaytay", "Central supportive ridge or mountain barrier protecting lowland plains.", "noun"],
  encroachment: ["papasok nang walang pahintulot", "pagsulod nga walay pananghid", "Intrusion on a person's territory or ancestral domain.", "noun"],
  disinformation: ["pekeng impormasyon", "sayop nga impormasyon", "False information deliberately spread to deceive people.", "noun"],
  lateral: ["pahalang na pagsusuri", "pagtandi sa ubang tinubdan", "Verifying information by opening multiple independent tabs to cross-check.", "adjective"],
  algorithms: ["mga alintuntunin ng computer", "mga pamaagi sa kompyuter", "Step-by-step procedures used by computational platforms to rank feeds.", "noun"],
  commodification: ["pagsasakalakal", "pagbaligya sa kultura", "Transforming sacred or cultural practices into commercial goods for sale.", "noun"],
  dreamweavers: ["mga tagahabi ng panaginip", "mga maghahabol sa damgo", "T'boli artisan women who translate dream visions into sacred T'nalak cloth.", "noun"],
  mangroves: ["bakawan", "katunggan", "Coastal shrubs that stabilize shorelines and serve as marine nurseries.", "noun"],
  surge: ["daluyong ng bagyo", "dagkong balod sa bagyo", "Rising sea waters pushed inland by violent tropical storm winds.", "noun"],

  // Philosophy, Jurisprudence & Master (Extreme)
  jurisprudence: ["hurisprudensya", "balaodnon nga mga desisyon", "The theory, philosophy, and historical rulings of law.", "noun"],
  intergenerational: ["sa pagitan ng henerasyon", "taliwala sa mga kaliwatan", "Relating to relations and duties between current and future generations.", "adjective"],
  locus: ["karapatang maghabla", "katungod sa pagdemanda", "Legal standing that permits a party to initiate a lawsuit in court.", "noun"],
  rainforests: ["mga gubat na maulan", "lasang nga ulanon", "Dense evergreen forests with heavy precipitation and immense biodiversity.", "noun"],
  tarsier: ["tarsyer o mamag", "mawmag", "One of the world's smallest primates, nocturnal and endemic to the Philippines.", "noun"],
  cortisol: ["hormon ng tensyon", "hormon sa stress", "A steroid hormone released in response to stress and low blood glucose.", "noun"],
  nocturnal: ["panggabi", "tinggabii", "Active primarily during the night rather than daylight hours.", "adjective"],
  ethology: ["agham ng ugali ng hayop", "pagtuon sa batasan sa mananap", "The scientific study of animal behavior under natural conditions.", "noun"],
  sociolinguistics: ["sosyolinggwistika", "pagtuon sa pinulongan ug katilingban", "The study of language in relation to social factors and cultural identity.", "noun"],
  homogenization: ["pagpapareho-pareho", "pagkaparehas sa tanan", "The process of making cultural or linguistic expressions uniform.", "noun"],
  watershed: ["lunasang saluhan ng tubig", "saluranan sa tubig", "An area of land that channels rainfall into rivers and streams.", "noun"],
  customary: ["nakagawian na batas", "naandang balaod", "Practices recognized as unwritten legal requirements by ancient tradition.", "adjective"],
  feudalism: ["piyudalismo", "piyudalismo", "Social system where laborers work under surveillance for dominant owners.", "noun"],
  annotation: ["paglalagay ng tala", "pagbutang ug marka", "Labeling text or images to train artificial intelligence models.", "noun"],
  epistemology: ["epistemolohiya", "pagtuon sa gigikanan sa kahibalo", "The philosophical branch studying how knowledge is created and validated.", "noun"],
  epics: ["mga epiko", "mga epiko", "Long narrative poems recounting heroic deeds and community cosmologies.", "noun"]
};

/**
 * Returns the Part of Speech for a given word
 * @param {string} word
 * @returns {string} (e.g. "noun", "verb", "adjective", "adverb")
 */
function getWordPOS(word) {
  const clean = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  const entry = D[clean];
  if (entry && entry[3]) return entry[3];
  if (entry) {
    const def = String(entry[2] || "").toLowerCase();
    if (def.startsWith("the ") || def.startsWith("a ") || def.startsWith("an ") || def.includes(" plant") || def.includes(" animal") || def.includes(" flower") || def.includes(" instrument") || def.includes(" area") || def.includes(" rock") || def.includes(" process")) return "noun";
    if (def.startsWith("to ") || def.includes("gathering ") || def.includes("rolling ") || def.includes("maintaining ")) return "verb";
    if (def.includes("relating ") || def.includes("pertaining ") || def.includes("found ") || def.includes("seasonal ") || def.includes("dense ")) return "adjective";
    return "noun";
  }
  if (clean.endsWith("ing") || clean.endsWith("ed") || clean.endsWith("ate")) return "verb";
  if (clean.endsWith("ly")) return "adverb";
  if (clean.endsWith("ful") || clean.endsWith("ous") || clean.endsWith("al") || clean.endsWith("ic") || clean.endsWith("ive") || clean.endsWith("able")) return "adjective";
  if (clean.endsWith("tion") || clean.endsWith("sion") || clean.endsWith("ity") || clean.endsWith("ness") || clean.endsWith("ment") || clean.endsWith("er") || clean.endsWith("or") || clean.endsWith("ist")) return "noun";
  return "noun";
}


/* === src/data/passages.js === */
/* ==========================================================================
   Practice Passages Database (24 total across 4 Difficulty Levels)
   ========================================================================== */
const PRACTICE_DATA = {
  easy: [
    {
      id: "e1",
      t: "Tala and the Morning Catch",
      diff: "easy",
      x: "Tala woke up before sunrise on Samal Island. The air smelled of salt and morning dew. Down at the shore, her father was carefully mending a torn fishing net. Tala helped gather the lead weights and untangled the nylon threads. As the sun peeked over the mountain, a pod of dolphins surfaced near the reef, leaping gracefully into the pink sky. Tala smiled, knowing it would be a blessed harvest at sea.",
      qs: [
        {
          q: "What was Tala's father doing when she reached the shore?",
          o: ["Cooking breakfast", "Mending a torn fishing net", "Selling fish to neighbors", "Plowing the field"],
          a: 1,
          k: "Literal",
          exp: "The passage explicitly states: 'her father was carefully mending a torn fishing net.'"
        },
        {
          q: "What does Tala's smile at the sight of dolphins reveal?",
          o: ["She was frightened of the large sea creatures", "She felt hopeful and saw it as a good omen", "She wanted to go back home to sleep", "She forgot her school books"],
          a: 1,
          k: "Inference",
          exp: "Tala smiled and thought it would be a 'blessed harvest,' showing hope and joy."
        }
      ]
    },
    {
      id: "e2",
      t: "The Carabao's Siesta",
      diff: "easy",
      x: "Under the scorching noon sun in Isabela, Mang Lucio paused his wooden plow. His faithful carabao, Kidlat, was breathing heavily after working through two muddy paddies. Instead of forcing the beast forward, Mang Lucio led Kidlat toward a deep mud pool beneath a spreading mango tree. Kidlat sank happily into the cool mud, wallowing until only his horns showed. Water buffalo lack efficient sweat glands, so mud protects their skin from heat and biting insects.",
      qs: [
        {
          q: "Why did Mang Lucio lead Kidlat into the mud pool?",
          o: ["To wash off fertilizer", "To help Kidlat cool down and protect his skin", "To punish the carabao for slowing down", "To look for fallen mangoes"],
          a: 1,
          k: "Literal",
          exp: "Carabaos lack sweat glands; mud protects them from extreme heat and insect bites."
        },
        {
          q: "What is the main idea of this story?",
          o: ["Rice farming is completely modern in the Philippines", "Mang Lucio shows empathy and understanding for his working animal", "Mango trees grow faster near water pools", "Carabaos can plow fields without resting"],
          a: 1,
          k: "Main idea",
          exp: "The story highlights the caring partnership between the farmer and his carabao."
        }
      ]
    },
    {
      id: "e3",
      t: "Sampaguita Dreams",
      diff: "easy",
      x: "Before their evening classes, young brothers Jun and Carlo sat on their porch stringing fragrant white sampaguita buds onto thin threads. Every fifty blossoms formed a neat garland. Their mother sold these garlands to churchgoers outside Quiapo Church in Manila. The small coins they earned were placed directly into a tin can labeled 'School Project Fund'. Though their fingers were stained with green sap, the brothers laughed as they raced to finish the final basket.",
      qs: [
        {
          q: "Where were the sampaguita garlands sold?",
          o: ["At a supermarket in Makati", "Outside Quiapo Church in Manila", "Along the provincial highway", "Inside their school classroom"],
          a: 1,
          k: "Literal",
          exp: "The passage states their mother sold them 'outside Quiapo Church in Manila.'"
        },
        {
          q: "What trait best describes Jun and Carlo?",
          o: ["Irresponsible and lazy", "Industrious and cooperative", "Easily discouraged by hard work", "Competitive and angry"],
          a: 1,
          k: "Inference",
          exp: "The brothers worked cheerfully to contribute coins to their school project fund."
        }
      ]
    },
    {
      id: "e4",
      t: "The Sweet Mangoes of Guimaras",
      diff: "easy",
      x: "The island province of Guimaras is celebrated for producing some of the sweetest mangoes in the world. To maintain this reputation, the local government enforces a strict agricultural quarantine. Visitors boarding ferries to the island are prohibited from bringing any outside mangoes or mango seedlings. A single foreign fruit fly could ruin thousands of pristine orchards. Because of these protective measures, Guimaras mangoes remain certified pest-free and are served at state banquets worldwide.",
      qs: [
        {
          q: "What rule must visitors follow when traveling to Guimaras?",
          o: ["They must plant a mango seed upon arrival", "They cannot bring outside mangoes onto the island", "They must pay an entrance fee per fruit", "They must harvest their own food"],
          a: 1,
          k: "Literal",
          exp: "Visitors are strictly prohibited from bringing outside mangoes to prevent fruit fly pests."
        },
        {
          q: "What is the primary purpose of the quarantine?",
          o: ["To make tourists purchase expensive souvenirs", "To safeguard local orchards from devastating foreign pests", "To keep ferry travel completely silent", "To increase tax revenues for neighboring islands"],
          a: 1,
          k: "Main idea",
          exp: "The quarantine shields local crops so the island maintains its world-class harvest."
        }
      ]
    },
    {
      id: "e5",
      t: "Lola Amparo's Banig",
      diff: "easy",
      x: "In the town of Basey in Samar, Lola Amparo sat cross-legged on the polished bamboo floor. Surrounding her were bundles of dried reeds dyed in brilliant shades of emerald, magenta, and sun gold. For over fifty years, she has practiced the ancient art of banig weaving. Her fingers moved like nimble birds, folding each reed strand into intricate diamond patterns. 'A good banig takes patience,' she whispered to her granddaughter. 'You cannot hurry the beauty of a sleeping mat.'",
      qs: [
        {
          q: "What material does Lola Amparo use to weave her mats?",
          o: ["Recycled plastic wrappers", "Dyed dried reeds", "Woven banana fibers", "Imported silk yarn"],
          a: 1,
          k: "Literal",
          exp: "The text mentions she works with 'bundles of dried reeds dyed in brilliant shades.'"
        },
        {
          q: "What life lesson does Lola Amparo pass on?",
          o: ["Speed is more important than quality", "True craftsmanship requires dedication and patience", "Bright colors are superior to simple designs", "Only elders should practice weaving"],
          a: 1,
          k: "Critical reading",
          exp: "Her advice highlights that beautiful work cannot be rushed and requires patience."
        }
      ]
    },
    {
      id: "e6",
      t: "Rain on the Tin Roof",
      diff: "easy",
      x: "When the afternoon sky turned charcoal gray, heavy drops began drumming against the corrugated tin roof of the old house. Elena and her grandfather leaned back in their wooden rocking chairs on the veranda. As steam rose from two warm bowls of chocolate champorado paired with crispy salted fish, the aroma filled the cozy room. Electricity had flickered out across the barangay, but a small coconut-oil lamp cast a gentle, dancing light over their books.",
      qs: [
        {
          q: "What food were Elena and her grandfather enjoying during the rain?",
          o: ["Fried chicken and soda", "Champorado with salted fish", "Fresh mangoes and sticky rice", "Corn soup with pandesal"],
          a: 1,
          k: "Literal",
          exp: "The text specifies 'warm bowls of chocolate champorado paired with crispy salted fish.'"
        },
        {
          q: "What mood does the author evoke in this scene?",
          o: ["Panic and chaos due to the thunderstorm", "Boredom and frustration with the blackout", "Comfort, warmth, and quiet family companionship", "Curiosity about the scientific cause of thunder"],
          a: 2,
          k: "Inference",
          exp: "Sensory details like warm porridge, rocking chairs, and soft lamp light convey comfort."
        }
      ]
    }
  ],

  medium: [
    {
      id: "m1",
      t: "Guardians of the Coral Triangle",
      diff: "medium",
      x: "Rising out of the Sulu Sea, the Tubbataha Reefs Natural Park covers nearly one hundred thousand hectares of rich marine sanctuary. Positioned at the very heart of the global Coral Triangle, it houses over six hundred species of fish and half of the world's coral varieties. Park rangers live on an isolated sandbar station for months at a time, enduring storms and scorching heat to patrol against illegal dynamite blast fishing and wildlife poaching. Because of this unwavering vigilance, Tubbataha serves as a vital nursery, replenishing fish stocks that feed millions of Filipino families across the archipelago.",
      qs: [
        {
          q: "Why is Tubbataha Reefs considered crucial for Philippine food security?",
          o: ["It is the site of large commercial fish canning factories", "It functions as a marine nursery that naturally replenishes fish stocks", "It imports frozen seafood from neighboring countries", "It produces artificial coral fragments for sale"],
          a: 1,
          k: "Main idea",
          exp: "The text notes that Tubbataha replenishes the fish stocks that feed millions across the country."
        },
        {
          q: "In the passage, 'vigilance' most nearly means:",
          o: ["Careful watchfulness and dedication", "Financial investment in fishing gear", "Loud public protest", "Quick retreat from dangerous waters"],
          a: 0,
          k: "Vocabulary",
          exp: "Vigilance refers to the rangers' constant, disciplined watch to protect the sanctuary."
        },
        {
          q: "What would most likely occur if ranger patrols stopped?",
          o: ["Coral reefs would expand even faster without human presence", "Illegal blast fishing and poaching would devastate the delicate marine ecosystem", "Fish prices in local markets would instantly drop permanently", "Typhoons would cease to cross the Sulu Sea"],
          a: 1,
          k: "Inference",
          exp: "Without patrols, illegal fishers and poachers would destroy the unprotected coral habitat."
        }
      ]
    },
    {
      id: "m2",
      t: "The Song of the Bamboo Organ",
      diff: "medium",
      x: "Constructed between 1816 and 1824 by Spanish missionary Father Diego Cera, the historic Las Piñas Bamboo Organ is a marvel of Philippine craftsmanship. Lacking traditional metal and tin during colonial isolation, Father Cera turned to indigenous bamboo. He buried hundreds of bamboo trunks under coastal beach sand for a full year. This innovative treatment allowed natural sea salt to permeate the wood, preserving the fibers against ravenous termites and tropical moisture. Today, over nine hundred bamboo pipes continue to produce ethereal, flute-like harmonies that echo through the centuries.",
      qs: [
        {
          q: "Why did Father Diego Cera bury the bamboo trunks under beach sand?",
          o: ["To hide them from rival builders", "To let sea salt preserve the wood against termites and decay", "To soften the pipes so they could bend easily", "To dry them under heavy stones"],
          a: 1,
          k: "Literal",
          exp: "The passage notes that burying the bamboo in sand allowed sea salt to protect it from termites."
        },
        {
          q: "What does this passage reveal about the builders of the organ?",
          o: ["They gave up when imported metal supplies ran out", "They ingeniously adapted indigenous materials to overcome severe constraints", "They favored foreign designs over local craftsmanship", "They built the organ exclusively for decorative display"],
          a: 1,
          k: "Critical reading",
          exp: "Father Cera and local artisans used creativity and local resources to solve a material shortage."
        }
      ]
    },
    {
      id: "m3",
      t: "The Jeepney on the Crossroads",
      diff: "medium",
      x: "The Philippine jeepney has long symbolized grassroots ingenuity, born from repurposed military vehicles after the Second World War. Adorned with chrome horses, religious icons, and vivid landscape murals, each jeepney was a rolling piece of folk art. However, aging diesel engines emit hazardous particulate soot that clogs urban air. The government's modernization program urges transport operators to transition to electric or Euro-4 compliant mini-buses. While environmental advocates praise reduced carbon emissions, small operators struggle with the staggering debt required to purchase modern units, questioning whether national progress must erase cultural soul.",
      qs: [
        {
          q: "What is the central tension discussed in the passage?",
          o: ["Finding routes for new highways in Metro Manila", "Balancing environmental clean air goals with the financial survival of small drivers", "Deciding between foreign tourists and local passengers", "Choosing the most vibrant colors for vehicle paint"],
          a: 1,
          k: "Main idea",
          exp: "The conflict lies between urgent public health/green goals and the economic burden on poor drivers."
        },
        {
          q: "Which word best characterizes the author's tone toward the traditional jeepney?",
          o: ["Contemptuous and dismissing", "Affectionate yet realistic about its ecological flaws", "Completely unconcerned and detached", "Aggressively opposed to all modern technology"],
          a: 1,
          k: "Author's purpose",
          exp: "The author celebrates its artistic heritage while acknowledging its soot and emission issues."
        }
      ]
    },
    {
      id: "m4",
      t: "Whispers of Mount Apo",
      diff: "medium",
      x: "Rising majestically over Mindanao, Mount Apo is the highest peak in the Philippine archipelago. To the Manobo, Bagobo, and Klata indigenous peoples, the mountain is not an adventure park but Apo Sandawa—a sacred ancestral sanctuary housing guardian spirits. High along its cloud-kissed ridges grows the rare Waling-waling orchid, crowned as the queen of Philippine flowers. In recent years, unregulated trekking and commercial encroachment sparked devastating forest fires. Tribal councils have partnered with environmental biologists to establish cultural boundaries, proving that indigenous ancestral stewardship is vital for ecological conservation.",
      qs: [
        {
          q: "How do indigenous peoples view Mount Apo differently from recreational hikers?",
          o: ["As a profitable commercial hunting ground", "As a sacred spiritual ancestor rather than merely a sporting destination", "As an uninhabitable wasteland", "As a site reserved exclusively for foreign research"],
          a: 1,
          k: "Inference",
          exp: "The text contrasts 'adventure park' with 'Apo Sandawa—a sacred ancestral sanctuary.'"
        },
        {
          q: "What key conclusion is supported by the final sentence?",
          o: ["Indigenous wisdom and modern environmental science can work together to protect nature", "Tourism should be permanently outlawed on every Philippine mountain", "The Waling-waling orchid no longer blooms in the wild", "Forest fires are entirely impossible to prevent"],
          a: 0,
          k: "Critical reading",
          exp: "The partnership between tribal councils and biologists shows collaborative conservation."
        }
      ]
    },
    {
      id: "m5",
      t: "The Barangay Solar Micro-Grid",
      diff: "medium",
      x: "On a remote island in Romblon, diesel fuel shipments frequently ceased whenever monsoon gale warnings halted sea ferries. For decades, residents suffered unpredictable blackouts, leaving clinics without refrigeration for lifesaving vaccines. Last year, the community organized a barangay solar microgrid cooperative. Rooftop photovoltaic panels and deep-cycle lithium batteries now power street lamps, water pumps, and local school tablets. By managing electricity as a shared common resource, the island lowered energy costs by forty percent while building resilience against typhoon disasters.",
      qs: [
        {
          q: "What caused the island's chronic energy shortages before the solar microgrid?",
          o: ["High electricity usage from industrial factories", "Rough monsoon seas that blocked diesel fuel deliveries by boat", "A complete absence of electrical appliances", "Government taxes on solar equipment"],
          a: 1,
          k: "Literal",
          exp: "The passage notes that diesel fuel shipments ceased whenever monsoon gale warnings halted ferries."
        },
        {
          q: "What broader lesson does this island's experience provide?",
          o: ["Islands must rely solely on central government handouts", "Community-led renewable energy fosters independence and local resilience", "Solar panels perform poorly in tropical climates", "Diesel generators are always more economical than batteries"],
          a: 1,
          k: "Main idea",
          exp: "The microgrid proved that local clean energy cooperatives can solve energy insecurity."
        }
      ]
    },
    {
      id: "m6",
      t: "The Legend and Science of Chocolate Hills",
      diff: "medium",
      x: "Spread across the plains of Bohol are over a thousand symmetrical, conical mounds known as the Chocolate Hills. Local folklore poetically recounts two battling giants who hurled boulders and mud at each other for days before weeping tears of reconciliation that formed the hills. Geologists, however, tell an equally wondrous story. Millions of years ago, the region lay submerged under shallow ocean waters. Ancient coral reefs and marine shells accumulated into thick limestone layers, which tectonic uplifting raised above sea level. Rainwater and natural weathering carved the limestone over millennia into the iconic formations we admire today.",
      qs: [
        {
          q: "According to geological evidence, what was the origin of the Chocolate Hills?",
          o: ["Volcanic lava flows that cooled suddenly", "Uplifted coral limestone sculpted by millennia of rainfall and weathering", "Massive soil mounds built by ancient indigenous civilizations", "Fossilized giant trees from prehistoric rainforests"],
          a: 1,
          k: "Literal",
          exp: "The passage explains that marine limestone was uplifted by tectonics and weathered by rain."
        },
        {
          q: "How does the author treat both the folklore and the scientific explanation?",
          o: ["With mockery for the ancient myth and praise for modern science", "With appreciation for both, recognizing poetry in myth and wonder in geology", "By arguing that neither explanation is scientifically plausible", "By dismissing the geological findings as foreign theory"],
          a: 1,
          k: "Author's purpose",
          exp: "The author calls folklore 'poetic' and geology 'an equally wondrous story.'"
        }
      ]
    }
  ],

  hard: [
    {
      id: "h1",
      t: "The Ink of Propaganda: Rizal and Del Pilar in Madrid",
      diff: "hard",
      x: "In the drafty garrets of late nineteenth-century Madrid, young Filipino expatriates waged a war not with blades or gunpowder, but with printing presses. Through the biweekly journal La Solidaridad, Marcelo H. del Pilar, Jose Rizal, and Graciano Lopez Jaena unmasked the systemic abuses of colonial governance and ecclesiastical dominance in the archipelago. Writing under biting pseudonyms like Plaridel and Laong Laan, they employed sharp satire, rigorous investigative journalism, and philosophical treatises. While Spanish reactionaries dismissed them as ungrateful agitators, their writings awakened an intellectual solidarity that crossed regional dialects, laying the ideological bedrock for the Philippine Revolution of 1896.",
      qs: [
        {
          q: "What was the primary weapon used by the leaders of the Propaganda Movement?",
          o: ["Covert guerrilla warfare in the Luzon mountains", "Diplomatic treaties signed with neighboring Asian powers", "Published journalism, satirical essays, and intellectual literature", "Boycotts of Spanish agricultural exports"],
          a: 2,
          k: "Literal",
          exp: "They waged war 'not with blades or gunpowder, but with printing presses' through La Solidaridad."
        },
        {
          q: "In what way did the Propagandists transform the concept of Filipino identity?",
          o: ["They divided regional groups into competing linguistic sectors", "They fostered an overarching national solidarity that transcended regional divides", "They urged Filipinos to assimilate permanently as Spanish citizens", "They argued that literature was useless during political struggles"],
          a: 1,
          k: "Inference",
          exp: "Their work 'awakened an intellectual solidarity that crossed regional dialects' into a national consciousness."
        },
        {
          q: "In the context of the passage, 'ecclesiastical dominance' refers to:",
          o: ["Economic control exerted by foreign merchants", "Religious and friar hegemony over political and civil life", "Military rule by the Spanish armed forces", "The influence of university student organizations"],
          a: 1,
          k: "Vocabulary",
          exp: "Ecclesiastical relates to church authorities and friars who held vast civil influence in the colonial era."
        }
      ]
    },
    {
      id: "h2",
      t: "The Architecture of Survival: Batanes Ivatan Stone Houses",
      diff: "hard",
      x: "Perched where the Pacific Ocean collides with the South China Sea, the Batanes archipelago is battered by annual supertyphoons carrying catastrophic barometric drops and gale-force gusts. To inhabit this tempestuous frontier, the Ivatan developed the sinadumparan—a vernacular stone house engineered for survival. Walls exceeding one meter in thickness are meticulously constructed from coral limestone bonded with slaked lime mortar. Rather than rigid iron, the roof is formed from dense, multi-layered cogon thatch tied with tough rattan reeds. Under howling gales that level concrete towers, these flexible thatched canopies flex without breaking, allowing air pressure to equalize rather than blow off the roof, demonstrating centuries of climate adaptation.",
      qs: [
        {
          q: "What engineering feature prevents the Ivatan thatch roof from tearing away during supertyphoons?",
          o: ["Heavy steel beams imported from the mainland", "Flexible cogon thatch tied with rattan that equalizes internal and external wind pressure", "Concrete sealant poured across the outer shingles", "Underground basements that store the entire roof structure during storms"],
          a: 1,
          k: "Critical reading",
          exp: "The flexible thatch tied with rattan allows air pressure to equalize instead of shearing off."
        },
        {
          q: "What broader insight does the author convey regarding indigenous architecture?",
          o: ["Modern concrete buildings are invariably superior to traditional structures", "Indigenous vernacular design embodies sophisticated, empirical climate engineering", "Traditional builders disregarded weather patterns when designing shelters", "Batanes houses should be replaced with modern glass high-rises"],
          a: 1,
          k: "Main idea",
          exp: "The author shows that traditional Ivatan architecture represents high-level climate adaptation."
        }
      ]
    },
    {
      id: "h3",
      t: "Echoes of the Sierra Madre",
      diff: "hard",
      x: "Spanning over five hundred kilometers along Luzon's eastern flank, the Sierra Madre mountain range functions as the great topographical shield of the Philippines. When Pacific supertyphoons make landfall, the dense cloud forest canopy and rugged ridgelines absorb immense kinetic energy, dissipating destructive gale winds and catching trillions of liters of monsoon rainfall like a gigantic sponge. Yet, despite being Luzon's ecological spine, the Sierra Madre faces persistent hemorrhaging from illegal logging, open-pit quarrying, and unconsulted infrastructure projects cutting into Dumagat-Remontado ancestral domains. Stripping this mountain fortress imperils not only indigenous heritage, but the food security and disaster safety of millions in the lowlands.",
      qs: [
        {
          q: "What physical metaphor does the author use to describe the ecological role of the Sierra Madre?",
          o: ["A fragile glass decorative ornament", "A gigantic sponge and topographical shield", "A commercial lumber storehouse", "A dry desert barrier"],
          a: 1,
          k: "Literal",
          exp: "The text calls it 'the great topographical shield' and describes it absorbing rain 'like a gigantic sponge.'"
        },
        {
          q: "What consequence does the author foresee if destruction of the Sierra Madre continues?",
          o: ["Lowland cities will experience fewer typhoons overall", "Both indigenous ancestral rights and the safety of millions of lowland residents will be jeopardized", "Forest fires will disappear from mountainous areas", "Rainfall across Luzon will become easier to control"],
          a: 1,
          k: "Inference",
          exp: "Stripping the mountains imperils indigenous heritage as well as the safety of millions in the lowlands."
        }
      ]
    },
    {
      id: "h4",
      t: "The Algorithm and the Ballot",
      diff: "hard",
      x: "In the contemporary digital landscape, information warfare has shifted from crude censorship to algorithmic hyper-saturation. Social media platforms, architected around maximizing user engagement through emotional outrage, frequently amplify sensationalized falsehoods six times faster than verified facts. Historical revisionism flourishes when synthetic nostalgia and tailored digital micro-targeting persuade youth to discount archival records. Navigating this infodemic demands more than passive literacy; students must practice lateral reading—leaving dubious posts to cross-reference primary sources and evaluate institutional consensus before validating claims. In a participatory democracy, discernment is not merely an academic virtue, but an indispensable civic duty.",
      qs: [
        {
          q: "According to the passage, why do algorithmic platforms often prioritize sensationalized falsehoods?",
          o: ["Because falsehoods require less bandwidth to stream", "Because their architecture maximizes user engagement driven by emotional outrage", "Because fact-checkers are completely barred from using social media", "Because search engines only recognize fiction"],
          a: 1,
          k: "Critical reading",
          exp: "The text states the platforms are architected to maximize engagement fueled by emotional outrage."
        },
        {
          q: "What reading habit does the author recommend to combat historical revisionism?",
          o: ["Accepting whichever post receives the highest number of shares", "Lateral reading—cross-referencing independent primary sources", "Relying exclusively on algorithmically suggested videos", "Avoiding all written materials on the internet"],
          a: 1,
          k: "Main idea",
          exp: "The author explicitly advocates 'lateral reading—leaving dubious posts to cross-reference primary sources.'"
        }
      ]
    },
    {
      id: "h5",
      t: "The Living Loom of the T'boli",
      diff: "hard",
      x: "In the highland mists of Lake Sebu, South Cotabato, the T'boli practice a sacred textile tradition where art and spirituality intertwine. The dreamweavers (fu dalu) do not consult pre-drawn blueprints; their geometric motifs are received directly through dream revelations from Fu Dalu, the spirit guardian of abaca. Weaving T'nalak is a grueling ritual spanning months—stripping wild abaca, tie-dyeing fibers in boiling bark extracts, and working wooden backstrap looms in humid conditions to prevent brittle snapping. Yet, this sacred cosmology faces tension from commercial tourist markets that demand quick, mass-produced souvenir swatches, sparking debate over whether commodification preserves living culture or dilutes its sacred essence.",
      qs: [
        {
          q: "Where do T'boli dreamweavers derive the complex patterns for authentic T'nalak cloth?",
          o: ["From foreign fashion catalog blueprints", "From sacred dream revelations bestowed by the spirit Fu Dalu", "From commercial textile design apps", "From school art competitions"],
          a: 1,
          k: "Literal",
          exp: "The text notes that motifs are 'received directly through dream revelations from Fu Dalu.'"
        },
        {
          q: "What ethical dilemma is highlighted regarding commercial tourism?",
          o: ["Tourists refuse to travel to high mountain regions", "The pressure to mass-produce cheap souvenirs threatens to strip the sacred ritual meaning from the craft", "Abaca plants cannot be grown outside botanical laboratories", "Backstrap looms are too expensive to repair"],
          a: 1,
          k: "Critical reading",
          exp: "The passage debates whether mass commodification dilutes the sacred, ritual essence of the art."
        }
      ]
    },
    {
      id: "h6",
      t: "The Vanishing Mangrove Frontier",
      diff: "hard",
      x: "Often derided as muddy wastelands, mangrove forests are among the most carbon-dense, ecologically indispensable ecosystems on earth. Their stilt roots form an aquatic labyrinth that dissipates up to sixty-six percent of wave energy during storm surges, serving as a live armor for coastal barangays. Simultaneously, their anaerobic soils trap carbon ten times more effectively than terrestrial tropical rainforests. Despite these ecosystem services, the twentieth century witnessed the destruction of over half of Philippine mangrove forests, converted into commercial aquaculture fishponds and reclaimed coastal real estate. Recognizing this catastrophe, coastal communities are now planting native Avicennia and Rhizophora varieties, proving that restoration requires understanding biodiversity rather than planting single-species monocultures.",
      qs: [
        {
          q: "What physical benefit do mangrove stilt roots provide during coastal storm surges?",
          o: ["They generate electrical energy for coastal homes", "They can dissipate up to two-thirds of wave energy, acting as live armor", "They attract high tides toward the shoreline", "They cause seawater to evaporate instantly"],
          a: 1,
          k: "Literal",
          exp: "The text explains their roots 'dissipate up to sixty-six percent of wave energy during storm surges.'"
        },
        {
          q: "Why does the author caution against 'single-species monocultures' in mangrove restoration?",
          o: ["Single species are much cheaper to purchase", "Healthy ecological recovery requires genuine biological diversity rather than uniform planting", "Mangrove trees cannot grow near seawater", "Only commercial developers should manage forests"],
          a: 1,
          k: "Critical reading",
          exp: "True ecological resilience demands diverse native species rather than vulnerable monocultures."
        }
      ]
    }
  ],

  extreme: [
    {
      id: "x1",
      t: "Oposa v. Factoran and Intergenerational Responsibility",
      diff: "extreme",
      x: "In the landmark 1993 jurisprudence of Oposa v. Factoran, the Philippine Supreme Court articulated a legal doctrine of profound global consequence. A group of Filipino minors, represented by environmental attorney Antonio Oposa, petitioned the Department of Environment and Natural Resources to cancel all existing commercial timber license agreements, asserting their constitutional right to a balanced and healthful ecology. The defense argued that the plaintiffs lacked legal standing to sue on behalf of those not yet born. In a visionary ponencia penned by Justice Hilario Davide Jr., the Court ruled that the petitioners possessed locus standi based on the concept of intergenerational responsibility: every generation holds the natural environment in trust for the generations yet unborn. This ruling pierced traditional legal positivism, establishing that ecological stewardship is a self-executing constitutional mandate rather than a legislative suggestion.",
      qs: [
        {
          q: "What revolutionary legal doctrine was established in the Oposa v. Factoran ruling?",
          o: ["Minors are forbidden from filing petitions in Supreme Court proceedings", "Timber licenses are completely exempt from judicial review", "Present generations possess legal standing to advocate for the rights of unborn future generations", "Economic profits must always supersede ecological concerns"],
          a: 2,
          k: "Main idea",
          exp: "The Court recognized locus standi rooted in the doctrine of intergenerational responsibility."
        },
        {
          q: "In the context of the ruling, what does 'self-executing constitutional mandate' signify?",
          o: ["The constitutional right to a balanced ecology is directly enforceable without waiting for enabling legislation", "The right requires a separate statute enacted by Congress before courts can enforce it", "The president can unilaterally abolish the court's jurisdiction", "Constitutional clauses apply only during national martial law"],
          a: 0,
          k: "Critical reading",
          exp: "Self-executing provisions are directly enforceable by courts without requiring supplementary statutes."
        },
        {
          q: "How did Justice Davide's decision challenge traditional legal positivism?",
          o: ["By arguing that contracts can never be overturned", "By dismissing international environmental treaties entirely", "By declaring that nature has no legal relevance in judicial courts", "By viewing ecological preservation as a fundamental human right grounded in intergenerational justice"],
          a: 3,
          k: "Inference",
          exp: "The ruling transcended rigid legalism by grounding ecological rights in moral stewardship across generations."
        }
      ]
    },
    {
      id: "x2",
      t: "The Paradox of the Philippine Tarsier: Captivity and Cortisol",
      diff: "extreme",
      x: "The Philippine tarsier (Carlito syrichta) is an evolutionary marvel: a nocturnal primate with disproportionately immense orbits that cannot rotate in their sockets, compensated by a cervical spine capable of near 180-degree rotation. Yet, its extreme physiological specialization renders it acutely vulnerable to anthropocentric disruption. Clinical ethological investigations reveal that commercial captivity and uncontrolled ecotourism trigger acute neuroendocrine distress in tarsiers. When subjected to artificial flash photography, handling, and acoustic decibel spikes, tarsiers exhibit elevated plasma cortisol titers accompanied by stereotypic anxiety behaviors. In extreme captivity conditions, tarsiers are known to repeatedly strike their fragile craniums against enclosure barriers, a phenomenon widely documented as stress-induced self-harm. Preserving this endemic primate necessitates dismantling exploitative petting-zoo enclosures in favor of vast, inviolable forest sanctuaries that eliminate human intrusion.",
      qs: [
        {
          q: "What physiological consequence occurs in tarsiers subjected to noisy ecotourism and flash photography?",
          o: ["Their visual acuity permanently improves under artificial lights", "Their cervical spine loses the ability to rotate", "They transition from nocturnal to strictly diurnal habits", "They experience elevated stress hormone levels (cortisol) leading to severe distress and self-harm"],
          a: 3,
          k: "Literal",
          exp: "The text explains they exhibit elevated plasma cortisol titers and documented stress-induced self-harm."
        },
        {
          q: "What core policy recommendation is supported by the author's analysis?",
          o: ["Transitioning from exploitative commercial exhibits to strictly protected wild habitats", "Expanding petting-zoo enclosures to allow direct tourist interaction", "Domesticating tarsiers as household pets to guarantee their safety", "Training tarsiers to adapt to louder tourist noise levels"],
          a: 0,
          k: "Critical reading",
          exp: "The author advocates dismantling exploitative exhibits in favor of vast, inviolable forest sanctuaries."
        }
      ]
    },
    {
      id: "x3",
      t: "Linguistic Drift and the Fate of Philippine Mother Tongues",
      diff: "extreme",
      x: "The Philippine linguistic ecosystem encompasses over one hundred and seventy-five living languages, each an irreplaceable repository of indigenous botanical taxonomies, navigational lexicons, and philosophical worldviews. However, sociolinguists observe an accelerating linguistic drift: younger generations in regional centers are increasingly shifting away from their ancestral mother tongues toward English and Tagalog-dominant code-switching. While English offers socioeconomic mobility in the global knowledge economy, and Filipino fosters national cohesion, the marginalization of regional languages like Pangasinense, Ivatan, or Subanen impoverishes intangible cultural heritage. When an indigenous tongue falls silent, it is not merely words that vanish, but centuries of empirical ecological knowledge encoded within specific oral metaphors that have no direct equivalents in dominant global lexicons.",
      qs: [
        {
          q: "What unique form of knowledge is permanently lost when an indigenous language disappears?",
          o: ["Official government administrative paperwork", "Empirical ecological, botanical, and cultural insights encoded within unique oral metaphors", "International banking exchange formulas", "Global internet search algorithms"],
          a: 1,
          k: "Main idea",
          exp: "The author stresses that vanishing languages erase centuries of irreplaceable ecological and cultural knowledge."
        },
        {
          q: "What complex tension does the passage delineate?",
          o: ["The conflict between teaching mathematics versus natural sciences", "The competition between private and public school tuition fees", "The tension between economic mobility in global tongues and the preservation of indigenous linguistic heritage", "The debate over printing textbooks versus buying smartphones"],
          a: 2,
          k: "Critical reading",
          exp: "The text highlights the challenge of balancing global economic advancement with safeguarding local heritage."
        }
      ]
    },
    {
      id: "x4",
      t: "The Ifugao Rice Terraces as a Co-evolved Social-Ecological System",
      diff: "extreme",
      x: "Carved into the steep precipices of the Cordillera Central over two millennia ago, the Ifugao rice terraces (payyo) represent an extraordinary pinnacle of co-evolved social-ecological engineering. Unlike modern industrial agriculture that relies on fossil-fueled inputs, the terraces function as a cyclical watershed ecosystem. High above the terraced steps lie the clan-managed private forests (muyong), which act as biological reservoirs, capturing mountain cloud moisture and recharging subterranean springs. Water is channeled downward through an intricate matrix of canals governed not by centralized bureaucratic decrees, but by customary collective law (doh-ad) administered by tribal elders during ritual agricultural calendars. The terraces demonstrate that sustainable resource management is inseparable from spiritual cosmology, collective labor sharing, and strict watershed protection.",
      qs: [
        {
          q: "What role do the highland clan-managed forests (muyong) play in the terrace ecosystem?",
          o: ["They capture cloud moisture and recharge water springs that supply the terraced fields below", "They are cleared annually to make room for industrial factories", "They act as private hunting grounds where water is strictly diverted away from crops", "They store chemical fertilizers used to speed rice germination"],
          a: 0,
          k: "Literal",
          exp: "The text notes the muyong act as biological reservoirs capturing moisture to recharge springs."
        },
        {
          q: "How does water distribution across the terraces challenge modern management assumptions?",
          o: ["It proves that water can only be managed through heavy corporate taxation", "It reveals that mountainous farming inevitably fails without heavy tractors", "It shows that tribal rituals have no practical correlation with agricultural success", "It demonstrates that complex hydrology can be equitably governed through unwritten customary consensus"],
          a: 3,
          k: "Critical reading",
          exp: "Hydrology is sustained through customary law (doh-ad) and collective consensus without bureaucracy."
        }
      ]
    },
    {
      id: "x5",
      t: "Cyber-Feudalism in the Digital Global South",
      diff: "extreme",
      x: "Beneath the euphoric discourse surrounding artificial intelligence lies an invisible geopolitical supply chain that disproportionately exploits workers across the Global South, particularly in the Philippines. Hundreds of thousands of educated Filipino digital laborers engage in data annotation, content moderation, and algorithmic reinforcement learning to train Silicon Valley models. Trapped in piece-rate platform economies without labor contracts, healthcare, or collective bargaining rights, these digital workers perform grueling cognitive tasks—often filtering traumatizing online material for meager pennies per click. Political economists describe this paradigm as cyber-feudalism: tech monopolies in the metropoles extract immense capital value while offloading psychological precarity and algorithmic surveillance onto outsourced workers in peripheral nations, reproducing historic colonial extractivism within the digital sphere.",
      qs: [
        {
          q: "Why do political economists characterize the outsourced AI labor market as 'cyber-feudalism'?",
          o: ["Because laborers are required to wear medieval clothing while working", "Because artificial intelligence models are trained entirely on ancient historical manuscripts", "Because tech conglomerates extract massive capital while consigning Global South workers to precarious, unprotected labor", "Because the internet is completely outlawed in developing nations"],
          a: 2,
          k: "Main idea",
          exp: "The term reflects the one-sided extraction of value by tech monopolies while workers face precarity."
        },
        {
          q: "What irony does the author expose regarding the AI industry?",
          o: ["Machines can write poetry faster than human beings", "Sophisticated high-tech systems depend upon the hidden, low-wage, and precarious human labor of peripheral nations", "Computer programmers earn less money than manual farmhands", "Smartphones have eliminated the need for human language"],
          a: 1,
          k: "Critical reading",
          exp: "The author unmasks the paradox: supposedly autonomous AI relies heavily on exploited human laborers."
        }
      ]
    },
    {
      id: "x6",
      t: "The Epistemology of Oral Epics: Reading the Darangen and Hudhud",
      diff: "extreme",
      x: "When colonial historiography arrived in the Philippine archipelago with written archives, it codified a Eurocentric prejudice: that societies without alphabetic parchment lacked historical consciousness. This assumption fundamentally misunderstood the sophisticated epistemology of oral epics such as the Maranao Darangen and the Ifugao Hudhud. Comprising tens of thousands of lines chanted in archaic meters, these living masterworks are far more than romantic mythologies; they are comprehensive juridical, astronomical, and ecological treatises preserved across centuries through rigorous mnemonic cadences. The chanter does not simply repeat fixed verses, but dynamically activates collective communal memory, embedding customary dispute arbitration and cosmological cycles into the very breath of performance. Deconstructing colonial literacy hierarchies requires recognizing that oral literature possesses its own rigorous epistemological rigor, demanding an analytical reverence equal to that granted to classical western literature.",
      qs: [
        {
          q: "What colonial bias regarding pre-colonial Philippine culture does the author challenge?",
          o: ["The assumption that oral societies lacked historical consciousness and intellectual rigor because they did not rely on written parchment", "The belief that Filipinos had no appreciation for natural landscapes", "The claim that oral epics could only be chanted by foreign travelers", "The idea that Philippine epics were entirely borrowed from European folklore"],
          a: 0,
          k: "Main idea",
          exp: "The author repudiates the notion that pre-colonial oral cultures lacked historical memory and depth."
        },
        {
          q: "According to the passage, what functions do the Darangen and Hudhud serve beyond storytelling?",
          o: ["They served exclusively as private lullabies for children", "They were financial balance sheets used for foreign trade receipts", "They were military codes designed to confuse neighboring islands", "They function as juridical, astronomical, and customary repositories of communal law and memory"],
          a: 3,
          k: "Critical reading",
          exp: "The epics serve as comprehensive juridical, ecological, and astronomical archives."
        }
      ]
    }
  ]
};

// Calibration Placement Test Passages (3 passages, 5 questions each = 15 questions total)
// Covering: Literal comprehension, Vocabulary, Inference, Sequencing, and Main idea.
const PLACEMENT_TEST = [
  {
    id: "pl_easy",
    t: "Placement Step 1: A Fisher’s Morning in Bohol",
    diff: "easy",
    x: "Bayani woke up before sunrise to help his uncle repair their small wooden banca by the shore of Bohol. Together, they replaced two worn-out bamboo outriggers and sealed the hull joints with fragrant tree resin. By dawn, the tide had risen, and the boat floated smoothly on the gentle morning sea, completely ready for the day's catch.",
    qs: [
      {
        q: "What material did Bayani and his uncle use to seal the boat's joints?",
        o: ["Plastic tape", "Tree resin", "Cement paste", "Banana fiber"],
        a: 1,
        k: "Literal"
      },
      {
        q: "In this passage, what does the word 'outrigger' refer to?",
        o: ["A stabilizing bamboo float attached to the side of a boat", "A sharp wooden harpoon used for fishing", "A canvas sail catching the wind", "An anchor dropped to the seabed"],
        a: 0,
        k: "Vocabulary"
      },
      {
        q: "Why did Bayani and his uncle finish their repairs before sunrise?",
        o: ["To avoid being seen by other fishers", "Because wood cannot be worked in daylight", "So the banca was ready to launch as the morning tide rose", "They wanted to escape a sudden storm"],
        a: 2,
        k: "Inference"
      },
      {
        q: "According to the story, what did they do immediately after replacing the outriggers?",
        o: ["Floated the boat on the morning sea", "Woke up before dawn", "Sealed the hull joints with tree resin", "Cleaned their fishing nets"],
        a: 2,
        k: "Sequencing"
      },
      {
        q: "Which sentence expresses the main idea of this story?",
        o: ["Wooden bancas cannot withstand ocean tides", "Early teamwork and careful craft prepare a boat for safe fishing", "Tree resin is scarce in coastal villages", "Fishing is easiest during high tide"],
        a: 1,
        k: "Main idea"
      }
    ]
  },
  {
    id: "pl_med",
    t: "Placement Step 2: The Coral Patrol of Davao Gulf",
    diff: "medium",
    x: "Community fishers in Davao Gulf formed volunteer sea patrols after witnessing decades of reef destruction from illegal blast fishing. The volunteers coordinated night watches and marked marine boundaries with solar-powered buoys. Since the patrols began two years ago, damaged barrier reefs have slowly sprouted vibrant new coral branches, and returning schools of yellowfin tuna have revitalized the local coastal economy.",
    qs: [
      {
        q: "How long have the volunteer community patrols been protecting Davao Gulf?",
        o: ["Two years", "Ten years", "Six months", "Two weeks"],
        a: 0,
        k: "Literal"
      },
      {
        q: "In this passage, what does the word 'sprouted' mean?",
        o: ["Broke into pieces", "Began to grow new branches", "Turned pale white", "Sank beneath the sand"],
        a: 1,
        k: "Vocabulary"
      },
      {
        q: "Why did schools of yellowfin tuna return to the coastal waters of the gulf?",
        o: ["The fishers fed them artificial food pellets", "Volunteers built concrete dams", "Reef recovery restored natural marine habitats and feeding grounds", "Commercial ferry boats were banned from docking"],
        a: 2,
        k: "Inference"
      },
      {
        q: "Which event occurred first in the timeline of the community's environmental story?",
        o: ["Reefs sprouted new coral branches", "Schools of yellowfin tuna returned", "Fishers observed reef destruction from destructive blast fishing", "Volunteers installed solar-powered marine buoys"],
        a: 2,
        k: "Sequencing"
      },
      {
        q: "What is the central message conveyed by the passage?",
        o: ["Blast fishing is profitable for coastal towns", "Community vigilance and marine protection can successfully restore marine life", "Yellowfin tuna only breed in polluted harbors", "Night sea patrols should be replaced by drones"],
        a: 1,
        k: "Main idea"
      }
    ]
  },
  {
    id: "pl_hard",
    t: "Placement Step 3: Voices of La Solidaridad",
    diff: "hard",
    x: "During the 19th-century Propaganda Movement, exiled Filipino reformists in Spain published La Solidaridad to expose colonial abuses and advocate for civic equality. Rather than pursuing armed confrontation, writers like Marcelo H. del Pilar and Graciano López Jaena smuggled printed copies into Manila concealed inside sacks of dried coffee beans. They argued that cultivating civic consciousness and teaching citizens their legal rights posed a far more enduring challenge to authoritarian rule than spontaneous violence.",
    qs: [
      {
        q: "Where did exiled reformists print and publish La Solidaridad?",
        o: ["In Manila", "In Spain", "In Bohol", "In Cebu"],
        a: 1,
        k: "Literal"
      },
      {
        q: "In this text, what does the phrase 'authoritarian rule' mean?",
        o: ["A government that promotes democratic debate", "A system exercising strict, oppressive power without public consent", "A community managed entirely by volunteer fishers", "A federation of independent public schools"],
        a: 1,
        k: "Vocabulary"
      },
      {
        q: "Why did colonial authorities fear civic education and legal literacy more than armed revolt?",
        o: ["Printed papers were heavier than weapons", "Informed citizens who understand their legal rights cannot be easily intimidated or misled", "Colonial governors were investors in rival print shops", "The smuggled journals carried contagious tropical fevers"],
        a: 1,
        k: "Inference"
      },
      {
        q: "According to the passage, what occurred after the essays were published in Spain?",
        o: ["The authors declared an immediate military strike", "Copies were concealed inside coffee sacks and smuggled to Manila", "Reformers abandoned writing to become coffee merchants", "The colonial administration granted full representation"],
        a: 1,
        k: "Sequencing"
      },
      {
        q: "What is the primary argument presented in this passage?",
        o: ["Armed revolts are the only effective method of reform", "Coffee bean sacks make the best trade packaging", "Intellectual enlightenment and civic literacy are formidable instruments for freedom", "19th-century newspapers were unpopular among Filipino readers"],
        a: 2,
        k: "Main idea"
      }
    ]
  }
];

// Optional Advanced Verification Passage (5 questions)
// Offered only to students demonstrating exceptionally high mastery across all 3 placement passages.
const PLACEMENT_VERIFICATION_PASSAGE = [
  {
    id: "pl_verify",
    t: "Advanced Verification: Intergenerational Ecological Justice",
    diff: "extreme",
    x: "In the landmark Philippine jurisprudence of Oposa v. Factoran, the Supreme Court recognized the novel legal doctrine of intergenerational responsibility. Represented by their parents, a group of Filipino minors petitioned to cancel all commercial timber licenses, asserting their constitutional right to a balanced and healthful ecology. The landmark decision ruled that the youth have legal personality to sue not only for themselves, but also on behalf of generations yet unborn, establishing that each generation holds nature in temporary trust with a fiduciary obligation to preserve the earth.",
    qs: [
      {
        q: "What legal doctrine was established in the landmark case of Oposa v. Factoran?",
        o: ["Intergenerational ecological responsibility", "Commercial timber deregulation", "Statute of limitations on reforestation", "Exclusive corporate mineral rights"],
        a: 0,
        k: "Literal"
      },
      {
        q: "What is the meaning of 'fiduciary obligation' in the context of this ruling?",
        o: ["A commercial loan contract with high interest", "A solemn duty of trust to protect and preserve vital resources for others", "An exemption from ecological accountability", "A license permitting unrestricted forest logging"],
        a: 1,
        k: "Vocabulary"
      },
      {
        q: "Why did the high court recognize the standing of minors to sue on behalf of unborn generations?",
        o: ["Because adult citizens refused to participate in court cases", "Because children pay higher municipal property taxes", "Because the irreversible depletion of rainforests deprives unborn citizens of a habitable world", "Because timber companies requested child labor regulations"],
        a: 2,
        k: "Inference"
      },
      {
        q: "What was the initial action taken by the Filipino youth before the Supreme Court issued its landmark ruling?",
        o: ["They petitioned through their parents to cancel commercial logging licenses", "They signed a commercial lumber concession contract", "They drafted a new national constitution", "They dissolved the Department of Environment and Natural Resources"],
        a: 0,
        k: "Sequencing"
      },
      {
        q: "What is the overarching principle established by the court regarding humanity's relationship with nature?",
        o: ["The present generation possesses absolute ownership to exhaust natural resources for profit", "The present generation acts as temporary stewards holding a legal duty to preserve ecology for posterity", "Future generations must purchase environmental rights from current commercial holders", "Courts have no jurisdiction over environmental conservation matters"],
        a: 1,
        k: "Main idea"
      }
    ]
  }
];


// 40 Realistic Sample Students for Phil-IRI Class Reports
const CLASS_ROSTER = [
  { n: "Abad, Juanito M.", l: 0, wpm: 78, comp: 55, weak: "Inference" },
  { n: "Aquino, Carmela T.", l: 1, wpm: 105, comp: 72, weak: "Main idea" },
  { n: "Balagtas, Francisco R.", l: 2, wpm: 135, comp: 88, weak: "Critical reading" },
  { n: "Bautista, Maria Clara S.", l: 3, wpm: 165, comp: 95, weak: "Vocabulary" },
  { n: "Bonifacio, Andres P.", l: 1, wpm: 110, comp: 70, weak: "Critical reading" },
  { n: "Cabahug, Danica L.", l: 0, wpm: 72, comp: 50, weak: "Literal" },
  { n: "Castro, Emilio K.", l: 1, wpm: 98, comp: 68, weak: "Inference" },
  { n: "Crisostomo, Ibarra G.", l: 2, wpm: 140, comp: 85, weak: "Vocabulary" },
  { n: "Cruz, Samantha May D.", l: 1, wpm: 115, comp: 75, weak: "Main idea" },
  { n: "Datu, Alih J.", l: 2, wpm: 130, comp: 82, weak: "Author's purpose" },
  { n: "De Jesus, Gregoria V.", l: 3, wpm: 172, comp: 98, weak: "Critical reading" },
  { n: "Del Pilar, Marcelo H.", l: 2, wpm: 145, comp: 90, weak: "Inference" },
  { n: "Enriquez, Rafael B.", l: 0, wpm: 68, comp: 48, weak: "Vocabulary" },
  { n: "Fernandez, Liza C.", l: 1, wpm: 102, comp: 71, weak: "Main idea" },
  { n: "Flores, Antonio N.", l: 1, wpm: 108, comp: 74, weak: "Inference" },
  { n: "Garcia, Joshua P.", l: 0, wpm: 75, comp: 52, weak: "Literal" },
  { n: "Guerrero, Leon M.", l: 2, wpm: 138, comp: 86, weak: "Critical reading" },
  { n: "Hernandez, Amado V.", l: 3, wpm: 158, comp: 92, weak: "Main idea" },
  { n: "Ilagan, Bea Bianca T.", l: 1, wpm: 112, comp: 76, weak: "Vocabulary" },
  { n: "Jacinto, Emilio D.", l: 2, wpm: 142, comp: 89, weak: "Critical reading" },
  { n: "Katigbak, Sofia R.", l: 0, wpm: 80, comp: 58, weak: "Inference" },
  { n: "Lapulapu, Kalipulako C.", l: 1, wpm: 104, comp: 70, weak: "Literal" },
  { n: "Lim, Gabriel John O.", l: 2, wpm: 132, comp: 84, weak: "Author's purpose" },
  { n: "Luna, Juan N.", l: 3, wpm: 160, comp: 94, weak: "Inference" },
  { n: "Mabini, Apolinario P.", l: 3, wpm: 175, comp: 97, weak: "Critical reading" },
  { n: "Magbanua, Teresa F.", l: 2, wpm: 136, comp: 87, weak: "Main idea" },
  { n: "Navarro, Angela M.", l: 1, wpm: 106, comp: 73, weak: "Vocabulary" },
  { n: "Ocampo, Ambeth R.", l: 2, wpm: 148, comp: 91, weak: "Critical reading" },
  { n: "Palma, Josefa L.", l: 0, wpm: 70, comp: 46, weak: "Literal" },
  { n: "Perez, Miguel Angel V.", l: 1, wpm: 110, comp: 75, weak: "Main idea" },
  { n: "Quirino, Elpidio R.", l: 2, wpm: 134, comp: 83, weak: "Inference" },
  { n: "Reyes, Severino G.", l: 1, wpm: 100, comp: 69, weak: "Vocabulary" },
  { n: "Rizal, Jose P.", l: 3, wpm: 185, comp: 100, weak: "None" },
  { n: "Santos, Lope K.", l: 2, wpm: 139, comp: 88, weak: "Main idea" },
  { n: "Silang, Gabriela C.", l: 1, wpm: 114, comp: 77, weak: "Critical reading" },
  { n: "Tan, Mary Joy S.", l: 0, wpm: 76, comp: 54, weak: "Inference" },
  { n: "Tolentino, Guillermo E.", l: 2, wpm: 144, comp: 89, weak: "Vocabulary" },
  { n: "Valenzuela, Pio D.", l: 1, wpm: 105, comp: 72, weak: "Literal" },
  { n: "Villamor, Ignacio B.", l: 2, wpm: 137, comp: 86, weak: "Author's purpose" },
  { n: "Zaide, Gregorio F.", l: 1, wpm: 118, comp: 78, weak: "Main idea" }
];




/* === src/data/narrations.js === */
/* Add reviewed human recordings here. See assets/audio/README.md for the cue format.
   The empty catalog keeps the free browser voice available until recordings exist. */
const RECORDED_NARRATIONS = Object.freeze({});


/* === src/data/passage-schema.js === */
/* One passage contract for built-in, admin, and shared reading content.
   Legacy admin fields are converted here without rewriting stored records. */
function passageText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

function normalizePassage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Passage must be an object.");
  }

  const id = passageText(raw.id, "Passage ID", 80);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Passage ID may contain only letters, numbers, _ and -.");
  }
  const t = passageText(raw.t, "Passage title", 160);
  const x = passageText(raw.x, "Passage text", 30000);
  const diff = raw.diff ?? raw.tier;
  if (!DIFF_KEYS.includes(diff)) {
    throw new Error("Choose a valid difficulty tier.");
  }

  const sourceQuestions = raw.qs ?? raw.q;
  if (!Array.isArray(sourceQuestions) || sourceQuestions.length < 1 || sourceQuestions.length > 20) {
    throw new Error("Passage must have 1 to 20 questions.");
  }
  const qs = sourceQuestions.map((question, index) => {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`Question ${index + 1} must be an object.`);
    }
    const q = passageText(question.q, `Question ${index + 1} text`, 500);
    if (!Array.isArray(question.o) || question.o.length < 2 || question.o.length > 6) {
      throw new Error(`Question ${index + 1} must have 2 to 6 options.`);
    }
    const o = question.o.map((option, optionIndex) =>
      passageText(option, `Question ${index + 1} option ${optionIndex + 1}`, 300)
    );
    if (!Number.isInteger(question.a) || question.a < 0 || question.a >= o.length) {
      throw new Error(`Question ${index + 1} needs a valid correct-answer option.`);
    }
    const k = passageText(question.k ?? question.skill, `Question ${index + 1} skill`, 60);
    const normalized = { q, o, a: question.a, k };
    if (question.exp !== undefined && question.exp !== null && question.exp !== "") {
      normalized.exp = passageText(question.exp, `Question ${index + 1} explanation`, 2000);
    }
    return normalized;
  });

  // Existing admin records had no status and were intended for the curriculum.
  const status = raw.status ?? (raw.published === false ? "draft" : "published");
  if (!["draft", "pending", "rejected", "published"].includes(status)) {
    throw new Error("Passage status must be draft, pending, rejected, or published.");
  }
  const result = { id, t, diff, x, qs, status };
  if (raw.lang != null && raw.lang !== "") {
    if (!["en-US", "fil-PH", "ceb-PH"].includes(raw.lang)) {
      throw new Error("Choose English, Filipino, or Cebuano for the passage language.");
    }
    result.lang = raw.lang;
  }
  if (raw.ownerId != null && raw.ownerId !== "") {
    result.ownerId = passageText(raw.ownerId, "Owner ID", 80);
  }
  if (raw.author != null && raw.author !== "") {
    result.author = passageText(raw.author, "Author", 160);
  }
  if (raw.createdAt != null && raw.createdAt !== "") {
    result.createdAt = passageText(raw.createdAt, "Created date", 40);
  }
  if (raw.submittedAt != null && raw.submittedAt !== "") {
    result.submittedAt = passageText(raw.submittedAt, "Submission date", 40);
  }
  if (raw.reviewedById != null && raw.reviewedById !== "") {
    result.reviewedById = passageText(raw.reviewedById, "Reviewer ID", 80);
  }
  if (raw.reviewedAt != null && raw.reviewedAt !== "") {
    result.reviewedAt = passageText(raw.reviewedAt, "Review date", 40);
  }
  if (raw.reviewNote != null && raw.reviewNote !== "") {
    result.reviewNote = passageText(raw.reviewNote, "Review note", 500);
  }
  return result;
}

function getPublishedPassages() {
  const sources = [
    ...PRACTICE_DATA.easy,
    ...PRACTICE_DATA.medium,
    ...PRACTICE_DATA.hard,
    ...PRACTICE_DATA.extreme,
    ...(Array.isArray(AUTH.customPassages) ? AUTH.customPassages : []),
    ...(Array.isArray(S.sh) ? S.sh : [])
  ];
  const seen = new Set();
  const passages = [];
  for (const source of sources) {
    try {
      const passage = normalizePassage(source);
      if (passage.status !== "published" || seen.has(passage.id)) continue;
      seen.add(passage.id);
      passages.push(passage);
    } catch (error) {
      // Invalid stored records remain untouched and are excluded from readers.
    }
  }
  return passages;
}

function getPublishedPassageById(id) {
  return getPublishedPassages().find(passage => passage.id === id);
}
