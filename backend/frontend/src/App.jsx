import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadDocs = async () => {
    try {
      const res = await axios.get("http://localhost:5000/documents");
      setDocs(res.data.documents || []);
    } catch (err) {
      console.error("Eroare la listare:", err);
      setMessage("Eroare la încărcarea documentelor.");
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const uploadFile = async () => {
    try {
      if (!file) {
        setMessage("Selectează un fișier mai întâi.");
        return;
      }

      setLoading(true);
      setMessage("Se încarcă fișierul...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        "http://localhost:5000/documents/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Upload OK:", res.data);
      setMessage("Upload reușit!");
      setFile(null);

      await loadDocs();
    } catch (err) {
      console.error("Eroare upload:", err);
      setMessage(
        "Eroare upload: " + (err.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Arhiva Cloud Documente</h1>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button onClick={uploadFile} disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {message && (
        <p style={{ marginTop: "12px", color: "#ddd" }}>
          {message}
        </p>
      )}

      <h2 style={{ marginTop: "30px" }}>Documente</h2>

      {docs.length === 0 ? (
        <p>Nu există documente încă.</p>
      ) : (
        docs.map((doc) => (
          <div key={doc._id} style={{ marginBottom: "10px" }}>
            <a href={doc.file?.url} target="_blank" rel="noreferrer">
              {doc.file?.originalName}
            </a>
          </div>
        ))
      )}
    </div>
  );
}

export default App;