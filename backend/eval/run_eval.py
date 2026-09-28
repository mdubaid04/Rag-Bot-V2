"""
RAG retrieval eval: hit-rate@k across chunk sizes.

Run from the backend/ folder:
    uv add pypdf                                  # one time
    uv run python eval/run_eval.py eval/attention.pdf

What it does:
1. Splits the paper's text with different chunk sizes and upserts each
   into its OWN Pinecone namespace (eval_cs500, eval_cs1000, ...).
   Your main bot data is never touched.
2. For every question in testset.json, retrieves top-k chunks.
3. A "hit" = the `evidence` phrase appears in any retrieved chunk.
4. Prints a table and writes eval/results.md
"""
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.append(str(HERE.parent))  # so `import vector_store` works

from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from vector_store import INDEX_NAME, embeddings, pc

TESTSET = HERE / "testset.json"   # rename this if your file is tester.json
CHUNK_SIZES = [500, 1000]         # 1000 = your current bot setting
K_VALUES = [1, 3, 5]


def norm(text: str) -> str:
    """Lowercase + collapse whitespace so PDF line breaks don't break matching."""
    return re.sub(r"\s+", " ", text).lower().strip()


def load_pdf_text(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def namespace_has_data(ns: str) -> bool:
    stats = pc.Index(INDEX_NAME).describe_index_stats()
    info = stats.namespaces.get(ns)
    return bool(info and info.vector_count > 0)


def get_store(ns: str) -> PineconeVectorStore:
    return PineconeVectorStore(
        index_name=INDEX_NAME, embedding=embeddings, namespace=ns
    )


def ingest(text: str, chunk_size: int, ns: str) -> None:
    if namespace_has_data(ns):
        print(f"[skip] {ns} already has data")
        return
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_size // 5,  # same 20% ratio as your 1000/200
        add_start_index=True,
    )
    docs = splitter.create_documents([text])
    print(f"[ingest] {ns}: {len(docs)} chunks")
    get_store(ns).add_documents(docs)
    time.sleep(10)  # Pinecone is eventually consistent


def hit_rate(store: PineconeVectorStore, testset: list, k: int):
    retriever = store.as_retriever(search_kwargs={"k": k})
    hits, misses = 0, []
    for item in testset:
        chunks = retriever.invoke(item["question"])
        joined = norm(" ".join(c.page_content for c in chunks))
        if norm(item["evidence"]) in joined:
            hits += 1
        else:
            misses.append(item["question"])
    return hits / len(testset), misses


def main() -> None:
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else str(HERE / "attention.pdf")
    testset = json.load(open(TESTSET, encoding="utf-8"))
    text = load_pdf_text(pdf_path)
    print(f"PDF text length: {len(text)} chars | {len(testset)} questions")

    rows, all_misses = [], {}
    for cs in CHUNK_SIZES:
        ns = f"eval_cs{cs}"
        ingest(text, cs, ns)
        store = get_store(ns)
        for k in K_VALUES:
            rate, misses = hit_rate(store, testset, k)
            rows.append((cs, k, rate))
            all_misses[(cs, k)] = misses
            print(f"chunk_size={cs} top_k={k} -> hit-rate={rate:.0%}")

    # results.md
    lines = [
        "# RAG Retrieval Eval",
        "",
        f"Test set: {len(testset)} questions. Hit = evidence phrase found in top-k chunks.",
        "",
        "| Chunk size | Top-k | Hit-rate |",
        "|-----------:|------:|---------:|",
    ]
    for cs, k, rate in rows:
        lines.append(f"| {cs} | {k} | {rate:.0%} |")
    (HERE / "results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nSaved {HERE / 'results.md'}")

    # Show misses for the most generous config so you can fix bad evidence phrases
    cs, k = max(CHUNK_SIZES), max(K_VALUES)
    if all_misses[(cs, k)]:
        print(f"\nStill missed at chunk_size={cs}, top_k={k} "
              "(check these evidence phrases against the PDF text):")
        for q in all_misses[(cs, k)]:
            print(" -", q)


if __name__ == "__main__":
    main()