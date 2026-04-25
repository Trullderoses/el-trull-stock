import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, query, orderBy, where, getDocs, Timestamp
} from "firebase/firestore";

const defaultCategorias = ["Refresco (lata)", "Refresco (botella)", "Agua", "Cerveza", "Vino", "Zumo", "Destilado", "Otro"];
const defaultBebidas = [
  { id: "1", nombre: "Coca-Cola", categoria: "Refresco (lata)", cantidad: 48, minimo: 24, unidad: "latas", precio: 1.20 },
  { id: "2", nombre: "Fanta Naranja", categoria: "Refresco (lata)", cantidad: 36, minimo: 24, unidad: "latas", precio: 1.20 },
  { id: "3", nombre: "Coca-Cola 1L", categoria: "Refresco (botella)", cantidad: 12, minimo: 10, unidad: "botellas", precio: 2.50 },
  { id: "4", nombre: "Agua Mineral", categoria: "Agua", cantidad: 60, minimo: 30, unidad: "botellas", precio: 0.80 },
  { id: "5", nombre: "Cerveza Rubia", categoria: "Cerveza", cantidad: 8, minimo: 20, unidad: "barriles", precio: 45.00 },
  { id: "6", nombre: "Vino Tinto Reserva", categoria: "Vino", cantidad: 15, minimo: 10, unidad: "botellas", precio: 12.00 },
  { id: "7", nombre: "Sprite", categoria: "Refresco (lata)", cantidad: 24, minimo: 24, unidad: "latas", precio: 1.20 },
  { id: "8", nombre: "Zumo de Naranja", categoria: "Zumo", cantidad: 5, minimo: 12, unidad: "litros", precio: 3.50 },
];

const unidades = ["latas", "botellas", "barriles", "litros", "cajas", "unidades"];

const getEstado = (cantidad, minimo) => {
  if (cantidad === 0) return "agotado";
  if (cantidad < minimo) return "bajo";
  if (cantidad < minimo * 1.5) return "medio";
  return "ok";
};

const estadoConfig = {
  agotado: { label: "Agotado", color: "#ff3b5c", bg: "rgba(255,59,92,0.15)" },
  bajo: { label: "Stock bajo", color: "#ff9500", bg: "rgba(255,149,0,0.15)" },
  medio: { label: "Stock medio", color: "#f5d300", bg: "rgba(245,211,0,0.15)" },
  ok: { label: "OK", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
};

const today = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; };

function LoginScreen({ onLogin }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const handleLogin = () => {
    if (!nombre.trim()) return setError("Por favor escribe tu nombre");
    onLogin(nombre.trim());
  };
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');`}</style>
      <div style={{ background: "#111626", border: "1.5px solid #1e2540", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🍹</div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, color: "#e8eaf0", marginBottom: 6 }}>
          Stock Bebidas
        </h1>
        <p style={{ fontSize: 14, color: "#4f7fff", marginBottom: 32 }}>Restaurante El Trull</p>
        <p style={{ fontSize: 14, color: "#7a84a0", marginBottom: 24 }}>¿Cómo te llamas?</p>
        <input
          style={{ background: "#151b30", border: "1.5px solid #252d48", borderRadius: 12, color: "#e8eaf0", fontFamily: "inherit", fontSize: 16, padding: "14px 18px", outline: "none", width: "100%", marginBottom: 8, textAlign: "center" }}
          placeholder="Tu nombre..."
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          autoFocus
        />
        {error && <p style={{ fontSize: 12, color: "#ff3b5c", marginBottom: 8 }}>{error}</p>}
        <button
          onClick={handleLogin}
          style={{ background: "#4f7fff", color: "white", border: "none", borderRadius: 12, padding: "14px", width: "100%", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "inherit" }}>
          Entrar →
        </button>
      </div>
    </div>
  );
}

