import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN! });

function extract(text: string) {
// 아주 단순 파서 (필요시 너 포맷에 맞게 조정)
const pros = (text.match(/장점[\s\S]*?(?=단점|추천대상|리뷰본문|$)/)?.[0] || "").trim();
const cons = (text.match(/단점[\s\S]*?(?=추천대상|리뷰본문|$)/)?.[0] || "").trim();
const target = (text.match(/추천대상[\s\S]*?(?=리뷰본문|$)/)?.[0] || "").trim();
const body = (text.match(/리뷰본문[\s\S]*$/)?.[0] || text).trim();
const charCount = body.replace(/\s/g, "").length;
return { pros, cons, target, body, charCount };
}

export default async function handler(req, res) {
if (req.method !== "POST") return res.status(405).json({ ok: false });

try {
const {
product_name,
purchase_date,
category,
rating,
source_url,
generated_text // OpenClaw가 생성한 전체 텍스트
} = req.body;

const parsed = extract(generated_text || "");

await notion.pages.create({
parent: { database_id: process.env.NOTION_DATABASE_ID! },
properties: {
"상품명": { title: [{ text: { content: product_name || "미지정" } }] },
"구매일": purchase_date ? { date: { start: purchase_date } } : undefined,
"카테고리": category ? { select: { name: category } } : undefined,
"장점": { rich_text: [{ text: { content: parsed.pros.slice(0, 1900) } }] },
"단점": { rich_text: [{ text: { content: parsed.cons.slice(0, 1900) } }] },
"추천대상": { rich_text: [{ text: { content: parsed.target.slice(0, 1900) } }] },
"리뷰본문": { rich_text: [{ text: { content: parsed.body.slice(0, 1900) } }] },
"글자수": { number: parsed.charCount },
"평점": typeof rating === "number" ? { number: rating } : undefined,
"원문링크": source_url ? { url: source_url } : undefined,
"작성상태": { select: { name: "draft" } }
}
});

return res.status(200).json({ ok: true });
} catch (e: any) {
return res.status(500).json({ ok: false, error: String(e?.message || e) });
}
}
