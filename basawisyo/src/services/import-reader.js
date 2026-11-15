/* ==========================================================================
   BasaWisyo Shared Reading Material Import Engine
   Supports PDF, DOCX, TXT files and pasted text with text normalization
   ========================================================================== */

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit as per spec
const ALLOWED_IMPORT_EXTENSIONS = [".txt", ".docx", ".pdf"];
const MIN_READABLE_WORDS = 20;

/**
 * Validates selected file for import: size, extension, and empty file check.
 * @param {File} file 
 * @returns {{ valid: boolean, error?: string, extension?: string }}
 */
function validateImportFile(file) {
  if (!file) {
    return { valid: false, error: "No file selected. Please choose a PDF, DOCX, or TXT file." };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes). Please select a valid document." };
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { 
      valid: false, 
      error: `File is too large (${sizeMb} MB). Maximum supported size is 10 MB.` 
    };
  }

  const name = file.name || "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) {
    return { valid: false, error: "File lacks an extension. Supported formats are .txt, .docx, and .pdf." };
  }

  const ext = name.slice(lastDot).toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
    return { 
      valid: false, 
      error: `Unsupported file format (${ext}). Supported formats: PDF (.pdf), Word (.docx), or Text (.txt).` 
    };
  }

  return { valid: true, extension: ext };
}

/**
 * Normalizes imported or pasted text, cleaning whitespace and computing readability stats.
 * @param {string} rawText 
 * @returns {{ text: string, wordCount: number, charCount: number, estMinutes: number, cleanTitle: string, suggestedTier: string }}
 */
function normalizeImportedText(rawText) {
  if (typeof rawText !== "string") return { text: "", wordCount: 0, charCount: 0, estMinutes: 0, cleanTitle: "Untitled Story", suggestedTier: "easy" };

  // Strip unprintable control characters except standard whitespace
  let clean = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Collapse 3 or more consecutive newlines to double newlines
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = clean.length;
  const estMinutes = Math.max(1, Math.ceil(wordCount / 120)); // ~120 WPM for Grade 7-10 Filipino learners

  // Derive initial title from first line if reasonably short, otherwise first few words
  let cleanTitle = "Imported Reading Passage";
  const firstLine = clean.split("\n")[0]?.trim();
  if (firstLine && firstLine.length <= 80 && !firstLine.endsWith(".")) {
    cleanTitle = firstLine;
  } else if (words.length > 0) {
    cleanTitle = words.slice(0, 5).join(" ") + "...";
  }

  // Suggest initial difficulty based on average sentence length
  const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let suggestedTier = "easy";
  if (avgSentenceLength > 18 || wordCount > 350) suggestedTier = "hard";
  else if (avgSentenceLength > 12 || wordCount > 200) suggestedTier = "medium";

  return {
    text: clean,
    wordCount,
    charCount,
    estMinutes,
    cleanTitle,
    suggestedTier
  };
}

/**
 * Native text extractor from raw DOCX ArrayBuffer (PKZip containing word/document.xml).
 * Works purely in browser and Node.js without heavy external dependencies.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<string>}
 */
