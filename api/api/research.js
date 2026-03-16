export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { company, role } = req.body;
  if (!company || !role) return res.status(400).json({ error: "missing params" });

  try {
    const queries = [
      `${company} ${role} 面经`,
      `${company} ${role} 面试题 site:nowcoder.com OR site:zhihu.com`,
    ];

    // Run searches in parallel
    const searchResults = await Promise.allSettled(
      queries.map(q =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q, gl: "cn", hl: "zh-cn", num: 6 }),
        }).then(r => r.json())
      )
    );

    const results = [];
    for (const r of searchResults) {
      if (r.status === "fulfilled" && r.value.organic) {
        for (const item of r.value.organic) {
          if (!results.find(x => x.link === item.link)) {
            results.push({
              title: item.title,
              link: item.link,
              snippet: item.snippet || "",
              source: item.displayLink || item.link,
            });
          }
        }
      }
    }

    const top = results.slice(0, 8);

    if (top.length === 0) {
      return res.status(200).json({ results: [], summary: null });
    }

    const snippets = top.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}`).join("\n\n");

    const summaryRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `根据以下「${company} ${role}」的面经搜索结果，总结5-7个最常被考察的问题或知识点。\n\n${snippets}\n\n返回JSON（不含markdown）：{"questions":["考察点1","考察点2"],"tips":"一句话备考建议"}`,
        }],
      }),
    });

    const summaryData = await summaryRes.json();
    const summaryText = summaryData?.choices?.[0]?.message?.content || "";

    let summary = null;
    try {
      summary = JSON.parse(summaryText.replace(/```json|```/g, "").trim());
    } catch(e) {}

    res.status(200).json({ results: top, summary });
  } catch (e) {
    console.error("Research error:", e);
    res.status(500).json({ error: e.message });
  }
}