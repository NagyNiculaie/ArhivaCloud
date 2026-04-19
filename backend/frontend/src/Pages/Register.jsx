import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { saveAuth } from "../Utils/auth";

const API_URL = import.meta.env.VITE_API_URL;

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post(`${API_URL}/auth/register`, form);

      saveAuth(res.data);
      navigate("/dashboard");
    } catch (err) {
      setMessage(err.response?.data?.error || "Eroare la înregistrare.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Creare cont</h1>
        <p style={styles.subtitle}>Înregistrează-te în Arhiva Cloud</p>

        <form onSubmit={handleRegister} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            name="name"
            placeholder="Nume"
            value={form.name}
            onChange={handleChange}
          />

          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Parolă"
            value={form.password}
            onChange={handleChange}
          />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Se creează contul..." : "Register"}
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}

        <p style={styles.footerText}>
          Ai deja cont?{" "}
          <Link to="/login" style={styles.link}>
            Autentifică-te
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #111827, #1f2937)",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#111827",
    border: "1px solid #374151",
    borderRadius: "18px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    color: "#fff",
  },
  title: {
    margin: 0,
    fontSize: "32px",
  },
  subtitle: {
    color: "#9ca3af",
    marginTop: "10px",
    marginBottom: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  input: {
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #4b5563",
    backgroundColor: "#1f2937",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
  },
  button: {
    marginTop: "6px",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#6366f1",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  message: {
    marginTop: "16px",
    color: "#fca5a5",
  },
  footerText: {
    marginTop: "20px",
    color: "#d1d5db",
  },
  link: {
    color: "#818cf8",
    textDecoration: "none",
  },
};

export default Register;