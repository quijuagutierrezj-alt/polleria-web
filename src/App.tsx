import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import "./index.css";

type Rol = "Administrador" | "Mozo" | "Cocina";

type Mesa = {
  id: number;
  ocupada: boolean;
};

type Producto = {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
};

type ItemPedido = {
  productoId: number;
  nombre: string;
  precio: number;
  cantidad: number;
};

type Pedido = {
  id: number;
  mesa: number | "Para llevar";
  items: ItemPedido[];
  total: number;
  estado: "Pendiente" | "Preparado";
  fecha: string;
};

const calcularTotal = (items: ItemPedido[]): number => {
  const totalCentimos = items.reduce((suma, item) => {
    const precioCentimos = Math.round(Number(item.precio) * 100);
    const cantidad = Number(item.cantidad);
    return suma + precioCentimos * cantidad;
  }, 0);

  return totalCentimos / 100;
};

function App() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [ingresado, setIngresado] = useState(false);
  const [error, setError] = useState("");
  const [errorFirebase, setErrorFirebase] = useState("");
  const [seccion, setSeccion] = useState("Inicio");
  const [rol, setRol] = useState<Rol>("Administrador");

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<
    number | "Para llevar" | null
  >(null);
  const [carrito, setCarrito] = useState<ItemPedido[]>([]);

  // Escucha los cambios de Firestore en tiempo real en todos los dispositivos.
  useEffect(() => {
    const cancelarEscucha = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const pedidosActualizados = snapshot.docs.map((documento) => {
          const datos = documento.data() as Pedido;
          return {
            ...datos,
            id: Number(datos.id ?? documento.id),
          };
        });

        pedidosActualizados.sort((a, b) => b.id - a.id);
        setPedidos(pedidosActualizados);
        setErrorFirebase("");
      },
      (error) => {
        console.error("Error al escuchar pedidos de Firestore:", error);
        setErrorFirebase(
          "No se pudo conectar con Firestore. Revisa tu conexión y las reglas de seguridad."
        );
      }
    );

    return () => cancelarEscucha();
  }, []);

  const productos: Producto[] = [
    { id: 1, nombre: "Pollo entero", categoria: "Pollos", precio: 65 },
    { id: 2, nombre: "1/2 Pollo", categoria: "Pollos", precio: 35 },
    { id: 3, nombre: "1/4 Pollo", categoria: "Pollos", precio: 20 },
    { id: 4, nombre: "Gaseosa personal", categoria: "Bebidas", precio: 4 },
    { id: 5, nombre: "Gaseosa 1 litro", categoria: "Bebidas", precio: 8 },
    { id: 6, nombre: "Papas fritas", categoria: "Adicionales", precio: 10 },
    { id: 7, nombre: "Ensalada", categoria: "Adicionales", precio: 7 },
    { id: 8, nombre: "Porción de arroz", categoria: "Adicionales", precio: 6 },
  ];

  const mesas: Mesa[] = Array.from({ length: 6 }, (_, i) => {
    const id = i + 1;
    return {
      id,
      ocupada: pedidos.some(
        (pedido) => pedido.mesa === id
      ),
    };
  });

  const nombreMesa = (mesa: number | "Para llevar") =>
    mesa === "Para llevar" ? "Para llevar" : `Mesa ${mesa}`;

  const disponibles = mesas.filter((mesa) => !mesa.ocupada).length;
  const ocupadas = mesas.filter((mesa) => mesa.ocupada).length;

  const pedidosPendientes = pedidos.filter(
    (pedido) => pedido.estado === "Pendiente"
  );

  const ventas = pedidos
    .filter((pedido) => pedido.estado === "Preparado")
    .reduce((total, pedido) => total + pedido.total, 0);

  const totalCarrito = calcularTotal(carrito);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (usuario === "admin" && password === "123456") {
      setRol("Administrador");
      setSeccion("Inicio");
      setIngresado(true);
      setError("");
    } else if (usuario === "mozo" && password === "mozo123") {
      setRol("Mozo");
      setSeccion("Mesas");
      setIngresado(true);
      setError("");
    } else if (usuario === "cocina" && password === "cocina123") {
      setRol("Cocina");
      setSeccion("Cocina");
      setIngresado(true);
      setError("");
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  const cerrarSesion = () => {
    setIngresado(false);
    setUsuario("");
    setPassword("");
    setRol("Administrador");
    setSeccion("Inicio");
    setCarrito([]);
    setMesaSeleccionada(null);
  };

  const seleccionarMesa = (id: number | "Para llevar") => {
    if (id !== "Para llevar") {
      const mesa = mesas.find((m) => m.id === id);

      if (!mesa || mesa.ocupada) {
        alert("Esta mesa ya tiene un pedido activo.");
        return;
      }
    }

    setMesaSeleccionada(id);
    setCarrito([]);
    setSeccion("Pedidos");
  };

  const agregarProducto = (producto: Producto) => {
    setCarrito((actual) => {
      const existe = actual.find((item) => item.productoId === producto.id);

      if (existe) {
        return actual.map((item) =>
          item.productoId === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [
        ...actual,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (productoId: number, cambio: number) => {
    setCarrito((actual) =>
      actual
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: item.cantidad + cambio }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  const registrarPedido = async () => {
    if (mesaSeleccionada === null) {
      alert("Selecciona una mesa antes de registrar el pedido.");
      return;
    }

    if (carrito.length === 0) {
      alert("Agrega al menos un producto al pedido.");
      return;
    }

    const totalPedido = calcularTotal(carrito);

    const nuevoPedido: Pedido = {
      id: Date.now(),
      mesa: mesaSeleccionada,
      items: [...carrito],
      total: totalPedido,
      estado: "Pendiente",
      fecha: new Date().toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    try {
      await setDoc(doc(db, "pedidos", String(nuevoPedido.id)), nuevoPedido);
      setCarrito([]);
      setMesaSeleccionada(null);
      setSeccion("Mesas");
      alert("¡Pedido enviado correctamente a cocina!");
    } catch (error) {
      console.error("Error al registrar el pedido:", error);
      alert(
        "No se pudo guardar el pedido. Revisa la conexión y las reglas de Firestore."
      );
    }
  };

  const marcarPreparado = async (id: number) => {
    try {
      await updateDoc(doc(db, "pedidos", String(id)), {
        estado: "Preparado",
      });
    } catch (error) {
      console.error("Error al actualizar el pedido:", error);
      alert("No se pudo actualizar el pedido en Firestore.");
    }
  };

  const finalizarServicio = async (id: number) => {
    const pedido = pedidos.find((p) => p.id === id);

    if (!pedido) return;

    if (pedido.estado !== "Preparado") {
      alert("La cocina todavía no ha preparado este pedido.");
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas finalizar el pedido de ${nombreMesa(pedido.mesa)}?`
    );

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "pedidos", String(id)));
      alert("Servicio finalizado. La mesa está disponible.");
    } catch (error) {
      console.error("Error al finalizar el pedido:", error);
      alert("No se pudo finalizar el pedido en Firestore.");
    }
  };

  const menu = [
    { nombre: "Inicio", icono: "🏠" },
    { nombre: "Mesas", icono: "🪑" },
    { nombre: "Productos", icono: "🍗" },
    { nombre: "Pedidos", icono: "📋" },
    { nombre: "Cocina", icono: "👨‍🍳" },
    { nombre: "Caja", icono: "💰" },
  ];

  const menuVisible = menu.filter((item) => {
    if (rol === "Administrador") return true;
    if (rol === "Mozo") return ["Mesas", "Pedidos"].includes(item.nombre);
    if (rol === "Cocina") return item.nombre === "Cocina";
    return false;
  });

  if (!ingresado) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">🍗</div>
          <h1>POLLERÍA</h1>
          <p className="subtitle">Sistema de gestión y pedidos</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Usuario</label>
              <input
                type="text"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit">Iniciar sesión</button>
          </form>

          <p className="footer">Sistema de gestión de pollería © 2026</p>
        </div>
      </div>
    );
  }

  const contenido = () => {
    switch (seccion) {
      case "Mesas":
        return (
          <>
            <h2>Gestión de mesas</h2>
            <p className="section-description">
              Selecciona una mesa disponible para registrar un pedido.
            </p>

            <div className="stats-grid">
              <div className="stat-card">
                <span>🟢 Mesas disponibles</span>
                <h3>{disponibles}</h3>
              </div>
              <div className="stat-card">
                <span>🔴 Mesas ocupadas</span>
                <h3>{ocupadas}</h3>
              </div>
              <div className="stat-card">
                <span>🪑 Total de mesas</span>
                <h3>{mesas.length}</h3>
              </div>
            </div>

            <h3 className="subheading">Estado de las mesas</h3>

            <div className="data-grid">
              {mesas.map((mesa) => {
                const pedidoMesa = pedidos.find((p) => p.mesa === mesa.id);

                return (
                  <div
                    className={
                      mesa.ocupada
                        ? "mesa-card mesa-ocupada"
                        : "mesa-card mesa-disponible"
                    }
                    key={mesa.id}
                  >
                    <span className="mesa-icon">🪑</span>
                    <h3>Mesa {mesa.id}</h3>

                    <p className={mesa.ocupada ? "occupied" : "available"}>
                      {mesa.ocupada ? "Ocupada" : "Disponible"}
                    </p>

                    {mesa.ocupada ? (
                      <>
                        <p>
                          {pedidoMesa
                            ? `Pedido #${pedidoMesa.id.toString().slice(-5)}`
                            : "Servicio activo"}
                        </p>
                        {rol === "Administrador" && (
                          <p>
                            {pedidoMesa
                              ? `S/ ${pedidoMesa.total.toFixed(2)}`
                              : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        className="btn-ocupar"
                        onClick={() => seleccionarMesa(mesa.id)}
                      >
                        Crear pedido
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="mesa-card mesa-disponible">
                <span className="mesa-icon">🛍️</span>
                <h3>Para llevar</h3>
                <p className="available">Disponible</p>
                <button
                  className="btn-ocupar"
                  onClick={() => seleccionarMesa("Para llevar")}
                >
                  Crear pedido
                </button>
              </div>
            </div>
          </>
        );

      case "Productos":
        return (
          <>
            <h2>Productos</h2>
            <p className="section-description">
              Lista de productos disponibles.
            </p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto) => (
                    <tr key={producto.id}>
                      <td>{producto.nombre}</td>
                      <td>{producto.categoria}</td>
                      <td>S/ {producto.precio.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );

      case "Pedidos":
        return (
          <>
            <h2>Registro de pedidos</h2>
            <p className="section-description">
              Selecciona una mesa y agrega los productos.
            </p>

            <div className="pedido-form">
              <div className="pedido-cabecera">
                <label>Seleccionar mesa</label>
                <select
                  value={mesaSeleccionada ?? ""}
                  onChange={(e) =>
                    setMesaSeleccionada(
                      e.target.value === "Para llevar"
                        ? "Para llevar"
                        : e.target.value
                          ? Number(e.target.value)
                          : null
                    )
                  }
                >
                  <option value="">Seleccionar mesa</option>
                  <option value="Para llevar">Para llevar</option>
                  {mesas
                    .filter((mesa) => !mesa.ocupada)
                    .map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        Mesa {mesa.id}
                      </option>
                    ))}
                </select>
              </div>

              <h3 className="subheading">Productos disponibles</h3>

              <div className="productos-pedido">
                {productos.map((producto) => (
                  <div className="producto-pedido" key={producto.id}>
                    <div>
                      <strong>{producto.nombre}</strong>
                      <small>{producto.categoria}</small>
                      <p>S/ {producto.precio.toFixed(2)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => agregarProducto(producto)}
                    >
                      + Agregar
                    </button>
                  </div>
                ))}
              </div>

              <h3 className="subheading">Detalle del pedido</h3>

              {carrito.length === 0 ? (
                <div className="empty-state">
                  <span>🛒</span>
                  <h3>Carrito vacío</h3>
                  <p>Agrega productos para crear un pedido.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrito.map((item) => (
                        <tr key={item.productoId}>
                          <td>{item.nombre}</td>
                          <td>S/ {item.precio.toFixed(2)}</td>
                          <td>
                            <div className="cantidad-control">
                              <button
                                type="button"
                                onClick={() =>
                                  cambiarCantidad(item.productoId, -1)
                                }
                              >
                                -
                              </button>
                              <strong>{item.cantidad}</strong>
                              <button
                                type="button"
                                onClick={() =>
                                  cambiarCantidad(item.productoId, 1)
                                }
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            S/ {(item.precio * item.cantidad).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pedido-total">
                <h3>Total del pedido</h3>
                <strong>S/ {totalCarrito.toFixed(2)}</strong>
              </div>

              <button
                type="button"
                className="btn-enviar-pedido"
                onClick={registrarPedido}
              >
                👨‍🍳 Enviar pedido a cocina
              </button>
            </div>

            <h3 className="subheading">Pedidos registrados</h3>

            {pedidos.length === 0 ? (
              <p>No hay pedidos registrados todavía.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Mesa</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((pedido) => (
                      <tr key={pedido.id}>
                        <td>#{pedido.id.toString().slice(-5)}</td>
                        <td>{nombreMesa(pedido.mesa)}</td>
                        <td>S/ {pedido.total.toFixed(2)}</td>
                        <td>{pedido.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case "Cocina":
        return (
          <>
            <h2 style={{ textAlign: "center" }}>Panel de cocina</h2>

            <p
              className="section-description"
              style={{ textAlign: "center" }}
            >
              Comandas pendientes de preparación.
            </p>

            {pedidos.length === 0 ? (
              <div className="empty-state">
                <span>👨‍🍳</span>
                <h3>No hay comandas pendientes</h3>
                <p>Cuando se registren pedidos, aparecerán aquí.</p>
              </div>
            ) : (
              <div
                className="comandas-grid"
                style={{ justifyContent: "center" }}
              >
                {pedidos.map((pedido) => (
                  <div className="comanda-card" key={pedido.id}>
                    <div className="comanda-header">
                      <div>
                        <h3>{nombreMesa(pedido.mesa)}</h3>
                        <small>
                          Pedido #{pedido.id.toString().slice(-5)}
                        </small>
                      </div>

                      <span
                        className={
                          pedido.estado === "Pendiente"
                            ? "estado-pendiente"
                            : "estado-preparado"
                        }
                      >
                        {pedido.estado}
                      </span>
                    </div>

                    <p className="hora-pedido">Hora: {pedido.fecha}</p>

                    <div className="comanda-productos">
                      {pedido.items.map((item) => (
                        <div key={item.productoId}>
                          <span>
                            {item.cantidad} x {item.nombre}
                          </span>
                        </div>
                      ))}
                    </div>

                    {pedido.estado === "Pendiente" ? (
                      <button
                        type="button"
                        className="btn-preparado"
                        onClick={() => marcarPreparado(pedido.id)}
                      >
                        ✓ Marcar como preparado
                      </button>
                    ) : (
                      <>
                        <p className="mensaje-preparado">
                          ✓ Pedido listo para entregar
                        </p>
                        {rol !== "Mozo" && (
                          <button
                            type="button"
                            className="btn-preparado"
                            onClick={() => finalizarServicio(pedido.id)}
                          >
                            Finalizar servicio
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        );

      case "Caja":
        return (
          <>
            <h2>Caja</h2>
            <p className="section-description">
              Resumen de pedidos del sistema.
            </p>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Pedidos registrados</span>
                <h3>{pedidos.length}</h3>
              </div>
              <div className="stat-card">
                <span>Pedidos pendientes</span>
                <h3>{pedidosPendientes.length}</h3>
              </div>
              <div className="stat-card">
                <span>Ventas de pedidos preparados</span>
                <h3>S/ {ventas.toFixed(2)}</h3>
              </div>
            </div>

            <p className="section-description">
              El cobro y cierre de cuentas se implementará en la siguiente etapa.
            </p>
          </>
        );

      default:
        return (
          <>
            <h2>Panel principal</h2>
            <p className="section-description">
              Bienvenido al sistema de administración de la pollería.
            </p>

            <div className="stats-grid">
              <div className="stat-card">
                <span>🪑 Mesas disponibles</span>
                <h3>{disponibles}</h3>
              </div>
              <div className="stat-card">
                <span>🔴 Mesas ocupadas</span>
                <h3>{ocupadas}</h3>
              </div>
              <div className="stat-card">
                <span>📋 Pedidos registrados</span>
                <h3>{pedidos.length}</h3>
              </div>
              <div className="stat-card">
                <span>👨‍🍳 Comandas pendientes</span>
                <h3>{pedidosPendientes.length}</h3>
              </div>
            </div>

            <div className="welcome-panel">
              <h3>¡Bienvenido, administrador!</h3>
              <p>
                Desde el menú lateral puedes administrar las mesas,
                productos, pedidos y cocina.
              </p>
            </div>
          </>
        );
    }
  };

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <span>🍗</span>
          <div>
            <h2>POLLERÍA</h2>
            <small>ADMINISTRACIÓN</small>
          </div>
        </div>

        <p className="menu-title">MENÚ PRINCIPAL</p>

        <nav>
          {menuVisible.map((item) => (
            <button
              type="button"
              key={item.nombre}
              className={
                seccion === item.nombre ? "menu-item active" : "menu-item"
              }
              onClick={() => setSeccion(item.nombre)}
            >
              <span>{item.icono}</span>
              {item.nombre}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={cerrarSesion}
        >
          🚪 Cerrar sesión
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{seccion}</h1>
            <p>Sistema de gestión de pollería</p>
          </div>

          <div className="admin-profile">
            <span>👤</span>
            <div>
              <strong>{rol}</strong>
              <small>Usuario: {usuario}</small>
            </div>
          </div>
        </header>

        <section className="page-content">
          {errorFirebase && (
            <p role="alert" className="login-error">
              {errorFirebase}
            </p>
          )}
          {contenido()}
        </section>
      </main>
    </div>
  );
}

export default App;