export default function StockBebidas() {
  const [usuario, setUsuario] = useState(() => localStorage.getItem("eltrull_usuario") || "");
  const [bebidas, setBebidas] = useState([]);
  const [categorias, setCategorias] = useState(defaultCategorias);
  const [filtro, setFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);
  const [form, setForm] = useState({ nombre: "", categoria: "", cantidad: "", minimo: "", unidad: "botellas", precio: "" });
  const [ajuste, setAjuste] = useState({ tipo: "entrada", cantidad: "", nota: "" });
  const [toast, setToast] = useState(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [catError, setCatError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [histFiltro, setHistFiltro] = useState({ desde: daysAgo(7), hasta: today(), rapido: "7d" });
  const [cargandoHist, setCargandoHist] = useState(false);

  const handleLogin = (nombre) => {
    localStorage.setItem("eltrull_usuario", nombre);
    setUsuario(nombre);
  };

  const handleLogout = () => {
    localStorage.removeItem("eltrull_usuario");
    setUsuario("");
  };

  if (!usuario) return <LoginScreen onLogin={handleLogin} />;

  useEffect(() => {
    const unsubBebidas = onSnapshot(collection(db, "bebidas"), async (snap) => {
      if (snap.empty) {
        for (const b of defaultBebidas) await setDoc(doc(db, "bebidas", b.id), b);
      } else {
        setBebidas(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      }
      setCargando(false);
    });
    const unsubCats = onSnapshot(collection(db, "categorias"), async (snap) => {
      if (snap.empty) {
        for (const cat of defaultCategorias) await setDoc(doc(db, "categorias", cat), { nombre: cat });
      } else {
        setCategorias(snap.docs.map(d => d.data().nombre));
      }
    });
    return () => { unsubBebidas(); unsubCats(); };
  }, []);

  const cargarHistorial = async (desde, hasta) => {
    setCargandoHist(true);
    const desdeTs = Timestamp.fromDate(new Date(desde + "T00:00:00"));
    const hastaTs = Timestamp.fromDate(new Date(hasta + "T23:59:59"));
    const q = query(collection(db, "historial"), where("fecha", ">=", desdeTs), where("fecha", "<=", hastaTs), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    setHistorial(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    setCargandoHist(false);
  };

  useEffect(() => {
    if (modal === "historial") cargarHistorial(histFiltro.desde, histFiltro.hasta);
  }, [modal]);

  const showToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const bebidasFiltradas = bebidas.filter(b => {
    const matchCat = filtro === "Todas" || b.categoria === filtro;
    const matchBus = b.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBus;
  });

  const stats = {
    total: bebidas.length,
    agotados: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "agotado").length,
    bajos: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "bajo").length,
    ok: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "ok").length,
  };

  const abrirNueva = () => {
    setForm({ nombre: "", categoria: categorias[0], cantidad: "", minimo: "", unidad: "botellas", precio: "" });
    setModal("nueva");
  };

  const abrirEditar = (b) => {
    setSeleccionada(b);
    setForm({ nombre: b.nombre, categoria: b.categoria, cantidad: b.cantidad, minimo: b.minimo, unidad: b.unidad, precio: b.precio });
    setModal("editar");
  };

  const abrirAjuste = (b) => {
    setSeleccionada(b);
    setAjuste({ tipo: "entrada", cantidad: "", usuario: "", nota: "" });
    setModal("ajuste");
  };

  const guardarNueva = async () => {
    if (!form.nombre || form.cantidad === "" || form.minimo === "") return showToast("Completa todos los campos", "error");
    const id = Date.now().toString();
    const nueva = { id, ...form, cantidad: +form.cantidad, minimo: +form.minimo, precio: +form.precio };
    await setDoc(doc(db, "bebidas", id), nueva);
    setModal(null);
    showToast(`"${form.nombre}" añadida al stock`);
  };

  const guardarEditar = async () => {
    const actualizado = { ...seleccionada, ...form, cantidad: +form.cantidad, minimo: +form.minimo, precio: +form.precio };
    await setDoc(doc(db, "bebidas", seleccionada.id), actualizado);
    setModal(null);
    showToast("Bebida actualizada");
  };

  const guardarAjuste = async () => {
    const cant = parseInt(ajuste.cantidad);
    if (!cant || cant <= 0) return showToast("Ingresa una cantidad válida", "error");
    const cantAnterior = seleccionada.cantidad;
    const cantNueva = ajuste.tipo === "entrada" ? cantAnterior + cant : Math.max(0, cantAnterior - cant);
    await setDoc(doc(db, "bebidas", seleccionada.id), { ...seleccionada, cantidad: cantNueva });
    await addDoc(collection(db, "historial"), {
      bebidaId: seleccionada.id,
      bebidaNombre: seleccionada.nombre,
      categoria: seleccionada.categoria,
      tipo: ajuste.tipo,
      cantidad: cant,
      cantidadAnterior: cantAnterior,
      cantidadNueva: cantNueva,
      unidad: seleccionada.unidad,
      usuario: usuario,
      nota: ajuste.nota || "",
      fecha: Timestamp.now(),
    });
    setModal(null);
    showToast(`Stock de "${seleccionada.nombre}" actualizado`);
  };

  const eliminar = async (id) => {
    await deleteDoc(doc(db, "bebidas", id));
    showToast("Bebida eliminada");
  };

  const agregarCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return setCatError("El nombre no puede estar vacío");
    if (categorias.map(c => c.toLowerCase()).includes(nombre.toLowerCase())) return setCatError("Esa categoría ya existe");
    await setDoc(doc(db, "categorias", nombre), { nombre });
    setNuevaCategoria(""); setCatError("");
    showToast(`Categoría "${nombre}" creada`);
  };

  const eliminarCategoria = async (cat) => {
    if (bebidas.some(b => b.categoria === cat)) return showToast(`"${cat}" está en uso`, "error");
    await deleteDoc(doc(db, "categorias", cat));
    if (filtro === cat) setFiltro("Todas");
    showToast(`Categoría "${cat}" eliminada`);
  };

  const aplicarFiltroRapido = (tipo) => {
    const desde = tipo === "7d" ? daysAgo(7) : tipo === "30d" ? daysAgo(30) : daysAgo(0);
    const hasta = today();
    setHistFiltro({ desde, hasta, rapido: tipo });
    cargarHistorial(desde, hasta);
  };

  const aplicarFiltroFechas = () => {
    setHistFiltro({ ...histFiltro, rapido: "" });
    cargarHistorial(histFiltro.desde, histFiltro.hasta);
  };

  // Resumen por bebida del historial
  const resumenHistorial = historial.reduce((acc, mov) => {
    if (!acc[mov.bebidaNombre]) acc[mov.bebidaNombre] = { nombre: mov.bebidaNombre, categoria: mov.categoria, unidad: mov.unidad, entradas: 0, salidas: 0 };
    if (mov.tipo === "entrada") acc[mov.bebidaNombre].entradas += mov.cantidad;
    else acc[mov.bebidaNombre].salidas += mov.cantidad;
    return acc;
  }, {});

  const exportarExcel = () => {
    const data = bebidas.map(b => ({
      "Nombre": b.nombre, "Categoría": b.categoria, "Cantidad": b.cantidad,
      "Unidad": b.unidad, "Stock Mínimo": b.minimo, "Precio (€)": b.precio,
      "Valor Total (€)": +(b.cantidad * b.precio).toFixed(2),
      "Estado": estadoConfig[getEstado(b.cantidad, b.minimo)].label,
    }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    ws1["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Stock Bebidas");
    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `stock-bebidas-${fecha}.xlsx`);
    showToast("Excel exportado");
  };

  if (cargando) return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", color: "#5a6480" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍹</div>
        <p style={{ fontSize: 16 }}>Cargando stock...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'DM Sans', sans-serif", color: "#e8eaf0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0e1a; } ::-webkit-scrollbar-thumb { background: #2a3050; border-radius: 3px; }
        .btn { cursor: pointer; border: none; border-radius: 10px; font-family: inherit; font-weight: 500; transition: all 0.2s; }
        .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .input { background: #151b30; border: 1.5px solid #252d48; border-radius: 10px; color: #e8eaf0; font-family: inherit; font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.2s; }
        .input:focus { border-color: #4f7fff; }
        .input option { background: #151b30; }
        .card-row { display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr 1fr 120px; align-items: center; gap: 12px; padding: 15px 20px; border-radius: 14px; background: #111626; border: 1.5px solid #1e2540; transition: all 0.2s; }
        .card-row:hover { border-color: #2e3860; background: #141928; }
        .pill { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #111626; border: 1.5px solid #1e2540; border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        .modal-wide { max-width: 760px; }
        .stat-card { background: #111626; border: 1.5px solid #1e2540; border-radius: 16px; padding: 20px 24px; }
        .filtro-btn { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; border: 1.5px solid #1e2540; background: transparent; color: #7a84a0; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .filtro-btn.active { background: #4f7fff; border-color: #4f7fff; color: white; }
        .filtro-btn:hover:not(.active) { border-color: #2e3860; color: #e8eaf0; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 14px 22px; border-radius: 12px; font-size: 14px; font-weight: 500; z-index: 200; animation: slideUp 0.3s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .icon-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; font-size: 14px; transition: all 0.2s; }
        .icon-btn:hover { transform: scale(1.12); }
        .cat-tag { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 13px; background: #151b30; border: 1.5px solid #1e2540; border-radius: 10px; font-size: 13px; }
        .cat-tag-del { width: 22px; height: 22px; border-radius: 5px; background: rgba(255,59,92,0.1); color: #ff3b5c; border: none; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cat-tag-del:hover { background: rgba(255,59,92,0.25); }
        .hist-row { display: grid; grid-template-columns: 140px 1fr 80px 80px 80px 100px; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; background: #0f1420; border: 1px solid #1a2035; font-size: 13px; }
        .resumen-row { display: grid; grid-template-columns: 1fr 1fr 80px 80px 80px; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; background: #0f1420; border: 1px solid #1a2035; font-size: 13px; }
        @media (max-width: 700px) {
          .card-row { grid-template-columns: 1fr 1fr; gap: 8px; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .hide-mobile { display: none !important; }
          .top-actions { flex-direction: column; align-items: stretch; }
          .hist-row { grid-template-columns: 1fr 1fr; }
          .resumen-row { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #0d1220 0%, #0a0e1a 100%)", borderBottom: "1px solid #1a2035", padding: "22px 28px 18px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }} className="top-actions">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: 26 }}>🍹</span>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, fontWeight: 400, letterSpacing: "-0.02em" }}>
                Stock Bebidas · <em style={{ color: "#4f7fff" }}>Restaurante El Trull</em>
              </h1>
            </div>
            <p style={{ fontSize: 12, color: "#5a6480" }}>Control de inventario · {bebidas.length} productos · <span style={{ color: "#34d399" }}>● Sincronizado</span></p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e2540", borderRadius: 10, padding: "8px 14px" }}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 500 }}>{usuario}</span>
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#5a6480", cursor: "pointer", fontSize: 12, padding: "0 0 0 4px" }} title="Cambiar usuario">✕</button>
            </div>
            <button className="btn" onClick={() => setModal("historial")} style={{ background: "#1a1f35", color: "#a78bfa", padding: "10px 16px", fontSize: 13, border: "1.5px solid #2a2050", display: "flex", alignItems: "center", gap: 7 }}>
              📈 Historial
            </button>
            <button className="btn" onClick={() => setModal("categorias")} style={{ background: "#1e2540", color: "#a0aac0", padding: "10px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
              🏷️ Categorías
            </button>
            <button className="btn" onClick={exportarExcel} style={{ background: "#0f2a18", color: "#34d399", padding: "10px 16px", fontSize: 13, border: "1.5px solid #1a4028", display: "flex", alignItems: "center", gap: 7 }}>
              📊 Excel
            </button>
            <button className="btn" onClick={abrirNueva} style={{ background: "#4f7fff", color: "white", padding: "10px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 17 }}>+</span> Nueva
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 20px" }}>
        {/* Stats */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total productos", value: stats.total, icon: "📦", color: "#4f7fff" },
            { label: "En buen estado", value: stats.ok, icon: "✅", color: "#34d399" },
            { label: "Stock bajo", value: stats.bajos, icon: "⚠️", color: "#ff9500" },
            { label: "Agotados", value: stats.agotados, icon: "🚨", color: "#ff3b5c" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#5a6480", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" placeholder="🔍  Buscar bebida..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: 220, flex: "1 1 160px" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={`filtro-btn ${filtro === "Todas" ? "active" : ""}`} onClick={() => setFiltro("Todas")}>Todas</button>
            {categorias.filter(cat => bebidas.some(b => b.categoria === cat)).map(cat => (
              <button key={cat} className={`filtro-btn ${filtro === cat ? "active" : ""}`} onClick={() => setFiltro(cat)}>{cat}</button>
            ))}
          </div>
        </div>

        {/* Table Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 120px", gap: 12, padding: "6px 20px", marginBottom: 6 }} className="hide-mobile">
          {["Producto", "Categoría", "Stock", "Mínimo", "Estado", "Acciones"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "#3a4460", textTransform: "uppercase", letterSpacing: "0.09em" }}>{h}</span>
          ))}
        </div>

        {bebidasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#3a4460" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🍾</div>
            <p>No se encontraron bebidas</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {bebidasFiltradas.map(b => {
              const estado = getEstado(b.cantidad, b.minimo);
              const cfg = estadoConfig[estado];
              return (
                <div key={b.id} className="card-row">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{b.nombre}</div>
                    <div style={{ fontSize: 11, color: "#5a6480", marginTop: 2 }}>{b.precio.toFixed(2)} € / {b.unidad}</div>
                  </div>
                  <span className="pill" style={{ background: "rgba(79,127,255,0.1)", color: "#6a9fff", fontSize: 11 }}>{b.categoria}</span>
                  <div>
                    <span style={{ fontSize: 19, fontWeight: 600, color: cfg.color }}>{b.cantidad}</span>
                    <span style={{ fontSize: 11, color: "#5a6480", marginLeft: 4 }}>{b.unidad}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5a6480" }}>{b.minimo} {b.unidad}</div>
                  <span className="pill" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button className="icon-btn" onClick={() => abrirAjuste(b)} style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }} title="Ajustar stock">±</button>
                    <button className="icon-btn" onClick={() => abrirEditar(b)} style={{ background: "rgba(79,127,255,0.1)", color: "#4f7fff" }} title="Editar">✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(b.id)} style={{ background: "rgba(255,59,92,0.1)", color: "#ff3b5c" }} title="Eliminar">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bebidas.some(b => ["agotado", "bajo"].includes(getEstado(b.cantidad, b.minimo))) && (
          <div style={{ marginTop: 28, background: "rgba(255,149,0,0.06)", border: "1.5px solid rgba(255,149,0,0.18)", borderRadius: 14, padding: "18px 22px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#ff9500", marginBottom: 10 }}>⚠️ Requieren reposición</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {bebidas.filter(b => ["agotado", "bajo"].includes(getEstado(b.cantidad, b.minimo))).map(b => (
                <span key={b.id} className="pill" style={{ background: estadoConfig[getEstado(b.cantidad, b.minimo)].bg, color: estadoConfig[getEstado(b.cantidad, b.minimo)].color, fontSize: 12, padding: "5px 12px" }}>
                  {b.nombre} — {b.cantidad} {b.unidad}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Nueva / Editar ── */}
      {(modal === "nueva" || modal === "editar") && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 20 }}>{modal === "nueva" ? "Nueva Bebida" : "Editar Bebida"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Nombre</label>
                <input className="input" placeholder="Ej: Coca-Cola Zero" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Categoría</label>
                  <select className="input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Unidad</label>
                  <select className="input" value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
                    {unidades.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Stock actual</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Stock mínimo</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.minimo} onChange={e => setForm({ ...form, minimo: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Precio unitario (€)</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background: "#1e2540", color: "#7a84a0", padding: "10px 18px", fontSize: 13 }}>Cancelar</button>
              <button className="btn" onClick={modal === "nueva" ? guardarNueva : guardarEditar} style={{ background: "#4f7fff", color: "white", padding: "10px 20px", fontSize: 13 }}>
                {modal === "nueva" ? "Añadir" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ajuste ── */}
      {modal === "ajuste" && seleccionada && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>Ajustar Stock</h2>
            <p style={{ fontSize: 14, color: "#5a6480", marginBottom: 16 }}>
              {seleccionada.nombre} — actual: <strong style={{ color: "#e8eaf0" }}>{seleccionada.cantidad} {seleccionada.unidad}</strong>
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["entrada", "salida"].map(t => (
                <button key={t} className="btn" onClick={() => setAjuste({ ...ajuste, tipo: t })}
                  style={{ flex: 1, padding: "10px", fontSize: 14, background: ajuste.tipo === t ? (t === "entrada" ? "#34d399" : "#ff3b5c") : "#1e2540", color: ajuste.tipo === t ? "#0a0e1a" : "#5a6480", fontWeight: ajuste.tipo === t ? 600 : 400 }}>
                  {t === "entrada" ? "📥 Entrada" : "📤 Salida"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Cantidad ({seleccionada.unidad})</label>
                <input className="input" type="number" min="1" placeholder="0" value={ajuste.cantidad} onChange={e => setAjuste({ ...ajuste, cantidad: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 6 }}>Nota <span style={{ color: "#3a4460" }}>(opcional)</span></label>
                <input className="input" placeholder="Ej: Pedido semanal, servicio cena..." value={ajuste.nota} onChange={e => setAjuste({ ...ajuste, nota: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background: "#1e2540", color: "#7a84a0", padding: "10px 18px", fontSize: 13 }}>Cancelar</button>
              <button className="btn" onClick={guardarAjuste} style={{ background: ajuste.tipo === "entrada" ? "#34d399" : "#ff3b5c", color: "#0a0e1a", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Historial ── */}
      {modal === "historial" && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 16 }}>📈 Historial de Movimientos</h2>

            {/* Filtros rápidos */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[{ k: "7d", l: "Últimos 7 días" }, { k: "30d", l: "Últimos 30 días" }, { k: "hoy", l: "Hoy" }].map(f => (
                <button key={f.k} className={`filtro-btn ${histFiltro.rapido === f.k ? "active" : ""}`} onClick={() => aplicarFiltroRapido(f.k)}>{f.l}</button>
              ))}
            </div>

            {/* Filtro por fechas */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#5a6480", display: "block", marginBottom: 5 }}>Desde</label>
                <input className="input" type="date" value={histFiltro.desde} onChange={e => setHistFiltro({ ...histFiltro, desde: e.target.value, rapido: "" })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#5a6480", display: "block", marginBottom: 5 }}>Hasta</label>
                <input className="input" type="date" value={histFiltro.hasta} onChange={e => setHistFiltro({ ...histFiltro, hasta: e.target.value, rapido: "" })} />
              </div>
              <button className="btn" onClick={aplicarFiltroFechas} style={{ background: "#4f7fff", color: "white", padding: "10px 16px", fontSize: 13, whiteSpace: "nowrap" }}>Buscar</button>
            </div>

            {cargandoHist ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#5a6480" }}>Cargando...</div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#3a4460" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                <p>No hay movimientos en este período</p>
              </div>
            ) : (
              <>
                {/* Resumen por bebida */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 10 }}>Resumen del período</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 80px", gap: 8, padding: "6px 14px", marginBottom: 4 }} className="hide-mobile">
                    {["Bebida", "Categoría", "Entradas", "Salidas", "Neto"].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "#3a4460", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {Object.values(resumenHistorial).map(r => (
                      <div key={r.nombre} className="resumen-row">
                        <span style={{ fontWeight: 500 }}>{r.nombre}</span>
                        <span style={{ color: "#6a9fff", fontSize: 12 }}>{r.categoria}</span>
                        <span style={{ color: "#34d399", fontWeight: 600 }}>+{r.entradas} <span style={{ fontSize: 10, color: "#5a6480" }}>{r.unidad}</span></span>
                        <span style={{ color: "#ff3b5c", fontWeight: 600 }}>-{r.salidas} <span style={{ fontSize: 10, color: "#5a6480" }}>{r.unidad}</span></span>
                        <span style={{ color: r.entradas - r.salidas >= 0 ? "#34d399" : "#ff3b5c", fontWeight: 600 }}>{r.entradas - r.salidas >= 0 ? "+" : ""}{r.entradas - r.salidas}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Movimientos detallados */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", marginBottom: 10 }}>Movimientos detallados ({historial.length})</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px 80px 80px 100px", gap: 8, padding: "6px 14px", marginBottom: 4 }} className="hide-mobile">
                    {["Fecha", "Bebida", "Tipo", "Cant.", "Stock", "Usuario"].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "#3a4460", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto" }}>
                    {historial.map(m => {
                      const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date();
                      const fechaStr = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={m.id} className="hist-row">
                          <span style={{ fontSize: 11, color: "#5a6480" }}>{fechaStr}</span>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{m.bebidaNombre}</div>
                            {m.nota && <div style={{ fontSize: 11, color: "#5a6480" }}>{m.nota}</div>}
                          </div>
                          <span className="pill" style={{ background: m.tipo === "entrada" ? "rgba(52,211,153,0.15)" : "rgba(255,59,92,0.15)", color: m.tipo === "entrada" ? "#34d399" : "#ff3b5c" }}>
                            {m.tipo === "entrada" ? "📥" : "📤"} {m.tipo}
                          </span>
                          <span style={{ fontWeight: 600, color: m.tipo === "entrada" ? "#34d399" : "#ff3b5c" }}>
                            {m.tipo === "entrada" ? "+" : "-"}{m.cantidad}
                          </span>
                          <span style={{ fontSize: 12, color: "#7a84a0" }}>{m.cantidadAnterior} → {m.cantidadNueva}</span>
                          <span style={{ fontSize: 12, color: "#5a6480" }}>{m.usuario}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background: "#1e2540", color: "#a0aac0", padding: "10px 20px", fontSize: 13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Categorías ── */}
      {modal === "categorias" && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>Gestionar Categorías</h2>
            <p style={{ fontSize: 13, color: "#5a6480", marginBottom: 20 }}>Crea nuevas categorías o elimina las que no estén en uso.</p>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 8 }}>Nueva categoría</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" placeholder="Ej: Kombuchá, Sidra..." value={nuevaCategoria}
                  onChange={e => { setNuevaCategoria(e.target.value); setCatError(""); }}
                  onKeyDown={e => e.key === "Enter" && agregarCategoria()} />
                <button className="btn" onClick={agregarCategoria} style={{ background: "#4f7fff", color: "white", padding: "10px 16px", fontSize: 13, whiteSpace: "nowrap" }}>+ Crear</button>
              </div>
              {catError && <p style={{ fontSize: 12, color: "#ff3b5c", marginTop: 6 }}>{catError}</p>}
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#5a6480", display: "block", marginBottom: 10 }}>Categorías existentes ({categorias.length})</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                {categorias.map(cat => {
                  const count = bebidas.filter(b => b.categoria === cat).length;
                  return (
                    <div key={cat} className="cat-tag">
                      <span>{cat}</span>
                      {count > 0 && <span style={{ fontSize: 11, color: "#4f7fff", background: "rgba(79,127,255,0.12)", padding: "1px 7px", borderRadius: 20 }}>{count}</span>}
                      <button className="cat-tag-del" onClick={() => eliminarCategoria(cat)}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background: "#1e2540", color: "#a0aac0", padding: "10px 20px", fontSize: 13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ background: toast.tipo === "error" ? "#ff3b5c" : "#34d399", color: "#0a0e1a" }}>
          {toast.tipo === "error" ? "⚠️" : "✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}
