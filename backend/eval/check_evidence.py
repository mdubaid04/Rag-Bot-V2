import json, re
from pypdf import PdfReader

norm = lambda s: re.sub(r"\s+", " ", s).lower().strip()
text = norm("\n".join(p.extract_text() or "" for p in PdfReader("eval/attention.pdf").pages))

for item in json.load(open("eval/testset.json", encoding="utf-8")):
    print("OK  " if norm(item["evidence"]) in text else "MISS", item["evidence"])










