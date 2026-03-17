export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { company, role, companyEn } = req.body;
  if (!company || !role) return res.status(400).json({ error: "missing params" });

  const companyQ = companyEn ? company + " " + companyEn : company;

  const queries = [
    companyQ + " " + role + " 面经",
    company + " " + role + " 面试 site:nowcoder.com OR site:zhihu.com OR site:maimai.cn",
  ];

  try {
    const searchResults = await Promise.allSettled(
      queries.map(q =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q, gl: "cn", hl: "zh-cn", num: 8 }),
        }).then(r => r.json())
      )
    );

    const seen = new Set();
    const results = [];

    for (const r of searchResults) {
      if (r.status !== "fulfilled") continue;
      const organic = r.value.organic || [];
      for (const item of organic) {
        const link = item.link || "";

        // Skip file downloads
        if (/\.(xlsx|xls|pdf|doc|docx|ppt|pptx)(\?|$)/i.test(link)) continue;
        // Skip job listing pages
        if (/recruit|\/jobs\/|\/careers\/|zhaopin|lagou|liepin|51job|boss\.zhipin|job\.toutiao|job\.bytedance/i.test(link)) continue;
        // Skip clearly unrelated domains
        if (/gov\.cn|edu\.cn|finance\.sina|stock\.|vip\.|\.gov\.|itu\.int|yunfu\.|wuchang\./i.test(link)) continue;
        // Skip if title has no overlap with company or role keywords
        const title = (item.title || "").toLowerCase();
        const hasRelevance = [company, role, companyEn || ""].some(kw =>
          kw && title.includes(kw.toLowerCase().slice(0, 2))
        );
        if (!hasRelevance) continue;

        if (seen.has(link)) continue;
        seen.add(link);
        results.push({
          title: item.title || "",
          link,
          snippet: item.snippet || "",
          source: item.displayLink || link,
        });
      }
    }

    const top = results.slice(0, 8);

    if (top.length === 0) {
      return res.status(200).json({ results: [], summary: null });
    }

    const snippets = top.map((r, i) => "[" + (i+1) + "] " + r.title + "\n" + r.snippet).join("\n\n");

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
          content: "根据以下「" + company + " " + role + "」的面经搜索结果，总结5-7个最常被考察的问题或知识点。\n\n" + snippets + "\n\n返回JSON（不含markdown）：{\"questions\":[\"考察点1\",\"考察点2\"],\"tips\":\"一句话备考建议\"}",
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