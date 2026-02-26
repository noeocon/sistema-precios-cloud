import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db } from './firebase'; 
import { doc, setDoc, getDoc } from "firebase/firestore"; 

function App() {
  const [listaVentaRoja, setListaVentaRoja] = useState([]);
  const [listaCompraVerde, setListaCompraVerde] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  // --- 1. CARGA AUTOMÁTICA DESDE FIREBASE ---
  useEffect(() => {
    const cargarDatosDesdeNube = async () => {
      try {
        const docRef = doc(db, "sistema", "precios_actuales");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setListaVentaRoja(data.venta || []);
          setListaCompraVerde(data.compra || []);
        }
      } catch (error) {
        console.error("Error al cargar de Firebase:", error);
      }
    };
    cargarDatosDesdeNube();
  }, []);

  // --- 2. LÓGICA PARA PROCESAR FILAS DEL EXCEL ---
const extraerDatos = (fila) => {
    const valores = Object.values(fila).map(v => String(v).trim());
    const codBusqueda = busqueda.trim().toUpperCase(); // El ID que escribiste
    
    // 1. Extraer Precio (Limpieza total de símbolos)
    let precioRaw = valores.find(v => v.includes('.') || (!isNaN(v) && v.length > 0)) || '0.00';
    const precioLimpio = precioRaw.replace(/[^0-9.]/g, ''); 

    // 2. Extraer Unidad (Mejorada)
    // Buscamos un valor corto, que NO sea el código que estamos buscando
    const unidad = valores.find(v => 
      v.length >= 1 && 
      v.length < 10 && 
      v.toUpperCase() !== codBusqueda && // <--- ESTO EVITA QUE SALGA EL ID
      (v.includes(' ') || /[A-Z]/.test(v)) // Debe tener letras
    ) || 'S/U';

    // 3. Extraer Descripción (El texto más largo)
    const descripcion = valores.reduce((a, b) => a.length > b.length ? a : b, "");
    
    return { descripcion, precio: precioLimpio, unidad };
  };

  const manejarArchivo = (e, tipo) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dataRaw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      // Detectar encabezado automáticamente buscando "Cod"
      const indexHeader = dataRaw.findIndex(row => row.some(c => String(c).toLowerCase().includes('cod')));
      const dataFinal = XLSX.utils.sheet_to_json(ws, { range: indexHeader > -1 ? indexHeader : 0 });
      
      if (tipo === 'roja') setListaVentaRoja(dataFinal);
      else setListaCompraVerde(dataFinal);
    };
    reader.readAsBinaryString(file);
  };

  // --- 3. GUARDADO EN LA NUBE ---
  const guardarEnNube = async () => {
    if (listaVentaRoja.length === 0 && listaCompraVerde.length === 0) {
      alert("Carga al menos un archivo antes de guardar.");
      return;
    }
    setCargando(true);
    try {
      await setDoc(doc(db, "sistema", "precios_actuales"), {
        venta: listaVentaRoja,
        compra: listaCompraVerde,
        ultimaActualizacion: new Date().toLocaleString()
      });
      alert("✅ ¡Datos guardados en la nube con éxito!");
    } catch (error) {
      console.error(error);
      alert("❌ Error al guardar. Revisa la consola.");
    }
    setCargando(false);
  };

  // --- 4. BUSCADOR ---
  const realizarBusqueda = () => {
    const cod = busqueda.trim().toUpperCase();
    if (!cod) return;

    const buscarEn = (lista) => lista.find(f => 
      Object.values(f).some(v => String(v).toUpperCase().includes(cod))
    );

    const filaVenta = buscarEn(listaVentaRoja);
    const filaCompra = buscarEn(listaCompraVerde);

    if (filaVenta || filaCompra) {
      const infoVenta = filaVenta ? extraerDatos(filaVenta) : { precio: '---', descripcion: '', unidad: 'S/U' };
      const infoCompra = filaCompra ? extraerDatos(filaCompra) : { precio: '---', descripcion: '', unidad: 'S/U' };

setResultado({
        id: cod,
        descripcion: (infoVenta.descripcion || infoCompra.descripcion).replace(cod, '').trim(),
        unidad: infoVenta.unidad !== 'S/U' ? infoVenta.unidad : infoCompra.unidad,
        precioVenta: infoVenta.precio,
        precioCompra: infoCompra.precio
      });
    } else {
      alert("Código no encontrado.");
      setResultado(null);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🚀 Sistema de Precios Cloud</h1>
      
      <div style={styles.row}>
        <div style={{ ...styles.card, background: '#ffebee', borderColor: '#ef5350' }}>
          <strong>🔴 Lista Roja (VENTA)</strong>
          <input type="file" onChange={(e) => manejarArchivo(e, 'roja')} style={styles.fileInput} />
        </div>
        <div style={{ ...styles.card, background: '#e8f5e9', borderColor: '#66bb6a' }}>
          <strong>🟢 Lista Verde (COMPRA)</strong>
          <input type="file" onChange={(e) => manejarArchivo(e, 'verde')} style={styles.fileInput} />
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '20px' }}>
        <button onClick={guardarEnNube} disabled={cargando} style={styles.btnCloud}>
          {cargando ? 'Subiendo datos...' : '☁️ Guardar Todo en la Nube'}
        </button>
      </div>

      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="ID del producto..." 
          value={busqueda} 
          onChange={(e) => setBusqueda(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && realizarBusqueda()}
          style={styles.input} 
        />
        <button onClick={realizarBusqueda} style={styles.button}>Consultar</button>
      </div>

      {resultado && (
        <div style={styles.resultCard}>
          <h2 style={styles.resId}>ID: {resultado.id}</h2>
          <p style={styles.resDesc}>
            <strong>Descripción:</strong> {resultado.descripcion} 
            <span style={styles.badgeUnidad}>{resultado.unidad}</span>
          </p>
          <hr style={styles.divider} />
          <div style={styles.row}>
            <div style={styles.priceItem}>
              <span style={styles.labelCompra}>Precio COMPRA (Verde)</span>
              <div style={styles.price}>${resultado.precioCompra}</div>
            </div>
            <div style={styles.priceItem}>
              <span style={styles.labelVenta}>Precio VENTA (Roja)</span>
              <div style={styles.price}>${resultado.precioVenta}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '40px', backgroundColor: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial' },
  title: { textAlign: 'center', color: '#2c3e50', marginBottom: '30px' },
  row: { display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' },
  card: { padding: '20px', borderRadius: '12px', border: '1px solid', flex: '1', minWidth: '250px' },
  fileInput: { marginTop: '10px', width: '100%' },
  btnCloud: { padding: '15px 30px', background: '#673ab7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' },
  searchContainer: { margin: '40px auto', maxWidth: '500px', display: 'flex', gap: '10px' },
  input: { flex: '1', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' },
  button: { padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#3498db', color: 'white', cursor: 'pointer', fontWeight: 'bold' },
  resultCard: { maxWidth: '700px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  resId: { color: '#2980b9', marginTop: 0 },
  resDesc: { fontSize: '1.1rem', color: '#34495e', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  divider: { margin: '20px 0', border: 'none', borderTop: '1px solid #eee' },
  priceItem: { flex: '1', textAlign: 'center' },
  price: { fontSize: '2.2rem', fontWeight: 'bold', color: '#2c3e50' },
  labelCompra: { color: '#27ae60', fontWeight: 'bold', fontSize: '0.9rem' },
  labelVenta: { color: '#e74c3c', fontWeight: 'bold', fontSize: '0.9rem' },
  badgeUnidad: {
    padding: '4px 12px',
    background: '#e1f5fe',
    color: '#0288d1',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    border: '1px solid #b3e5fc'
  }
};

export default App;