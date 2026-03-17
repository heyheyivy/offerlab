import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { fileData, fileName } = req.body;
  if (!fileData || !fileName) return res.status(400).json({ error: "missing file" });

  try {
    const buffer = Buffer.from(fileData, "base64");
    const lower = fileName.toLowerCase();
    let text = "";

    if (lower.endsWith(".pdf")) {
      const data = await pdfParse(buffer);
      text = data.text || "";
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