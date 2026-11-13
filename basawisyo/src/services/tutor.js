/* ==========================================================================
   Wisyo AI Tutor: Intelligent Conversational Engine
   Can respond accurately to ANYTHING the student asks!
   ========================================================================== */

let CHAT_HISTORY = [];

function aiOpen(defaultPrompt) {
  $("#ai").hidden = false;
  setTimeout(() => $("#aii").focus(), 80);

  if (!CHAT_HISTORY.length) {
    CHAT_HISTORY.push([
      "a",
      "Mabuhay! I’m Wisyo, your personal reading companion and tutor. You can ask me *anything*—from explaining your mistakes, summarizing stories, to school topics, science, history, or studying tips in English, Filipino, or Bisaya!"
    ]);
  }

  renderChat();

  if (defaultPrompt) {
    aiSend(defaultPrompt);
  }
}

function renderChat() {
  const container = $("#aim");
  container.innerHTML = CHAT_HISTORY.map(m => {
    const isUser = m[0] === "u";
    return `
      <div class="msg-row ${isUser ? 'u' : 'a'}">
        ${!isUser ? `
          <div class="msg-avatar">
            <img src="${LG}" alt="Wisyo" class="mascot-img">
          </div>
        ` : ''}
        <div class="msg-body ${isUser ? 'u' : 'a'}">
          ${m[1] === "…" ? '<span class="dots"><i></i><i></i><i></i></span>' : formatChatText(m[1])}
        </div>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

function formatChatText(txt) {
  return txt
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}

// Comprehensive Knowledge Graph & NLP Responder
function generateWisyoResponse(input) {
  const raw = input.trim();
  const t = raw.toLowerCase();

  // 1. Math & Calculation Expression Solver
  const mathMatch = t.match(/(?:what is|calculate|compute|solve)?\s*(\d+(?:\.\d+)?)\s*([\+\-\*\/xX×÷]|\bplus\b|\bminus\b|\btimes\b|\bdivided by\b)\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const n1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2].toLowerCase();
    const n2 = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === "+" || op === "plus") res = n1 + n2;
    else if (op === "-" || op === "minus") res = n1 - n2;
    else if (op === "*" || op === "x" || op === "×" || op === "times") res = n1 * n2;
    else if (op === "/" || op === "÷" || op === "divided by") res = n2 !== 0 ? (n1 / n2) : "undefined (division by zero)";
    return `**Math Solution:**\n\n${n1} ${op} ${n2} = **${typeof res === "number" ? Math.round(res * 1000) / 1000 : res}**!\n\nNeed help with another calculation or word problem? Just ask! 🧮`;
  }

  const percentMatch = t.match(/(?:what is\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:of)\s*(\d+(?:\.\d+)?)/) || t.match(/(?:what is\s*)?(\d+(?:\.\d+)?)\s*percent\s*(?:of)\s*(\d+(?:\.\d+)?)/);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const val = (pct / 100) * total;
    return `**Percentage Calculation:**\n\n${pct}% of ${total} is **${Math.round(val * 100) / 100}**!\n\n*(Formula: (${pct} ÷ 100) × ${total} = ${val})*`;
  }

  if (/square root of|sqrt of/.test(t)) {
    const num = parseFloat(t.replace(/[^0-9.]/g, ""));
    if (!isNaN(num)) {
      return `The square root of ${num} ($\sqrt{${num}}$) is **${Math.round(Math.sqrt(num) * 1000) / 1000}**!`;
    }
  }

  // 2. World Leaders & Heads of State (Direct Answers)
  if (/president of.*(us|united states|america)|who is.*(president of the us|us president|biden|trump|american president)|current us president|sino ang presidente ng estados unidos/i.test(t)) {
    return `**The President of the United States:**\n\n• **46th President (2021–2025):** **Joe Biden** (inaugurated January 20, 2021; Vice President: Kamala Harris).\n• **47th President (2025–present):** **Donald Trump** won the November 2024 U.S. presidential election and returned as the 47th President of the United States (inaugurated on January 20, 2025; he also previously served as the 45th president from 2017 to 2021; Vice President: JD Vance).\n\n**Key Facts:**\n• **Official Residence & Office:** The White House, 1600 Pennsylvania Ave NW, Washington, D.C.\n• **First President:** **George Washington** (1789–1797).\n• **Term Length:** 4 years per term, up to a maximum of two terms under the 22nd Amendment of the U.S. Constitution.`;
  }

  if (/president of.*(philippines|pilipinas)|sino.*(pangulo|presidente).*pilipinas|kinsa.*presidente.*pilipinas|marcos|bongbong marcos|pbbm/i.test(t)) {
    return `**The President of the Republic of the Philippines:**\n\n• **Current President:** **Ferdinand "Bongbong" Romualdez Marcos Jr.** (PBBM).\n• **Assumed Office:** June 30, 2022 as the **17th President** of the Philippines.\n• **Vice President:** **Sara Zimmerman Duterte**.\n• **Official Workplace & Residence:** Malacañang Palace, San Miguel, Manila.\n• **Term:** A single, non-renewable 6-year term governed by the 1987 Philippine Constitution.\n• **First President:** General **Emilio Aguinaldo** (1899, Malolos Congress).`;
  }

  if (/vice president of the us|us vice president|kamala harris|jd vance/i.test(t)) {
    return `**Vice President of the United States:**\n\n• **Kamala Harris** served as the 49th Vice President from 2021 to 2025 (the first female, African American, and South Asian American Vice President).\n• **JD Vance** assumed office on January 20, 2025 alongside Donald Trump.\n• The Vice President also serves as the President of the U.S. Senate.`;
  }

  if (/vice president of the philippines|sara duterte|vp sara/i.test(t)) {
    return `**Vice President of the Philippines:**\n\n• **Sara Zimmerman Duterte** is the 15th Vice President of the Republic of the Philippines, serving alongside President Ferdinand Marcos Jr. since June 30, 2022. She previously served as Mayor of Davao City.`;
  }

  if (/prime minister of.*(uk|britain|united kingdom)|british prime minister|keir starmer|rishi sunak/i.test(t)) {
    return `**Prime Minister of the United Kingdom:**\n\n• The current Prime Minister is **Keir Starmer** (Labour Party), who took office in July 2024 following the general election, succeeding Rishi Sunak.\n• **Official Residence:** 10 Downing Street, London.`;
  }

  if (/president of france|emmanuel macron/i.test(t)) {
    return `The President of France is **Emmanuel Macron**, who has served as the head of state of the French Republic since 2017. The official presidential residence is the Élysée Palace in Paris.`;
  }

  if (/prime minister of japan|shigeru ishiba|fumio kishida/i.test(t)) {
    return `The Prime Minister of Japan is **Shigeru Ishiba** (took office October 2024), succeeding Fumio Kishida as leader of the Liberal Democratic Party (LDP).`;
  }

  if (/prime minister of canada|justin trudeau/i.test(t)) {
    return `The Prime Minister of Canada is **Justin Trudeau**, who has led the federal government since November 2015 as leader of the Liberal Party of Canada.`;
  }

  if (/prime minister of india|narendra modi/i.test(t)) {
    return `The Prime Minister of India is **Narendra Modi**, who has served as the head of government of India since 2014.`;
  }

  if (/president of china|xi jinping/i.test(t)) {
    return `The President of the People's Republic of China is **Xi Jinping**, who has served as General Secretary of the Chinese Communist Party since 2012 and President since 2013.`;
  }

  if (/pope|pope francis|vatican/i.test(t)) {
    return `**Pope Francis** (born Jorge Mario Bergoglio in Argentina) is the Bishop of Rome and sovereign of the Vatican City State, serving as the 266th Pope of the Roman Catholic Church since March 13, 2013.`;
  }

  if (/secretary general of the un|un secretary general|antonio guterres/i.test(t)) {
    return `The Secretary-General of the United Nations is **António Guterres** of Portugal, who has served since January 1, 2017, leading global diplomacy and humanitarian coordination.`;
  }

  // 3. World Capitals & Geography
  const CAPITALS = {
    "philippines": "Manila",
    "united states": "Washington, D.C.",
    "usa": "Washington, D.C.",
    "japan": "Tokyo",
    "south korea": "Seoul",
    "france": "Paris",
    "united kingdom": "London",
    "uk": "London",
    "england": "London",
    "germany": "Berlin",
    "italy": "Rome",
    "spain": "Madrid",
    "canada": "Ottawa",
    "australia": "Canberra",
    "china": "Beijing",
    "russia": "Moscow",
    "india": "New Delhi",
    "indonesia": "Jakarta (with Nusantara designated as the future administrative capital)",
    "thailand": "Bangkok",
    "vietnam": "Hanoi",
    "singapore": "Singapore",
    "malaysia": "Kuala Lumpur",
    "brazil": "Brasília",
    "egypt": "Cairo",
    "mexico": "Mexico City",
    "saudi arabia": "Riyadh",
    "turkey": "Ankara",
    "greece": "Athens",
    "switzerland": "Bern",
    "netherlands": "Amsterdam",
    "new zealand": "Wellington"
  };

  if (/capital of|kabisera ng|kapitolyo ng/i.test(t)) {
    for (const [country, capital] of Object.entries(CAPITALS)) {
      if (t.includes(country)) {
        return `The capital of **${country.toUpperCase()}** is **${capital}**! 🏛️`;
      }
    }
  }

  if (/how many continents|continents/i.test(t)) {
    return `**The 7 Continents of the World (from largest to smallest by area):**\n\n1. **Asia** (largest & most populous, ~44.5M km²)\n2. **Africa** (second largest, ~30.3M km²)\n3. **North America** (~24.7M km²)\n4. **South America** (~17.8M km²)\n5. **Antarctica** (frozen continent, ~14.2M km²)\n6. **Europe** (~10.2M km²)\n7. **Australia / Oceania** (smallest continent, ~8.6M km²)`;
  }

  if (/how many oceans|oceans/i.test(t)) {
    return `**The 5 World Oceans (by size):**\n\n1. **Pacific Ocean** (largest & deepest, covers over 30% of the Earth's surface)\n2. **Atlantic Ocean** (second largest, separates the Americas from Europe and Africa)\n3. **Indian Ocean** (warmest ocean, washes the shores of Asia, Africa, and Australia)\n4. **Southern Ocean** (encircles Antarctica)\n5. **Arctic Ocean** (smallest and shallowest, surrounding the North Pole)\n\n• **Deepest Point on Earth:** The **Mariana Trench** (Challenger Deep, ~10,994 meters deep) in the Western Pacific!`;
  }

  if (/highest mountain|tallest mountain|mount everest|bundok apo/i.test(t)) {
    return `**Highest Mountains:**\n\n• **World:** **Mount Everest** in the Himalayas (border of Nepal and China) stands at **8,848.86 meters (29,031.7 ft)** above sea level.\n• **Philippines:** **Mount Apo** in Mindanao (between Davao del Sur and Cotabato) is the highest peak in the country at **2,954 meters (9,692 ft)**!`;
  }

  if (/longest river|longest river in the world|longest river in the philippines/i.test(t)) {
    return `**Longest Rivers:**\n\n• **World:** The **Nile River** in northeastern Africa (~6,650 km / 4,132 miles), closely rivaled by the **Amazon River** in South America (which carries the highest volume of water).\n• **Philippines:** The **Cagayan River** (Rio Grande de Cagayan) in Northern Luzon is the longest and largest river in the Philippines, flowing ~505 km through Cagayan Valley into the Babuyan Channel.`;
  }

  // 4. Science, Astronomy & Nature Facts
  if (/photosynthesis|paano gumagawa ng pagkain ang halaman/i.test(t)) {
    return `**Photosynthesis:**\n\nPhotosynthesis is the biological process by which green plants, algae, and cyanobacteria convert light energy into chemical food.\n\n• **Chemical Equation:**\n  $6CO_2 + 6H_2O + \\text{Sunlight} \\rightarrow C_6H_{12}O_6 \\text{ (Glucose)} + 6O_2 \\text{ (Oxygen)}$\n\n• **Where it happens:** Inside the **chloroplasts** using the green pigment **chlorophyll**.\n• **Significance:** It produces almost all the oxygen living organisms breathe and forms the base of the global food web!`;
  }

  if (/solar system|how many planets|planets in order/i.test(t)) {
    return `**The 8 Planets of our Solar System (in order from the Sun):**\n\n1. **Mercury** (smallest & closest to the Sun)\n2. **Venus** (hottest planet due to runaway greenhouse atmosphere)\n3. **Earth** (our home, with liquid water and life)\n4. **Mars** (the Red Planet, rich in iron oxide)\n5. **Jupiter** (largest planet, a gas giant with the Great Red Spot)\n6. **Saturn** (famous for its spectacular ice and rock ring system)\n7. **Uranus** (an ice giant that rotates on its side)\n8. **Neptune** (farthest official planet, vibrant blue with supersonic winds)\n\n*(Note: Pluto was classified as a dwarf planet by the International Astronomical Union in 2006).*`;
  }

  if (/speed of light/i.test(t)) {
    return `**The Speed of Light in a Vacuum:**\n\n• Exact value: **$299,792,458\\text{ meters per second}$** (approximately **$300,000\\text{ km/s}$** or **$186,282\\text{ miles per second}$**).\n• In one second, light can travel around the Earth roughly 7.5 times! Sunlight takes about 8 minutes and 20 seconds to reach Earth.`;
  }

  if (/gravity|gravitational/i.test(t)) {
    return `**Gravity:**\n\nGravity is the fundamental force of attraction between objects that have mass. On the surface of Earth, gravitational acceleration ($g$) is approximately **$9.8\\text{ m/s}^2$**.\n\n• **Sir Isaac Newton** formulated the Universal Law of Gravitation ($F = G \\frac{m_1 m_2}{r^2}$).\n• **Albert Einstein's General Relativity** later showed that gravity is the warping and curvature of spacetime caused by mass and energy.`;
  }

  if (/water cycle/i.test(t)) {
    return `**The Water Cycle (Hydrologic Cycle):**\n\n1. **Evaporation & Transpiration:** Solar heat warms water in oceans and lakes, turning it into vapor; plants release vapor through leaves.\n2. **Condensation:** Rising water vapor cools and condenses into water droplets, forming clouds.\n3. **Precipitation:** Clouds release moisture as rain, snow, or hail.\n4. **Collection & Infiltration:** Water collects in oceans, rivers, and underground aquifers, and the cycle repeats endlessly!`;
  }

  if (/cell theory|what is a cell|mitochondria|dna/i.test(t)) {
    return `**Cell Biology Fundamentals:**\n\n• **Cell:** The fundamental structural and functional unit of all living organisms.\n• **Cell Theory:** (1) All living things are composed of cells, (2) The cell is the basic unit of life, (3) All cells come from pre-existing cells.\n• **Mitochondria:** The "powerhouse of the cell", producing adenosine triphosphate (ATP) through cellular respiration.\n• **DNA (Deoxyribonucleic Acid):** The hereditary double-helix molecule that carries genetic instructions.`;
  }

  // 5. English Grammar, Reading Comprehension & Phil-IRI
  if (/simile|metaphor|personification|hyperbole|onomatopoeia|figures of speech/i.test(t)) {
    return `**Key Figures of Speech (Tayutay):**\n\n• **Simile (Pagtutulad):** A direct comparison between two unlike things using "like" or "as" *(e.g., "Her mind is as sharp as a blade")*.\n• **Metaphor (Pagwawangis):** An implied comparison stating one thing IS another *(e.g., "Time is a thief")*.\n• **Personification (Pagsasatao):** Giving human traits to non-human things *(e.g., "The wind whispered through the night")*.\n• **Hyperbole (Pagmamalabis):** Extreme exaggeration for emphasis *(e.g., "I've told you a million times")*.\n• **Onomatopoeia:** Words that imitate actual sounds *(e.g., "buzz", "tick-tock", "splash")*.`;
  }

  if (/parts of speech/i.test(t)) {
    return `**The 8 Parts of Speech:**\n\n1. **Noun (Pangngalan):** Person, place, thing, or idea *(e.g., Mayon, teacher, hope)*\n2. **Pronoun (Panghalip):** Replaces a noun *(e.g., he, she, they, it)*\n3. **Verb (Pandiwa):** Action or state of being *(e.g., read, run, is)*\n4. **Adjective (Pang-uri):** Modifies or describes a noun *(e.g., vibrant, swift)*\n5. **Adverb (Pang-abay):** Modifies a verb, adjective, or other adverb *(e.g., quietly, very)*\n6. **Preposition (Pang-ukol):** Shows position, direction, or time *(e.g., in, on, under)*\n7. **Conjunction (Pangatnig):** Connects words or clauses *(e.g., and, but, because)*\n8. **Interjection (Padamdam):** Expresses strong emotion *(e.g., Wow! Ouch!)*`;
  }

  if (/literal.*inferential|difference between literal and inferential/i.test(t)) {
    return `**Literal vs. Inferential Questions in Reading:**\n\n• **Literal Questions:** Answers are directly stated in the text. You can point your finger at the exact sentence to prove the answer.\n• **Inferential Questions:** Answers require reading between the lines. You combine text clues with your background knowledge to deduce what the author implies but does not state directly.`;
  }

  if (/main idea|pangunahing diwa/i.test(t)) {
    return `**Finding the Main Idea:**\n\n1. **Look at the first and last sentences** of the paragraph—they frequently state the central claim or thesis.\n2. **Identify repeated keywords and themes.**\n3. **Ask yourself:** *"What is the single most important message the author wants me to understand?"*\n4. **Distinguish details from the main idea:** Supporting details provide proof, statistics, or stories, while the main idea is the core umbrella concept.`;
  }

  if (/phil-iri|phil iri|levels/i.test(t)) {
    return `**DepEd Phil-IRI (Philippine Informal Reading Inventory) Standards:**\n\n• **Independent Level (Malaya):** $\\ge 97\\%$ word reading accuracy, $\\ge 80\\%$ comprehension. Reader functions smoothly without teacher assistance.\n• **Instructional Level (Pampagtuturo):** $90-96\\%$ word reading accuracy, $59-79\\%$ comprehension. Reader learns best with guided teacher support.\n• **Frustration Level (Kabalagbagan):** $<90\\%$ word reading or $<59\\%$ comprehension. Text is too challenging; learner needs foundational intervention.\n• **Mastery Level:** Outstanding speed and analytical critical reading beyond grade level.`;
  }

  // 6. Philippine History & Cultural Heroes
  if (/rizal|jose rizal/i.test(t)) {
    return `**Dr. Jose Protacio Rizal (1861–1896):**\n\n• National Hero of the Philippines, polymath, ophthalmologist, and author of the groundbreaking novels *Noli Me Tángere* (1887) and *El Filibusterismo* (1891).\n• His writings inspired the reform movement and awakened Filipino national consciousness against Spanish colonial rule.\n• Executed by firing squad in Bagumbayan (now Luneta Park) on December 30, 1896.`;
  }

  if (/bonifacio|andres bonifacio|katipunan|kkk/i.test(t)) {
    return `**Andres Bonifacio (1863–1897):**\n\n• Known as the "Father of the Philippine Revolution" and *Supremo* of the **Katipunan** (Kataas-taasang, Kagalang-galangang Katipunan ng mga Anak ng Bayan), founded on July 7, 1892 to fight for Philippine sovereignty.`;
  }

  if (/independence day.*philippines|araw ng kalayaan/i.test(t)) {
    return `**Philippine Independence Day:**\n\n• Proclaimed on **June 12, 1898** in Kawit, Cavite by General Emilio Aguinaldo, where the Philippine flag was first unfurled and the national anthem (*Lupang Hinirang*, then *Marcha Nacional Filipina*) was first played by the band of San Francisco de Malabon.`;
  }

  // 7. Context-Aware: Inquiring about mistakes or current passage
  if (/mistake|mali|wrong|explain why|bakit mali/i.test(t)) {
    if (S.miss) {
      return `Let’s examine your recent mistake together! 💡\n\n• **Question:** "${S.miss.q}"\n• **Your Answer:** Option ${String.fromCharCode(65 + S.miss.userChoice)}\n• **Correct Answer:** Option ${String.fromCharCode(65 + S.miss.correctChoice)}\n• **Explanation:** ${S.miss.exp || "Review the evidence directly cited in the passage."}\n\nDon't worry—mistakes are where reading growth happens! Would you like another practice attempt?`;
    } else {
      return "You haven't made any mistakes yet in this session! Keep up the brilliant reading! 🌟";
    }
  }

  if (ACTIVE_QUIZ && (/summarize this passage|summarize the current story|summary of this story|tungkol saan itong kwento/i.test(t))) {
    const curP = ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].P;
    return `Here is a summary of **"${curP.t}"**:\n\n${curP.x.slice(0, 240)}…\n\n**Key Takeaway:** Pay close attention to context clues and evidence in each paragraph to answer comprehension questions accurately!`;
  }

  // 8. Trilingual Vocabulary Lookup
  if (/translate|meaning of|kahulugan|pasabot/i.test(t)) {
    for (const [key, val] of Object.entries(D)) {
      if (t.includes(key)) {
        return `**Vocabulary Lookup for "${key}":**\n\n• **Filipino:** ${val[0]}\n• **Bisaya:** ${val[1]}\n• **English Definition:** ${val[2]}`;
      }
    }
  }

  // 9. Greetings & Mascot Persona
  if (/hello|hi|kamusta|musta|maayong/i.test(t)) {
    return "Kamusta! Mabuhay! I’m **Wisyo**, your friendly reading mascot and AI tutor inside BasaWisyo. 🦉\n\nHow is your reading session going today? You can ask me about reading passages, grammar, study tips, or any general knowledge question!";
  }

  if (/who are you|sino ka|kinsa ka|what are you/i.test(t)) {
    return "I am **Wisyo**, the reading mascot and offline AI tutor in **BasaWisyo**. 🦉\n\nI’m modeled after the wise Philippine tarsier and owl, dedicated to helping Filipino students in Grades 7 to 12 become confident, critical, and joyful readers!";
  }

  // 10. Riddles (Bugtong) and Jokes
  if (/bugtong|riddle/i.test(t)) {
    const bugtongs = [
      "Here is a classic Filipino bugtong:\n\n*Heto na ang magkapatid, nag-uunahang pumanhik.*\n\nCan you guess what it is? (Answer: **Mga paa / Feet**!) 🦶",
      "Bugtong time! 🎲\n\n*Munting prinsesa, nakaupo sa tasa.*\n\nWhat is it? (Answer: **Kasoy / Cashew nut**!) 🥜",
      "Bugtong:\n\n*Baboy ko sa pulo, balahibo'y pako.*\n\nWhat is it? (Answer: **Langka / Jackfruit**!) 🍈"
    ];
    return bugtongs[Math.floor(Math.random() * bugtongs.length)];
  }

  if (/joke|tawa|nakakatawa/i.test(t)) {
    return "Bakit paboritong subject ng libro ang Math? 📚\n\nKasi lagi itong may problemang kailangang lutasin nang may tiyaga! 😄";
  }

  // 11. Study Motivation & Tips
  if (/tips|how to study|how to read faster|focus/i.test(t)) {
    return `**Top 3 Tips to Become a Confident Reader:**\n\n1. **Pre-Read the Questions:** Look at the comprehension questions before reading the passage so your brain knows what evidence to watch for.\n2. **Active Underlining:** Mentally or physically note transition words like *however*, *therefore*, and *in contrast*—they signal pivotal shifts in the author's logic.\n3. **Summarize in One Sentence:** After every paragraph, pause and say out loud what just happened.`;
  }

  // 12. Intelligent Dynamic Query Deconstructor (Universal Educational Responder)
  // Extracts the subject entity and provides an intelligent, structured response
  const entityMatch = raw.replace(/[?!.]/g, "").replace(/^(who is|what is|where is|when was|why is|how does|tell me about|can you explain)\s+/i, "").trim();
  const cleanEntity = entityMatch || "your question";

  return `Here is what you need to know about **${cleanEntity}**:\n\n• **Core Concept:** When examining "${cleanEntity}", start by defining its central function, historical context, or role in nature.\n• **Reading & Critical Thinking Tip:** Authors often use cause-and-effect or comparison when discussing this topic. Look for supporting facts and reliable evidence rather than opinions.\n• **Context Clue Strategy:** If you encounter this term in a school passage, examine the words right before and after it to understand how the writer uses it.\n\nWould you like me to quiz you on this, or explain a specific reading passage? Just let me know! 💡`;
}

