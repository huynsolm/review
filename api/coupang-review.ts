import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function extract(text: string) {
const safe = (text || "").trim();

// 느슨한 파싱: 키워드가 없으면 전체를 리뷰본문으로 저장
const pros =
safe.match(/장점[\s\S]*?(?=단점|추천대상|리뷰본문|$)/)?.[0]?.trim() || "";
const cons =
safe.match(/단점[\s\S]*?(?=추천대상|리뷰본문|$)/)?.[0]?.trim() || "";
const target =
safe.match(/추천대상[\s\S]*?(?=리뷰본문|$)/)?.[0]?.trim() || "";
const body =
safe.match(/리뷰본문[\s\S]*$/)?.[0]?.trim() || safe || "리뷰 내용 없음";

const charCount = body.replace(/\s/g, "").length;
return { pros, cons, target, body, charCount };
}

function rt(content: string) {
return [{ type: "text", text: { content: content || "" } }];
}

export default async function handler(req: any, res: any) {
// 헬스체크: 브라우저에서 열었을 때 404 대신 상태 확인 가능
if (req.method === "GET") {
return res.status(200).json({
ok: true,
message: "coupang-review endpoint alive",
needs: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
});
}

if (req.method !== "POST") {
return res.status(405).json({ ok: false, error: "Method Not Allowed" });
}

try {
if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
return res.status(500).json({
ok: false,
error: "Missing NOTION_TOKEN or NOTION_DATABASE_ID",
});
}

const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

const {
product_name,
purchase_date,
category,
rating,
source_url,
generated_text,
status,
} = body;

const parsed = extract(generated_text || "");

await notion.pages.create({
parent: { database_id: process.env.NOTION_DATABASE_ID },
properties: {
"상품명": { title: rt(product_name || "미지정") },
"구매일": purchase_date ? { date: { start: purchase_date } } : { date: null },
"카테고리": category ? { select: { name: category } } : { select: null },
"장점": { rich_text: rt(parsed.pros.slice(0, 1900)) },
"단점": { rich_text: rt(parsed.cons.slice(0, 1900)) },
"추천대상": { rich_text: rt(parsed.target.slice(0, 1900)) },
"리뷰본문": { rich_text: rt(parsed.body.slice(0, 1900)) },
"글자수": { number: parsed.charCount || 0 },
"평점": typeof rating === "number" ? { number: rating } : { number: null },
"원문링크": source_url ? { url: source_url } : { url: null },
"작성상태": { select: { name: status || "draft" } },
},
});

return res.status(200).json({ ok: true });
} catch (e: any) {
return res.status(500).json({ ok: false, error: e?.message || String(e) });
}
}
