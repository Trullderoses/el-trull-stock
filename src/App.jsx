import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, query, orderBy, where, getDocs, Timestamp, limit
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
const ADMIN_NOMBRE = "Hernan";
const ADMIN_PASSWORD = "123";

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
const fmtFecha = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function LoginScreen({ onLogin }) {
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const esAdmin = nombre.trim().toLowerCase() === ADMIN_NOMBRE.toLowerCase();
  const handleLogin = () => {
    if (!nombre.trim()) return setError("Por favor escribe tu nombre");
    if (esAdmin) {
      if (password !== ADMIN_PASSWORD) return setError("Contraseña incorrecta");
      onLogin(nombre.trim(), "admin");
    } else {
      onLogin(nombre.trim(), "trabajador");
    }
  };
  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans', sans-serif", padding:20 }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');"}</style>
      <div style={{ background:"#111626", border:"1.5px solid #1e2540", borderRadius:24, padding:"40px 36px", width:"100%", maxWidth:400, textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🍹</div>
        <h1 style={{ fontFamily:"'DM Serif Display', serif", fontSize:26, fontWeight:400, color:"#e8eaf0", marginBottom:6 }}>Stock Bebidas</h1>
        <p style={{ fontSize:14, color:"#4f7fff", marginBottom:32 }}>Restaurante El Trull</p>
        <p style={{ fontSize:14, color:"#7a84a0", marginBottom:16 }}>¿Cómo te llamas?</p>
        <input style={{ background:"#151b30", border:"1.5px solid #252d48", borderRadius:12, color:"#e8eaf0", fontFamily:"inherit", fontSize:16, padding:"14px 18px", outline:"none", width:"100%", marginBottom:10, textAlign:"center", boxSizing:"border-box" }}
          placeholder="Tu nombre..." value={nombre}
          onChange={e => { setNombre(e.target.value); setError(""); setPassword(""); }}
          onKeyDown={e => e.key === "Enter" && !esAdmin && handleLogin()} autoFocus />
        {esAdmin && (
          <div style={{ marginBottom:10, position:"relative" }}>
            <input type={showPass ? "text" : "password"}
              style={{ background:"#151b30", border:"1.5px solid #4f7fff", borderRadius:12, color:"#e8eaf0", fontFamily:"inherit", fontSize:16, padding:"14px 48px 14px 18px", outline:"none", width:"100%", textAlign:"center", boxSizing:"border-box" }}
              placeholder="Contraseña..." value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#5a6480", cursor:"pointer", fontSize:16 }}>
              {showPass ? "🙈" : "👁️"}
            </button>
            <p style={{ fontSize:11, color:"#4f7fff", marginTop:6 }}>🔑 Acceso administrador</p>
          </div>
        )}
        {error && <p style={{ fontSize:12, color:"#ff3b5c", marginBottom:8 }}>{error}</p>}
        <button onClick={handleLogin} style={{ background:"#4f7fff", color:"white", border:"none", borderRadius:12, padding:"14px", width:"100%", fontSize:15, fontWeight:600, cursor:"pointer", marginTop:4, fontFamily:"inherit" }}>
          Entrar →
        </button>
        {!esAdmin && nombre.trim().length > 0 && (
          <p style={{ fontSize:11, color:"#5a6480", marginTop:12 }}>👷 Entrará como trabajador</p>
        )}
      </div>
    </div>
  );
}

