// src/pages/UploadPage.jsx
import { useState, useRef, useCallback } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  File,
  Loader2,
  FileText,
} from "lucide-react";
import { docsAPI } from "@/lib/Api";
import toast from "react-hot-toast";

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      return ["pdf", "docx"].includes(ext);
    });
    if (valid.length !== incoming.length) {
      toast.error("Only .pdf and .docx files are supported");
    }
    setFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({
        file: f,
        id: `${Date.now()}-${Math.random()}`,
        status: "pending",
      })),
    ]);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    processFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (id) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setResults([]);
    const uploadResults = [];
    for (const { file, id } of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await docsAPI.uploadFile(formData);
        uploadResults.push({
          id,
          name: file.name,
          success: true,
          chunks: res.data.processed_chunks,
        });
      } catch (e) {
        uploadResults.push({
          id,
          name: file.name,
          success: false,
          error: e.response?.data?.detail || "Upload failed",
        });
      }
    }
    setResults(uploadResults);
    const succeeded = uploadResults.filter((r) => r.success).length;
    const failed = uploadResults.filter((r) => !r.success).length;
    if (succeeded)
      toast.success(`${succeeded} file${succeeded > 1 ? "s" : ""} uploaded!`);
    if (failed) toast.error(`${failed} file${failed > 1 ? "s" : ""} failed`);
    setFiles([]);
    setUploading(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background:
          "radial-gradient(ellipse at 50% 0%, #0a2a2a 0%, #071a1a 40%, #050f0f 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Spotlight */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "320px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,200,180,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,200,180,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,180,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1.1rem 2rem",
          borderBottom: "1px solid rgba(0,200,180,0.12)",
          background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(8px)",
          position: "relative",
          zIndex: 2,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
            marginRight: "0.5rem",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00c8b0, #0096a0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <span
            style={{
              color: "#e0f7f5",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.02em",
            }}
          >
            RAG<span style={{ color: "#00c8b0" }}>mind</span>
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "20px",
            background: "rgba(0,200,180,0.25)",
          }}
        />

        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Upload size={15} color="rgba(0,200,180,0.7)" strokeWidth={2} />
          <h2
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "#c8eae8",
              margin: 0,
            }}
          >
            Upload Documents
          </h2>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "2rem 1.5rem",
          position: "relative",
          zIndex: 1,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(0,200,180,0.2) transparent",
        }}
      >
        <div
          style={{
            maxWidth: "680px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Page description */}
          <p
            style={{
              color: "rgba(180,220,215,0.5)",
              fontSize: "0.9rem",
              margin: 0,
            }}
          >
            Add PDF or Word documents to your RAG knowledge base
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#00c8b0" : "rgba(0,200,180,0.25)"}`,
              background: dragOver
                ? "rgba(0,200,180,0.07)"
                : "rgba(255,255,255,0.02)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "3.5rem 2rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: dragOver
                  ? "rgba(0,200,180,0.15)"
                  : "rgba(0,200,180,0.08)",
                border: "1px solid rgba(0,200,180,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload
                size={24}
                color={dragOver ? "#00c8b0" : "rgba(0,200,180,0.5)"}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontWeight: 600,
                  color: "#c8eae8",
                  margin: "0 0 4px",
                  fontSize: "1rem",
                }}
              >
                {dragOver ? "Drop files here" : "Drag & drop files"}
              </p>
              <p
                style={{
                  color: "rgba(180,220,215,0.5)",
                  fontSize: "0.88rem",
                  margin: 0,
                }}
              >
                or click to browse ·{" "}
                <span style={{ color: "#00c8b0", fontWeight: 600 }}>.pdf</span>{" "}
                and{" "}
                <span style={{ color: "#00c8b0", fontWeight: 600 }}>.docx</span>{" "}
                only
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(0,200,180,0.15)",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "0.75rem 1.25rem",
                  borderBottom: "1px solid rgba(0,200,180,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#c8eae8",
                  }}
                >
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={() => setFiles([])}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(180,220,215,0.45)",
                    fontSize: "0.8rem",
                    fontFamily: "inherit",
                  }}
                >
                  Clear all
                </button>
              </div>
              {files.map(({ file, id }) => (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.8rem 1.25rem",
                    borderBottom: "1px solid rgba(0,200,180,0.07)",
                  }}
                >
                  <FileText
                    size={16}
                    color="rgba(0,200,180,0.7)"
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#c8eae8",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "rgba(180,220,215,0.4)",
                        margin: 0,
                      }}
                    >
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      color: "rgba(180,220,215,0.4)",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #00c8b0, #00a896)",
              color: "white",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              cursor: !files.length || uploading ? "not-allowed" : "pointer",
              opacity: !files.length || uploading ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "opacity 0.2s",
              fontFamily: "inherit",
            }}
          >
            {uploading ? (
              <>
                <Loader2
                  size={16}
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Uploading & Indexing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload to Knowledge Base
              </>
            )}
          </button>

          {/* Upload results */}
          {results.length > 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(0,200,180,0.15)",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "0.75rem 1.25rem",
                  borderBottom: "1px solid rgba(0,200,180,0.1)",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#c8eae8",
                  }}
                >
                  Upload Results
                </span>
              </div>
              {results.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.85rem 1.25rem",
                    borderBottom: "1px solid rgba(0,200,180,0.07)",
                  }}
                >
                  {r.success ? (
                    <CheckCircle
                      size={16}
                      color="#00c8b0"
                      style={{ flexShrink: 0 }}
                    />
                  ) : (
                    <AlertCircle
                      size={16}
                      color="#e05c5c"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#c8eae8",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        margin: 0,
                        color: r.success ? "#00c8b0" : "#e05c5c",
                      }}
                    >
                      {r.success ? `${r.chunks} chunks indexed` : r.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.9rem",
            }}
          >
            {[
              {
                icon: File,
                label: "PDF & DOCX",
                desc: "Supports PDF via PyPDF and Word via Docx2txt",
                color: "#00c8b0",
              },
              {
                icon: CheckCircle,
                label: "Vector Indexed",
                desc: "Chunked and stored in Pinecone for semantic search",
                color: "#34d399",
              },
              {
                icon: AlertCircle,
                label: "Instant Access",
                desc: "Available immediately for RAG queries in chat",
                color: "#fbbf24",
              },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,200,180,0.12)",
                  borderRadius: "12px",
                  padding: "1.1rem",
                }}
              >
                <Icon
                  size={18}
                  color={color}
                  style={{ marginBottom: "0.6rem" }}
                />
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#c8eae8",
                    margin: "0 0 4px",
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "rgba(180,220,215,0.45)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
