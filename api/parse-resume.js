import mammoth from "mammoth";

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { fileData, fileName, rawText } = req.body;

  try {
    let text = "";

    if (rawText && rawText.trim().length > 50) {
      // PDF case: text already extracted by browser, just return it directly
      text = rawText.trim();
    } else if (fileData && fileName) {
      const lower = fileName.toLowerCase();
      const buffer = Buffer.from(fileData, "base64");

      if (lower.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        text = (result.value || "").trim();
      } else if (lower.endsWith(".doc")) {
        return res.status(400).json({ error: "请将 .doc 文件另存为 .docx 后上传" });
      } else {
        return res.status(400).json({ error: "请上传 PDF 或 Word(.docx) 文件" });
      }
    }

    if (!text || text.length < 50) {
      return res.status(400).json({ error: "文件内容无法读取，请直接粘贴文字" });
    }

    res.status(200).json({ text });
  } catch (e) {
    console.error("parse-resume error:", e);
    res.status(500).json({ error: "解析失败：" + e.message });
  }
}