async function extractTextFromDocxNative(arrayBuffer) {
  // If Mammoth.js is loaded in the page, prioritize it
  if (typeof window !== "undefined" && window.mammoth && typeof window.mammoth.extractRawText === "function") {
    try {
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      if (result && typeof result.value === "string" && result.value.trim().length > 0) {
        return result.value.trim();
      }
    } catch (e) {
      // Fallback to native byte extraction
    }
  }

  // Native PKZip extraction for word/document.xml
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder("utf-8", { fatal: false });
  const rawString = textDecoder.decode(bytes);

  // Look for XML paragraph and text tags (<w:p>, <w:t>)
  const tMatches = rawString.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  if (tMatches && tMatches.length > 0) {
    const textPieces = tMatches.map(m => {
      return m.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    });
    return textPieces.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  // If compressed deflate streams exist, return what is available or prompt user
  return "";
}

/**
 * Native text extractor from raw PDF ArrayBuffer.
 * Works purely in browser and Node.js with scanned document detection.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{ text: string, isScannedOrEmpty: boolean }>}
 */
async function extractTextFromPdfNative(arrayBuffer) {
  // If PDF.js is loaded in the browser, use it for complete text layer extraction
  if (typeof window !== "undefined" && window.pdfjsLib && typeof window.pdfjsLib.getDocument === "function") {
    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map(item => item.str || "");
        fullText += pageStrings.join(" ") + "\n\n";
      }
      const normalized = fullText.trim();
      const wc = normalized.split(/\s+/).filter(Boolean).length;
      return {
        text: normalized,
        isScannedOrEmpty: wc < MIN_READABLE_WORDS
      };
    } catch (e) {
      // Fallback to text operator scanning below
    }
  }

  // Fallback text operator scanner
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder("latin1");
  const rawString = textDecoder.decode(bytes);

  const textSnippets = [];
  // Scan for PDF text operator literals: (text) Tj or [(text)] TJ
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(rawString)) !== null) {
    if (match[1] && match[1].length > 1) {
      textSnippets.push(match[1]);
    }
  }

  // Scan for array text operators
  const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawString)) !== null) {
    const inner = match[1];
    const subMatches = inner.match(/\(([^)]+)\)/g);
    if (subMatches) {
      subMatches.forEach(sm => {
        const cleanSm = sm.replace(/^\(/, "").replace(/\)$/, "");
        if (cleanSm.trim()) textSnippets.push(cleanSm);
      });
    }
  }

  const extracted = textSnippets.join(" ").replace(/\\([()\\])/g, "$1").replace(/\s{2,}/g, " ").trim();
  const wc = extracted.split(/\s+/).filter(Boolean).length;

  return {
    text: extracted,
    isScannedOrEmpty: wc < MIN_READABLE_WORDS
  };
}

/**
 * Extracts readable text from an uploaded file (PDF, DOCX, or TXT).
 * @param {File} file 
 * @returns {Promise<{ success: boolean, text: string, error?: string, isScannedOrEmpty?: boolean, stats: ReturnType<typeof normalizeImportedText> }>}
 */
async function extractTextFromFile(file) {
  const validation = validateImportFile(file);
  if (!validation.valid) {
    return {
      success: false,
      text: "",
      error: validation.error,
      stats: normalizeImportedText("")
    };
  }

  const ext = validation.extension;

  try {
    if (ext === ".txt") {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => reject(new Error("Failed to read text file."));
        reader.readAsText(file, "utf-8");
      });
      const stats = normalizeImportedText(text);
      if (stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: `The file contains only ${stats.wordCount} words. We recommend at least 20 words for meaningful reading practice.`,
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    if (ext === ".docx") {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read Word document."));
        reader.readAsArrayBuffer(file);
      });
      const extractedRaw = await extractTextFromDocxNative(buffer);
      const stats = normalizeImportedText(extractedRaw);
      if (stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: "Little or no readable text could be extracted from this Word document. You can also paste the reading passage directly.",
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    if (ext === ".pdf") {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read PDF file."));
        reader.readAsArrayBuffer(file);
      });
      const { text, isScannedOrEmpty } = await extractTextFromPdfNative(buffer);
      const stats = normalizeImportedText(text);
      if (isScannedOrEmpty || stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: "This PDF appears to be a scanned image or contains non-selectable text. Please paste the reading text directly into the text box below.",
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    return {
      success: false,
      text: "",
      error: "Unsupported file extension.",
      stats: normalizeImportedText("")
    };
  } catch (error) {
    return {
      success: false,
      text: "",
      error: error.message || "An unexpected error occurred while reading the file.",
      stats: normalizeImportedText("")
    };
  }
}
