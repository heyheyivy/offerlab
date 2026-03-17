import mammoth from "mammoth";

export const maxDuration = 30;

// Minimal PDF text extractor — no dependencies, reads raw text streams
function extractPdfTextRaw(buffer) {
  const str = buffer.toString("latin1");
  const texts = [];

  // Extract text from BT...ET blocks (PDF text objects)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(str)) !== null) {
    const block = btMatch[1];
    // Match (text) Tj, [(text)] TJ patterns
    const tjRegex = /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const raw = tjMatch[1] || tjMatch[2] || "";
      // Decode basic PDF string escapes
      const decoded = raw
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
      texts.push(decoded);
    }
  }

  return texts.join(" ").replace(/\s+/g, " ").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { fileData, fileName } = req.body;
  if (!fileData || !fileName) return res.status(400).json({ error: "missing file" });

  try {
    const buffer = Buffer.from(fileData, "base64");
    const lower = fileName.toLowerCase();
    let text = "";

    if (lower.endsWith(".pdf")) {
      text = extractPdfTextRaw(buffer);
    } else if (lower.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else if (lower.endsWith(".doc")) {
      return res.status(400).json({ error: "请将 .doc 文件另存为 .docx 后上传" });
    } else {
      return res.status(400).json({ error: "请上传 PDF 或 Word(.docx) 文件" });
    }

    if (!text || text.trim().length < 30) {
      return res.status(400).json({ error: "文件内容无法读取，请直接粘贴文字" });
    }

    res.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error("parse-resume error:", e);
    res.status(500).json({ error: "解析失败：" + e.message });
  }
}