export default function StockBebidas() {
  const getSaved = (key) => { try { return localStorage.getItem(key) || ""; } catch(e) { return ""; } };
  const [usuario, setUsuario] = useState(() => getSaved("eltrull_usuario"));
  const [rol, setRol] = useState(() => getSaved("eltrull_rol"));
  const isAdmin = rol === "admin";

  const [bebidas, setBebidas] = useState([]);
  const [categorias, setCategorias] = useState(defaultCategorias);
  const [filtro, setFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);
  const [form, setForm] = useState({ nombre:"", categoria:"", cantidad:"", minimo:"", unidad:"botellas", precio:"", proveedor:"" });
  const [ajuste, setAjuste] = useState({ tipo:"entrada", cantidad:"", nota:"" });
  const [toast, setToast] = useState(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [catError, setCatError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [histFiltro, setHistFiltro] = useState({ desde: daysAgo(7), hasta: today(), rapido:"7d", categoria:"Todas", producto:"" });
  const [cargandoHist, setCargandoHist] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [sortConfig, setSortConfig] = useState({ campo:"nombre", dir:"asc" });
  const [ultimoMov, setUltimoMov] = useState(null);

  const handleLogin = (nombre, rol) => {
    try { localStorage.setItem("eltrull_usuario", nombre); localStorage.setItem("eltrull_rol", rol); } catch(e) {}
    setUsuario(nombre); setRol(rol);
  };
  const handleLogout = () => {
    try { localStorage.removeItem("eltrull_usuario"); localStorage.removeItem("eltrull_rol"); } catch(e) {}
    setUsuario(""); setRol("");
  };

  useEffect(() => {
    const unsubBebidas = onSnapshot(collection(db, "bebidas"), async (snap) => {
      if (snap.empty) { for (const b of defaultBebidas) await setDoc(doc(db, "bebidas", b.id), b); }
      else { setBebidas(snap.docs.map(d => ({ ...d.data(), id: d.id }))); }
      setCargando(false);
    });
    const unsubCats = onSnapshot(collection(db, "categorias"), async (snap) => {
      if (snap.empty) { for (const cat of defaultCategorias) await setDoc(doc(db, "categorias", cat), { nombre: cat }); }
      else { setCategorias(snap.docs.map(d => d.data().nombre)); }
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

  const cargarUltimoMov = async (bebidaId) => {
    setUltimoMov(null);
    const q = query(collection(db, "historial"), where("bebidaId", "==", bebidaId), orderBy("fecha", "desc"), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) setUltimoMov({ ...snap.docs[0].data(), id: snap.docs[0].id });
  };

  useEffect(() => { if (modal === "historial") cargarHistorial(histFiltro.desde, histFiltro.hasta); }, [modal]);

  const showToast = (msg, tipo = "ok") => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  const toggleSort = (campo) => setSortConfig(prev => ({ campo, dir: prev.campo === campo && prev.dir === "asc" ? "desc" : "asc" }));

  const bebidasFiltradas = bebidas.filter(b => {
    const matchCat = filtro === "Todas" || b.categoria === filtro;
    const matchBus = b.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBus;
  }).sort((a, b) => {
    const valA = a[sortConfig.campo] ?? "";
    const valB = b[sortConfig.campo] ?? "";
    const cmp = typeof valA === "number" ? valA - valB : String(valA).localeCompare(String(valB), "es");
    return sortConfig.dir === "asc" ? cmp : -cmp;
  });

  // Filtrar historial por categoría y producto
  const histFiltrado = historial.filter(m => {
    const matchCat = histFiltro.categoria === "Todas" || m.categoria === histFiltro.categoria;
    const matchProd = !histFiltro.producto || m.bebidaNombre.toLowerCase().includes(histFiltro.producto.toLowerCase());
    return matchCat && matchProd;
  });

  const resumenHistorial = histFiltrado.reduce((acc, mov) => {
    if (!acc[mov.bebidaNombre]) acc[mov.bebidaNombre] = { nombre:mov.bebidaNombre, categoria:mov.categoria, unidad:mov.unidad, entradas:0, salidas:0 };
    if (mov.tipo === "entrada") acc[mov.bebidaNombre].entradas += mov.cantidad;
    else acc[mov.bebidaNombre].salidas += mov.cantidad;
    return acc;
  }, {});

  const stats = {
    total: bebidas.length,
    agotados: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "agotado").length,
    bajos: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "bajo").length,
    ok: bebidas.filter(b => getEstado(b.cantidad, b.minimo) === "ok").length,
  };

  const abrirNueva = () => { setForm({ nombre:"", categoria:categorias[0], cantidad:"", minimo:"", unidad:"botellas", precio:"", proveedor:"" }); setModal("nueva"); };
  const abrirEditar = (b) => { setSeleccionada(b); setForm({ nombre:b.nombre, categoria:b.categoria, cantidad:b.cantidad, minimo:b.minimo, unidad:b.unidad, precio:b.precio, proveedor:b.proveedor||"" }); setModal("editar"); };
  const abrirAjuste = (b) => { setSeleccionada(b); setAjuste({ tipo:"entrada", cantidad:"", nota:"" }); setModal("ajuste"); };
  const abrirFicha = (b) => { setSeleccionada(b); cargarUltimoMov(b.id); setModal("ficha"); };

  const guardarNueva = async () => {
    if (!form.nombre || form.cantidad === "" || form.minimo === "") return showToast("Completa todos los campos", "error");
    const id = Date.now().toString();
    await setDoc(doc(db, "bebidas", id), { id, ...form, cantidad:+form.cantidad, minimo:+form.minimo, precio:+form.precio });
    setModal(null); showToast(`"${form.nombre}" añadida al stock`);
  };
  const guardarEditar = async () => {
    await setDoc(doc(db, "bebidas", seleccionada.id), { ...seleccionada, ...form, cantidad:+form.cantidad, minimo:+form.minimo, precio:+form.precio });
    setModal(null); showToast("Bebida actualizada");
  };
  const guardarAjuste = async () => {
    const cant = parseInt(ajuste.cantidad);
    if (!cant || cant <= 0) return showToast("Ingresa una cantidad válida", "error");
    const cantAnterior = seleccionada.cantidad;
    const cantNueva = ajuste.tipo === "entrada" ? cantAnterior + cant : Math.max(0, cantAnterior - cant);
    await setDoc(doc(db, "bebidas", seleccionada.id), { ...seleccionada, cantidad: cantNueva, ultimaVariacion: Timestamp.now(), ultimoUsuario: usuario });
    await addDoc(collection(db, "historial"), {
      bebidaId: seleccionada.id, bebidaNombre: seleccionada.nombre, categoria: seleccionada.categoria,
      tipo: ajuste.tipo, cantidad: cant, cantidadAnterior: cantAnterior, cantidadNueva: cantNueva,
      unidad: seleccionada.unidad, usuario: usuario, nota: ajuste.nota || "", fecha: Timestamp.now(),
    });
    setModal(null); showToast(`Stock de "${seleccionada.nombre}" actualizado`);
  };
  const eliminar = async (id) => { await deleteDoc(doc(db, "bebidas", id)); showToast("Bebida eliminada"); };

  const agregarCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return setCatError("El nombre no puede estar vacío");
    if (categorias.map(c => c.toLowerCase()).includes(nombre.toLowerCase())) return setCatError("Esa categoría ya existe");
    await setDoc(doc(db, "categorias", nombre), { nombre });
    setNuevaCategoria(""); setCatError(""); showToast(`Categoría "${nombre}" creada`);
  };
  const eliminarCategoria = async (cat) => {
    if (bebidas.some(b => b.categoria === cat)) return showToast(`"${cat}" está en uso`, "error");
    await deleteDoc(doc(db, "categorias", cat));
    if (filtro === cat) setFiltro("Todas");
    showToast(`Categoría "${cat}" eliminada`);
  };
  const renombrarCategoria = async () => {
    if (!editingCat) return;
    const { original, nuevo } = editingCat;
    const nuevoNombre = nuevo.trim();
    if (!nuevoNombre) return showToast("El nombre no puede estar vacío", "error");
    if (nuevoNombre === original) { setEditingCat(null); return; }
    if (categorias.map(c => c.toLowerCase()).includes(nuevoNombre.toLowerCase())) return showToast("Esa categoría ya existe", "error");
    await setDoc(doc(db, "categorias", nuevoNombre), { nombre: nuevoNombre });
    for (const b of bebidas.filter(b => b.categoria === original)) await setDoc(doc(db, "bebidas", b.id), { ...b, categoria: nuevoNombre });
    await deleteDoc(doc(db, "categorias", original));
    if (filtro === original) setFiltro(nuevoNombre);
    setEditingCat(null); showToast(`Categoría renombrada a "${nuevoNombre}"`);
  };

  const aplicarFiltroRapido = (tipo) => {
    const desde = tipo === "7d" ? daysAgo(7) : tipo === "30d" ? daysAgo(30) : daysAgo(0);
    setHistFiltro(prev => ({ ...prev, desde, hasta: today(), rapido: tipo }));
    cargarHistorial(desde, today());
  };
  const aplicarFiltroFechas = () => { setHistFiltro(prev => ({ ...prev, rapido:"" })); cargarHistorial(histFiltro.desde, histFiltro.hasta); };

  const exportarExcel = () => {
    const data = bebidas.map(b => ({
      "Nombre": b.nombre, "Categoría": b.categoria, "Proveedor": b.proveedor || "—",
      "Cantidad": b.cantidad, "Unidad": b.unidad, "Stock Mínimo": b.minimo,
      "Precio (€)": b.precio, "Valor Total (€)": +(b.cantidad * b.precio).toFixed(2),
      "Estado": estadoConfig[getEstado(b.cantidad, b.minimo)].label,
      "Últ. variación": fmtFecha(b.ultimaVariacion), "Modificado por": b.ultimoUsuario || "—",
    }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    ws1["!cols"] = [{ wch:22 },{ wch:20 },{ wch:18 },{ wch:10 },{ wch:10 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:14 },{ wch:18 },{ wch:16 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Stock Bebidas");
    XLSX.writeFile(wb, `stock-bebidas-${today()}.xlsx`);
    showToast("Excel exportado");
  };

  if (!usuario) return <LoginScreen onLogin={handleLogin} />;
  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ textAlign:"center", color:"#5a6480" }}><div style={{ fontSize:48, marginBottom:16 }}>🍹</div><p style={{ fontSize:16 }}>Cargando stock...</p></div>
    </div>
  );

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#0a0e1a; } ::-webkit-scrollbar-thumb { background:#2a3050; border-radius:3px; }
    .btn { cursor:pointer; border:none; border-radius:10px; font-family:inherit; font-weight:500; transition:all 0.2s; }
    .btn:hover { transform:translateY(-1px); filter:brightness(1.1); }
    .input { background:#151b30; border:1.5px solid #252d48; border-radius:10px; color:#e8eaf0; font-family:inherit; font-size:14px; padding:10px 14px; outline:none; width:100%; transition:border-color 0.2s; }
    .input:focus { border-color:#4f7fff; }
    .input option { background:#151b30; }
    .card-row { display:grid; grid-template-columns:2fr 1.2fr 1fr 1fr 1fr 1fr 120px; align-items:center; gap:12px; padding:15px 20px; border-radius:14px; background:#111626; border:1.5px solid #1e2540; transition:all 0.2s; }
    .card-row:hover { border-color:#2e3860; background:#141928; }
    .card-row-worker { grid-template-columns:2fr 1.2fr 1fr 1fr 1fr 1fr 60px; }
    .pill { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; z-index:100; padding:20px; }
    .modal { background:#111626; border:1.5px solid #1e2540; border-radius:20px; padding:28px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; }
    .modal-wide { max-width:800px; }
    .stat-card { background:#111626; border:1.5px solid #1e2540; border-radius:16px; padding:20px 24px; }
    .filtro-btn { padding:7px 14px; border-radius:8px; font-size:12px; font-weight:500; border:1.5px solid #1e2540; background:transparent; color:#7a84a0; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
    .filtro-btn.active { background:#4f7fff; border-color:#4f7fff; color:white; }
    .filtro-btn:hover:not(.active) { border-color:#2e3860; color:#e8eaf0; }
    .toast { position:fixed; bottom:28px; right:28px; padding:14px 22px; border-radius:12px; font-size:14px; font-weight:500; z-index:200; animation:slideUp 0.3s ease; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
    @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .icon-btn { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none; font-size:14px; transition:all 0.2s; }
    .icon-btn:hover { transform:scale(1.12); }
    .hist-row { display:grid; grid-template-columns:130px 1fr 70px 70px 90px 90px; gap:8px; align-items:center; padding:10px 14px; border-radius:10px; background:#0f1420; border:1px solid #1a2035; font-size:12px; }
    .resumen-row { display:grid; grid-template-columns:1fr 1fr 80px 80px 80px; gap:10px; align-items:center; padding:10px 14px; border-radius:10px; background:#0f1420; border:1px solid #1a2035; font-size:13px; }
    @media (max-width:700px) {
      .card-row, .card-row-worker { grid-template-columns:1fr 1fr; gap:8px; }
      .stats-grid { grid-template-columns:1fr 1fr !important; }
      .hide-mobile { display:none !important; }
      .top-actions { flex-direction:column; align-items:stretch; }
      .hist-row { grid-template-columns:1fr 1fr; }
      .resumen-row { grid-template-columns:1fr 1fr; }
    }
  `;

  const SortBtn = ({ campo, label }) => {
    const active = sortConfig.campo === campo;
    return (
      <span onClick={() => isAdmin && toggleSort(campo)}
        style={{ fontSize:10, fontWeight:600, color: active ? "#4f7fff" : "#3a4460", textTransform:"uppercase", letterSpacing:"0.09em", cursor: isAdmin ? "pointer" : "default", display:"flex", alignItems:"center", gap:3, userSelect:"none" }}>
        {label} {isAdmin && <span style={{ opacity: active ? 1 : 0.3 }}>{active && sortConfig.dir === "desc" ? "↓" : "↑"}</span>}
      </span>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", fontFamily:"'DM Sans', sans-serif", color:"#e8eaf0" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(180deg, #0d1220 0%, #0a0e1a 100%)", borderBottom:"1px solid #1a2035", padding:"22px 28px 18px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }} className="top-actions">
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
              <span style={{ fontSize:26 }}>🍹</span>
              <h1 style={{ fontFamily:"'DM Serif Display', serif", fontSize:24, fontWeight:400, letterSpacing:"-0.02em" }}>
                Stock Bebidas · <em style={{ color:"#4f7fff" }}>Restaurante El Trull</em>
              </h1>
            </div>
            <p style={{ fontSize:12, color:"#5a6480" }}>{bebidas.length} productos · <span style={{ color:"#34d399" }}>● Sincronizado</span></p>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1e2540", borderRadius:10, padding:"8px 14px" }}>
              <span style={{ fontSize:14 }}>{isAdmin ? "👑" : "👷"}</span>
              <span style={{ fontSize:13, color:"#e8eaf0", fontWeight:500 }}>{usuario}</span>
              <span style={{ fontSize:10, color: isAdmin ? "#f5d300" : "#5a6480", background: isAdmin ? "rgba(245,211,0,0.1)" : "rgba(90,100,128,0.2)", padding:"1px 7px", borderRadius:20 }}>
                {isAdmin ? "Admin" : "Trabajador"}
              </span>
              <button onClick={handleLogout} style={{ background:"none", border:"none", color:"#5a6480", cursor:"pointer", fontSize:12, paddingLeft:4 }} title="Cerrar sesión">✕</button>
            </div>
            <button className="btn" onClick={() => setModal("historial")} style={{ background:"#1a1f35", color:"#a78bfa", padding:"10px 16px", fontSize:13, border:"1.5px solid #2a2050", display:"flex", alignItems:"center", gap:7 }}>📈 Historial</button>
            {isAdmin && <>
              <button className="btn" onClick={() => setModal("categorias")} style={{ background:"#1e2540", color:"#a0aac0", padding:"10px 16px", fontSize:13, display:"flex", alignItems:"center", gap:7 }}>🏷️ Categorías</button>
              <button className="btn" onClick={exportarExcel} style={{ background:"#0f2a18", color:"#34d399", padding:"10px 16px", fontSize:13, border:"1.5px solid #1a4028", display:"flex", alignItems:"center", gap:7 }}>📊 Excel</button>
              <button className="btn" onClick={abrirNueva} style={{ background:"#4f7fff", color:"white", padding:"10px 18px", fontSize:13, display:"flex", alignItems:"center", gap:7 }}><span style={{ fontSize:17 }}>+</span> Nueva</button>
            </>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 20px" }}>
        {/* Stats */}
        <div className="stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:24 }}>
          {[
            { label:"Total productos", value:stats.total, icon:"📦", color:"#4f7fff" },
            { label:"En buen estado", value:stats.ok, icon:"✅", color:"#34d399" },
            { label:"Stock bajo", value:stats.bajos, icon:"⚠️", color:"#ff9500" },
            { label:"Agotados", value:stats.agotados, icon:"🚨", color:"#ff3b5c" },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontSize:28, fontWeight:600, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:11, color:"#5a6480", marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
          <input className="input" placeholder="🔍  Buscar bebida..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth:220, flex:"1 1 160px" }} />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button className={`filtro-btn ${filtro === "Todas" ? "active" : ""}`} onClick={() => setFiltro("Todas")}>Todas</button>
            {categorias.filter(cat => bebidas.some(b => b.categoria === cat)).map(cat => (
              <button key={cat} className={`filtro-btn ${filtro === cat ? "active" : ""}`} onClick={() => setFiltro(cat)}>{cat}</button>
            ))}
          </div>
        </div>

        {/* Table Header */}
        <div style={{ display:"grid", gridTemplateColumns: isAdmin ? "2fr 1.2fr 1fr 1fr 1fr 1fr 120px" : "2fr 1.2fr 1fr 1fr 1fr 1fr 60px", gap:12, padding:"6px 20px", marginBottom:6 }} className="hide-mobile">
          <SortBtn campo="nombre" label="Producto" />
          <SortBtn campo="categoria" label="Categoría" />
          <SortBtn campo="cantidad" label="Stock" />
          <SortBtn campo="minimo" label="Mínimo" />
          <SortBtn campo="estado" label="Estado" />
          <span style={{ fontSize:10, fontWeight:600, color:"#3a4460", textTransform:"uppercase", letterSpacing:"0.09em" }}>Últ. variación</span>
          <span></span>
        </div>

        {/* Rows */}
        {bebidasFiltradas.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"#3a4460" }}>
            <div style={{ fontSize:44, marginBottom:10 }}>🍾</div><p>No se encontraron bebidas</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {bebidasFiltradas.map(b => {
              const estado = getEstado(b.cantidad, b.minimo);
              const cfg = estadoConfig[estado];
              return (
                <div key={b.id} className={`card-row ${!isAdmin ? "card-row-worker" : ""}`}>
                  <div style={{ cursor:"pointer" }} onClick={() => abrirFicha(b)}>
                    <div style={{ fontWeight:500, fontSize:14, color:"#e8eaf0" }}>{b.nombre}</div>
                    {isAdmin && <div style={{ fontSize:11, color:"#5a6480", marginTop:2 }}>
                      {b.precio.toFixed(2)} € / {b.unidad}
                      {b.proveedor && <span style={{ marginLeft:8, color:"#4a5580" }}>· {b.proveedor}</span>}
                    </div>}
                    {!isAdmin && <div style={{ fontSize:11, color:"#5a6480", marginTop:2 }}>{b.unidad}</div>}
                  </div>
                  <span className="pill" style={{ background:"rgba(79,127,255,0.1)", color:"#6a9fff", fontSize:11 }}>{b.categoria}</span>
                  <div>
                    <span style={{ fontSize:19, fontWeight:600, color:cfg.color }}>{b.cantidad}</span>
                    <span style={{ fontSize:11, color:"#5a6480", marginLeft:4 }}>{b.unidad}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#5a6480" }}>{b.minimo} {b.unidad}</div>
                  <span className="pill" style={{ background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                  <div style={{ fontSize:11, color:"#5a6480" }}>
                    {b.ultimaVariacion ? (
                      <div>
                        <div>{fmtFecha(b.ultimaVariacion)}</div>
                        {b.ultimoUsuario && <div style={{ color:"#4a5580", fontSize:10, marginTop:2 }}>👤 {b.ultimoUsuario}</div>}
                      </div>
                    ) : <span style={{ color:"#3a4460" }}>—</span>}
                  </div>
                  <div style={{ display:"flex", gap:5 }}>
                    <button className="icon-btn" onClick={() => abrirAjuste(b)} style={{ background:"rgba(52,211,153,0.1)", color:"#34d399" }} title="Ajustar stock">±</button>
                    {isAdmin && <>
                      <button className="icon-btn" onClick={() => abrirEditar(b)} style={{ background:"rgba(79,127,255,0.1)", color:"#4f7fff" }} title="Editar">✏️</button>
                      <button className="icon-btn" onClick={() => eliminar(b.id)} style={{ background:"rgba(255,59,92,0.1)", color:"#ff3b5c" }} title="Eliminar">🗑</button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bebidas.some(b => ["agotado","bajo"].includes(getEstado(b.cantidad, b.minimo))) && (
          <div style={{ marginTop:28, background:"rgba(255,149,0,0.06)", border:"1.5px solid rgba(255,149,0,0.18)", borderRadius:14, padding:"18px 22px" }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:"#ff9500", marginBottom:10 }}>⚠️ Requieren reposición</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {bebidas.filter(b => ["agotado","bajo"].includes(getEstado(b.cantidad, b.minimo))).map(b => (
                <span key={b.id} className="pill" style={{ background:estadoConfig[getEstado(b.cantidad, b.minimo)].bg, color:estadoConfig[getEstado(b.cantidad, b.minimo)].color, fontSize:12, padding:"5px 12px" }}>
                  {b.nombre} — {b.cantidad} {b.unidad}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Ficha de producto ── */}
      {modal === "ficha" && seleccionada && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:22 }}>{seleccionada.nombre}</h2>
                <span className="pill" style={{ background:"rgba(79,127,255,0.1)", color:"#6a9fff", marginTop:6, display:"inline-block" }}>{seleccionada.categoria}</span>
              </div>
              {(() => { const cfg = estadoConfig[getEstado(seleccionada.cantidad, seleccionada.minimo)];
                return <span className="pill" style={{ background:cfg.bg, color:cfg.color, fontSize:13, padding:"5px 14px" }}>{cfg.label}</span>; })()}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              {[
                { label:"Stock actual", value:`${seleccionada.cantidad} ${seleccionada.unidad}`, color:"#e8eaf0" },
                { label:"Stock mínimo", value:`${seleccionada.minimo} ${seleccionada.unidad}`, color:"#7a84a0" },
                ...(isAdmin ? [
                  { label:"Precio unitario", value:`${seleccionada.precio?.toFixed(2)} €`, color:"#34d399" },
                  { label:"Valor total", value:`${(seleccionada.cantidad * seleccionada.precio).toFixed(2)} €`, color:"#34d399" },
                ] : []),
                ...(seleccionada.proveedor ? [{ label:"Proveedor", value:seleccionada.proveedor, color:"#a78bfa" }] : []),
              ].map((item, i) => (
                <div key={i} style={{ background:"#0f1420", borderRadius:10, padding:"12px 14px", border:"1px solid #1a2035" }}>
                  <div style={{ fontSize:11, color:"#5a6480", marginBottom:4 }}>{item.label}</div>
                  <div style={{ fontSize:16, fontWeight:600, color:item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Último movimiento */}
            <div style={{ background:"#0f1420", borderRadius:12, padding:"14px 16px", border:"1px solid #1a2035" }}>
              <h3 style={{ fontSize:12, fontWeight:600, color:"#a78bfa", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Último movimiento</h3>
              {ultimoMov ? (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span className="pill" style={{ background:ultimoMov.tipo==="entrada"?"rgba(52,211,153,0.15)":"rgba(255,59,92,0.15)", color:ultimoMov.tipo==="entrada"?"#34d399":"#ff3b5c" }}>
                      {ultimoMov.tipo === "entrada" ? "📥 Entrada" : "📤 Salida"}
                    </span>
                    <span style={{ fontWeight:600, fontSize:16, color:ultimoMov.tipo==="entrada"?"#34d399":"#ff3b5c" }}>
                      {ultimoMov.tipo==="entrada"?"+":"-"}{ultimoMov.cantidad} {ultimoMov.unidad}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"#7a84a0" }}>
                    {ultimoMov.cantidadAnterior} → {ultimoMov.cantidadNueva} {ultimoMov.unidad}
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:12, color:"#5a6480" }}>
                    <span>📅 {fmtFecha(ultimoMov.fecha)}</span>
                    <span>👤 {ultimoMov.usuario}</span>
                  </div>
                  {ultimoMov.nota && <div style={{ fontSize:12, color:"#4a5580", fontStyle:"italic" }}>"{ultimoMov.nota}"</div>}
                </div>
              ) : (
                <p style={{ fontSize:13, color:"#3a4460" }}>Sin movimientos registrados</p>
              )}
            </div>

            <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
              {isAdmin && <button className="btn" onClick={() => { setModal(null); setTimeout(() => abrirEditar(seleccionada), 50); }} style={{ background:"rgba(79,127,255,0.1)", color:"#4f7fff", padding:"10px 18px", fontSize:13 }}>✏️ Editar</button>}
              <button className="btn" onClick={() => { setModal(null); setTimeout(() => abrirAjuste(seleccionada), 50); }} style={{ background:"#34d399", color:"#0a0e1a", padding:"10px 18px", fontSize:13, fontWeight:600 }}>± Ajustar stock</button>
              <button className="btn" onClick={() => setModal(null)} style={{ background:"#1e2540", color:"#a0aac0", padding:"10px 18px", fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nueva / Editar ── */}
      {(modal === "nueva" || modal === "editar") && isAdmin && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:22, marginBottom:20 }}>{modal === "nueva" ? "Nueva Bebida" : "Editar Bebida"}</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Nombre</label>
                <input className="input" placeholder="Ej: Coca-Cola Zero" value={form.nombre} onChange={e => setForm({ ...form, nombre:e.target.value })} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Categoría</label>
                  <select className="input" value={form.categoria} onChange={e => setForm({ ...form, categoria:e.target.value })}>
                    {categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Unidad</label>
                  <select className="input" value={form.unidad} onChange={e => setForm({ ...form, unidad:e.target.value })}>
                    {unidades.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Stock actual</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.cantidad} onChange={e => setForm({ ...form, cantidad:e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Stock mínimo</label>
                  <input className="input" type="number" min="0" placeholder="0" value={form.minimo} onChange={e => setForm({ ...form, minimo:e.target.value })} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Precio unitario (€)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.precio} onChange={e => setForm({ ...form, precio:e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Proveedor <span style={{ color:"#3a4460" }}>(opcional)</span></label>
                  <input className="input" placeholder="Ej: Mahou, Codorniu..." value={form.proveedor} onChange={e => setForm({ ...form, proveedor:e.target.value })} />
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background:"#1e2540", color:"#7a84a0", padding:"10px 18px", fontSize:13 }}>Cancelar</button>
              <button className="btn" onClick={modal === "nueva" ? guardarNueva : guardarEditar} style={{ background:"#4f7fff", color:"white", padding:"10px 20px", fontSize:13 }}>
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
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:22, marginBottom:6 }}>Ajustar Stock</h2>
            <p style={{ fontSize:14, color:"#5a6480", marginBottom:16 }}>
              {seleccionada.nombre} — actual: <strong style={{ color:"#e8eaf0" }}>{seleccionada.cantidad} {seleccionada.unidad}</strong>
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {["entrada","salida"].map(t => (
                <button key={t} className="btn" onClick={() => setAjuste({ ...ajuste, tipo:t })}
                  style={{ flex:1, padding:"10px", fontSize:14, background:ajuste.tipo===t?(t==="entrada"?"#34d399":"#ff3b5c"):"#1e2540", color:ajuste.tipo===t?"#0a0e1a":"#5a6480", fontWeight:ajuste.tipo===t?600:400 }}>
                  {t === "entrada" ? "📥 Entrada" : "📤 Salida"}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Cantidad ({seleccionada.unidad})</label>
                <input className="input" type="number" min="1" placeholder="0" value={ajuste.cantidad} onChange={e => setAjuste({ ...ajuste, cantidad:e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:6 }}>Nota <span style={{ color:"#3a4460" }}>(opcional)</span></label>
                <input className="input" placeholder="Ej: Pedido semanal, servicio cena..." value={ajuste.nota} onChange={e => setAjuste({ ...ajuste, nota:e.target.value })} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background:"#1e2540", color:"#7a84a0", padding:"10px 18px", fontSize:13 }}>Cancelar</button>
              <button className="btn" onClick={guardarAjuste} style={{ background:ajuste.tipo==="entrada"?"#34d399":"#ff3b5c", color:"#0a0e1a", padding:"10px 20px", fontSize:13, fontWeight:600 }}>
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
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:22, marginBottom:16 }}>📈 Historial de Movimientos</h2>

            {/* Filtros rápidos */}
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {[{k:"7d",l:"Últimos 7 días"},{k:"30d",l:"Últimos 30 días"},{k:"hoy",l:"Hoy"}].map(f => (
                <button key={f.k} className={`filtro-btn ${histFiltro.rapido===f.k?"active":""}`} onClick={() => aplicarFiltroRapido(f.k)}>{f.l}</button>
              ))}
            </div>

            {/* Filtro por fechas */}
            <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:"#5a6480", display:"block", marginBottom:5 }}>Desde</label>
                <input className="input" type="date" value={histFiltro.desde} onChange={e => setHistFiltro(p => ({ ...p, desde:e.target.value, rapido:"" }))} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:"#5a6480", display:"block", marginBottom:5 }}>Hasta</label>
                <input className="input" type="date" value={histFiltro.hasta} onChange={e => setHistFiltro(p => ({ ...p, hasta:e.target.value, rapido:"" }))} />
              </div>
              <button className="btn" onClick={aplicarFiltroFechas} style={{ background:"#4f7fff", color:"white", padding:"10px 16px", fontSize:13, whiteSpace:"nowrap" }}>Buscar</button>
            </div>

            {/* Filtros por categoría y producto */}
            <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:140 }}>
                <label style={{ fontSize:11, color:"#5a6480", display:"block", marginBottom:5 }}>Categoría</label>
                <select className="input" value={histFiltro.categoria} onChange={e => setHistFiltro(p => ({ ...p, categoria:e.target.value }))}>
                  <option value="Todas">Todas las categorías</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:140 }}>
                <label style={{ fontSize:11, color:"#5a6480", display:"block", marginBottom:5 }}>Producto</label>
                <input className="input" placeholder="Buscar producto..." value={histFiltro.producto} onChange={e => setHistFiltro(p => ({ ...p, producto:e.target.value }))} />
              </div>
            </div>

            {cargandoHist ? (
              <div style={{ textAlign:"center", padding:"30px", color:"#5a6480" }}>Cargando...</div>
            ) : histFiltrado.length === 0 ? (
              <div style={{ textAlign:"center", padding:"30px", color:"#3a4460" }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                <p>No hay movimientos en este período</p>
              </div>
            ) : (
              <>
                {/* Resumen */}
                <div style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize:13, fontWeight:600, color:"#a78bfa", marginBottom:10 }}>
                    Resumen del período <span style={{ color:"#3a4460", fontWeight:400 }}>({Object.keys(resumenHistorial).length} productos)</span>
                  </h3>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 80px 80px 80px", gap:8, padding:"5px 14px", marginBottom:4 }} className="hide-mobile">
                    {["Bebida","Categoría","Entradas","Salidas","Neto"].map(h => (
                      <span key={h} style={{ fontSize:10, fontWeight:600, color:"#3a4460", textTransform:"uppercase" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:180, overflowY:"auto" }}>
                    {Object.values(resumenHistorial).map(r => (
                      <div key={r.nombre} className="resumen-row">
                        <span style={{ fontWeight:500 }}>{r.nombre}</span>
                        <span style={{ color:"#6a9fff", fontSize:12 }}>{r.categoria}</span>
                        <span style={{ color:"#34d399", fontWeight:600 }}>+{r.entradas} <span style={{ fontSize:10, color:"#5a6480" }}>{r.unidad}</span></span>
                        <span style={{ color:"#ff3b5c", fontWeight:600 }}>-{r.salidas} <span style={{ fontSize:10, color:"#5a6480" }}>{r.unidad}</span></span>
                        <span style={{ color: r.entradas-r.salidas >= 0 ? "#34d399" : "#ff3b5c", fontWeight:600 }}>{r.entradas-r.salidas >= 0 ? "+" : ""}{r.entradas-r.salidas}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Movimientos detallados */}
                <div>
                  <h3 style={{ fontSize:13, fontWeight:600, color:"#a78bfa", marginBottom:10 }}>
                    Movimientos detallados <span style={{ color:"#3a4460", fontWeight:400 }}>({histFiltrado.length})</span>
                  </h3>
                  <div style={{ display:"grid", gridTemplateColumns:"130px 1fr 70px 70px 90px 90px", gap:8, padding:"5px 14px", marginBottom:4 }} className="hide-mobile">
                    {["Fecha","Bebida","Tipo","Cant.","Stock","Usuario"].map(h => (
                      <span key={h} style={{ fontSize:10, fontWeight:600, color:"#3a4460", textTransform:"uppercase" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:300, overflowY:"auto" }}>
                    {histFiltrado.map(m => (
                      <div key={m.id} className="hist-row">
                        <span style={{ fontSize:11, color:"#5a6480" }}>{fmtFecha(m.fecha)}</span>
                        <div>
                          <div style={{ fontWeight:500 }}>{m.bebidaNombre}</div>
                          {m.nota && <div style={{ fontSize:10, color:"#5a6480" }}>{m.nota}</div>}
                        </div>
                        <span className="pill" style={{ background:m.tipo==="entrada"?"rgba(52,211,153,0.15)":"rgba(255,59,92,0.15)", color:m.tipo==="entrada"?"#34d399":"#ff3b5c", fontSize:10 }}>
                          {m.tipo === "entrada" ? "📥" : "📤"} {m.tipo}
                        </span>
                        <span style={{ fontWeight:600, color:m.tipo==="entrada"?"#34d399":"#ff3b5c" }}>{m.tipo==="entrada"?"+":"-"}{m.cantidad}</span>
                        <span style={{ fontSize:11, color:"#7a84a0" }}>{m.cantidadAnterior}→{m.cantidadNueva}</span>
                        <span style={{ fontSize:11, color:"#5a6480" }}>{m.usuario}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:22 }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background:"#1e2540", color:"#a0aac0", padding:"10px 20px", fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Categorías ── */}
      {modal === "categorias" && isAdmin && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'DM Serif Display', serif", fontSize:22, marginBottom:6 }}>Gestionar Categorías</h2>
            <p style={{ fontSize:13, color:"#5a6480", marginBottom:20 }}>Crea, edita o elimina categorías.</p>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:8 }}>Nueva categoría</label>
              <div style={{ display:"flex", gap:8 }}>
                <input className="input" placeholder="Ej: Kombuchá, Sidra..." value={nuevaCategoria}
                  onChange={e => { setNuevaCategoria(e.target.value); setCatError(""); }}
                  onKeyDown={e => e.key === "Enter" && agregarCategoria()} />
                <button className="btn" onClick={agregarCategoria} style={{ background:"#4f7fff", color:"white", padding:"10px 16px", fontSize:13, whiteSpace:"nowrap" }}>+ Crear</button>
              </div>
              {catError && <p style={{ fontSize:12, color:"#ff3b5c", marginTop:6 }}>{catError}</p>}
            </div>
            <div>
              <label style={{ fontSize:12, color:"#5a6480", display:"block", marginBottom:10 }}>Categorías existentes ({categorias.length})</label>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
                {categorias.map(cat => {
                  const count = bebidas.filter(b => b.categoria === cat).length;
                  const isEditing = editingCat?.original === cat;
                  return (
                    <div key={cat} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"#151b30", border:`1.5px solid ${isEditing ? "#4f7fff" : "#1e2540"}`, borderRadius:10 }}>
                      {isEditing ? (
                        <>
                          <input className="input" value={editingCat.nuevo} onChange={e => setEditingCat({ ...editingCat, nuevo:e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") renombrarCategoria(); if (e.key === "Escape") setEditingCat(null); }}
                            autoFocus style={{ flex:1, padding:"6px 10px", fontSize:13 }} />
                          <button className="btn" onClick={renombrarCategoria} style={{ background:"#34d399", color:"#0a0e1a", padding:"6px 12px", fontSize:12, whiteSpace:"nowrap" }}>✓ Guardar</button>
                          <button className="btn" onClick={() => setEditingCat(null)} style={{ background:"#1e2540", color:"#7a84a0", padding:"6px 10px", fontSize:12 }}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex:1, fontSize:13 }}>{cat}</span>
                          {count > 0 && <span style={{ fontSize:11, color:"#4f7fff", background:"rgba(79,127,255,0.12)", padding:"1px 7px", borderRadius:20 }}>{count}</span>}
                          <button onClick={() => setEditingCat({ original:cat, nuevo:cat })} style={{ width:26, height:26, borderRadius:6, background:"rgba(79,127,255,0.1)", color:"#4f7fff", border:"none", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✏️</button>
                          <button onClick={() => eliminarCategoria(cat)} style={{ width:26, height:26, borderRadius:6, background:"rgba(255,59,92,0.1)", color:"#ff3b5c", border:"none", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize:11, color:"#3a4460", marginTop:10 }}>Al renombrar, todas las bebidas de esa categoría se actualizarán automáticamente.</p>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:22 }}>
              <button className="btn" onClick={() => setModal(null)} style={{ background:"#1e2540", color:"#a0aac0", padding:"10px 20px", fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ background:toast.tipo==="error"?"#ff3b5c":"#34d399", color:"#0a0e1a" }}>
          {toast.tipo === "error" ? "⚠️" : "✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}