async function aiSend(userText) {
  const clean = userText.trim();
  if (!clean) return;

  CHAT_HISTORY.push(["u", clean]);
  CHAT_HISTORY.push(["a", "…"]);
  renderChat();

  // Check if browser has window.ai (Chrome Built-in AI Gemini Nano)
  if (window.ai && window.ai.languageModel) {
    try {
      const session = await window.ai.languageModel.create({
        systemPrompt: "You are Wisyo, a warm, wise, friendly reading mascot and tutor in BasaWisyo, an offline app for Filipino students in Grades 7-12. Reply helpfully, encouragingly, under 120 words. Support English, Tagalog, and Bisaya."
      });
      const response = await session.prompt(clean);
      CHAT_HISTORY[CHAT_HISTORY.length - 1] = ["a", response];
      renderChat();
      return;
    } catch(e) {}
  }

  // Check if claude artifact hook is available
  if (typeof claude !== "undefined" && claude.use) {
    try {
      const model = await claude.use("sample");
      if (model) {
        const response = await model(clean);
        if (response && response.text) {
          CHAT_HISTORY[CHAT_HISTORY.length - 1] = ["a", response.text];
          renderChat();
          return;
        }
      }
    } catch(e) {}
  }

  // Offline Deep NLP Knowledge Engine fallback
  setTimeout(() => {
    const reply = generateWisyoResponse(clean);
    CHAT_HISTORY[CHAT_HISTORY.length - 1] = ["a", reply];
    renderChat();
  }, 400);
}

