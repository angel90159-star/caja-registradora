// === CATÁLOGOS Y CONFIGURACIÓN ===
    const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxfRXih37n0ClO61EXtAYPMr2P4WoORwnGrs1rewdGsU_lIyjf2gZ68Qjk6PSAuwVjr/exec";
    const SECURITY_TOKEN = "sec_caja_90159_star_xyz";
    let ADMIN_SETTINGS_PIN = localStorage.getItem('caja_admin_settings_pin') || "072";
    const ADMIN_PIN = '02'; // Miguel — PIN de administrador
    const DEFAULT_OPERATORS = {
      "20": "Ingrid", "64": "Leticia", "02": "Miguel",
      "86": "Dita", "26": "Yoyis", "15": "Mabeli"
    };

    // Operadores se cargan desde localStorage (persistentes y editables)
    function getOperators() {
      if (!localStorage.getItem('lc5_operators')) {
        localStorage.setItem('lc5_operators', JSON.stringify(DEFAULT_OPERATORS));
      }
      return JSON.parse(localStorage.getItem('lc5_operators'));
    }
    function saveOperators(ops) {
      localStorage.setItem('lc5_operators', JSON.stringify(ops));
    }
    // Alias global para compatibilidad
    let Operators = getOperators();

    const DEFAULT_THRESHOLDS = {
      1000: 0,
      500: 0,
      200: 3,
      100: 5,
      50: 5,
      20: 8,
      10: 10,
      5: 10,
      2: 10,
      1: 10,
      0.5: 5
    };

    function getLowStockThresholds() {
      if (!localStorage.getItem('lc5_low_stock_thresholds')) {
        localStorage.setItem('lc5_low_stock_thresholds', JSON.stringify(DEFAULT_THRESHOLDS));
      }
      return JSON.parse(localStorage.getItem('lc5_low_stock_thresholds'));
    }

    function saveLowStockThresholds(thresholds) {
      localStorage.setItem('lc5_low_stock_thresholds', JSON.stringify(thresholds));
    }

    const Denominations = {
      billetes: [1000, 500, 200, 100, 50, 20],
      monedas: [10, 5, 2, 1, 0.5]
    };

    const SERVICE_BAR_CONFIGS = {
      'yastas': {
        title: 'Total Operativo Yastas',
        desc: 'Efectivo en charola + Terminal Yastas',
        label1: 'Charola',
        label2: 'Terminal',
        label3: 'Total',
        gradient: ['from-indigo-600', 'to-purple-600']
      },
      'banorte': {
        title: 'Operativo Banorte',
        desc: 'Saldo de Terminal Electrónica Banorte',
        label1: 'Inicial',
        label2: 'Flujo',
        label3: 'Total',
        gradient: ['from-rose-600', 'to-red-500']
      },
      'meli': {
        title: 'Operativo Mercado Libre',
        desc: 'Control de Fondo Base y Estado de Reposición',
        label1: 'Terminal',
        label2: 'Fondo Base',
        label3: 'Estado',
        gradient: ['from-amber-500', 'to-yellow-500']
      },
      'bbva': {
        title: 'Operativo BBVA',
        desc: 'Retiro de Recurso de Caja a BBVA',
        label1: 'Inicial',
        label2: 'Retiros',
        label3: 'Total Retiros',
        gradient: ['from-blue-800', 'to-indigo-900']
      },
      'tconecta': {
        title: 'Operativo T-Conecta',
        desc: 'Flujo diario de T-Conecta',
        label1: 'Recarga Efectivo',
        label2: 'T-Conecta Recarga',
        label3: 'Total T-Conecta',
        gradient: ['from-sky-500', 'to-blue-500']
      },
      'transferencia': {
        title: 'Operativo Transferencia',
        desc: 'Flujo diario de Transferencia',
        label1: 'Inicial',
        label2: 'Flujo',
        label3: 'Total',
        gradient: ['from-emerald-600', 'to-teal-500']
      },
      'caja': {
        title: 'Operativo Bóveda',
        desc: 'Efectivo en Bóveda (Caja Fuerte)',
        label1: 'Ingreso Agregado',
        label2: 'Retiros',
        label3: 'Total Bóveda',
        gradient: ['from-slate-700', 'to-slate-800']
      },
      'capital': {
        title: 'Total Sistema Híbrido',
        desc: 'Capital en Efectivo + Capital en Terminal',
        label1: 'Efectivo',
        label2: 'Terminal',
        label3: 'Total',
        gradient: ['from-teal-600', 'to-emerald-600']
      },
      'cambio': {
        title: 'Cambio de Efectivo',
        desc: 'Registro de cambio y desglose de piezas en caja',
        label1: 'Entrada',
        label2: 'Salida',
        label3: 'Neto',
        gradient: ['from-orange-500', 'to-amber-500']
      }
    };

    // === ESTADOS CLAVE ===
    let sessionActive = false;
    let activeOperator = null;
    let currentOpType = 'ingreso'; // ingreso, salida
    let pinCallback = null;
    let bitacoraActiveTab = 'saldos';

    // === PERSISTENCIA LOCAL ===
    const DB = {
      get: (key, def) => {
        const item = localStorage.getItem('lc5_' + key);
        return item ? JSON.parse(item) : def;
      },
      set: (key, val) => localStorage.setItem('lc5_' + key, JSON.stringify(val)),
      init: () => {
        if (!localStorage.getItem('lc5_inventory')) {
          DB.set('inventory', {1000:0,500:0,200:0,100:0,50:0,20:0,10:0,5:0,2:0,1:0,0.5:0});
        } else {
          const inv = DB.get('inventory', {});
          if (inv['0.5'] === undefined) {
            inv['0.5'] = 0;
            DB.set('inventory', inv);
          }
        }
        if (!localStorage.getItem('lc5_inventoryBoveda')) {
          DB.set('inventoryBoveda', {1000:0,500:0,200:0,100:0,50:0,20:0,10:0,5:0,2:0,1:0,0.5:0});
        } else {
          const invB = DB.get('inventoryBoveda', {});
          if (invB['0.5'] === undefined) {
            invB['0.5'] = 0;
            DB.set('inventoryBoveda', invB);
          }
        }
        if (!localStorage.getItem('lc5_balances')) {
          DB.set('balances', {yastasTerminal:0, yastasEfectivo:0, banorte:0, meli:0, tconecta:0, transferencia:0, boveda:0, bbva:0, capital:0, banamex:0});
        } else {
          // Migración automática de Yestas a Yestas y Banamex
          const bal = DB.get('balances', {});
          let mod = false;
          if (bal.yestas !== undefined) {
            bal.yastasTerminal = bal.yestas;
            bal.yastasEfectivo = 0;
            delete bal.yestas;
            mod = true;
          }
          if (bal.banamex === undefined) {
            bal.banamex = 0;
            mod = true;
          }
          if (mod) {
            DB.set('balances', bal);
          }
        }
        if (!localStorage.getItem('lc5_state')) DB.set('state', { session_active: false, operator: null });
        if (!localStorage.getItem('lc5_logs')) DB.set('logs', []);
        if (!localStorage.getItem('lc5_historical_logs')) DB.set('historical_logs', []);
        if (!localStorage.getItem('lc5_historical_logs_by_date')) DB.set('historical_logs_by_date', {});
        getLowStockThresholds();
      }
    };

    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    // === BOOTSTRAP ===
    window.onload = function() {
      DB.init();
      
      const unlocked = sessionStorage.getItem('caja_app_unlocked') === 'true';
      if (unlocked) {
        const lockScreen = document.getElementById('pantalla-bloqueo-global');
        const appWrapper = document.getElementById('app-wrapper');
        if (lockScreen) lockScreen.classList.add('hidden');
        if (appWrapper) appWrapper.classList.remove('hidden');
        inicializarSistemaDespuesDeDesbloqueo();
      } else {
        // Enlazar Enter al input de contraseña
        const passInput = document.getElementById('global-lock-password');
        if (passInput) {
          passInput.focus();
          passInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
              desbloquearPlataforma();
            }
          });
        }
      }
    };

    async function inicializarSistemaDespuesDeDesbloqueo() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      const filtroFecha = document.getElementById('filtro-fecha');
      if (filtroFecha) {
        filtroFecha.value = todayStr;
      }

      // Migración automática de registros antiguos a la nueva estructura agrupada por fecha
      if (localStorage.getItem('lc5_historical_logs') && !localStorage.getItem('lc5_historical_logs_by_date')) {
        try {
          const oldHist = JSON.parse(localStorage.getItem('lc5_historical_logs')) || [];
          const newHist = {};
          oldHist.forEach(log => {
            let dStr = log.date;
            if (!dStr && log.id) {
              const d = new Date(log.id);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              dStr = `${y}-${m}-${dd}`;
              log.date = dStr;
            }
            if (!dStr) {
              dStr = todayStr;
              log.date = dStr;
            }
            if (!newHist[dStr]) {
              newHist[dStr] = [];
            }
            newHist[dStr].push(log);
          });
          localStorage.setItem('lc5_historical_logs_by_date', JSON.stringify(newHist));
        } catch (e) {
          console.error("Error al migrar logs históricos:", e);
        }
      }

      // 1. Sincronizar estado activo inicial desde la nube
      if (GOOGLE_WEB_APP_URL && !GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) {
        mostrarToast("Sincronizando estado con la nube...", "info");
        try {
          const response = await fetch(`${GOOGLE_WEB_APP_URL}?action=get_active_state`);
          const cloudState = await response.json();
          
          if (cloudState && cloudState.session_active) {
            DB.set('state', {
              session_active: true,
              operator: cloudState.operator,
              opened_date: cloudState.opened_date,
              opened_time: cloudState.opened_time || "08:00:00"
            });
            sessionActive = true;
            activeOperator = cloudState.operator;
            
            if (cloudState.balances) DB.set('balances', cloudState.balances);
            if (cloudState.inventory) DB.set('inventory', cloudState.inventory);
            if (cloudState.inventoryBoveda) DB.set('inventoryBoveda', cloudState.inventoryBoveda);
            if (cloudState.logs && Array.isArray(cloudState.logs)) {
              DB.set('logs', cloudState.logs);
              const historical = DB.get('historical_logs_by_date', {});
              cloudState.logs.forEach(log => {
                const dStr = log.date;
                if (dStr) {
                  if (!historical[dStr]) historical[dStr] = [];
                  const seen = new Set(historical[dStr].map(l => l.id).filter(Boolean));
                  if (!seen.has(log.id)) {
                    historical[dStr].unshift(log);
                  }
                }
              });
              DB.set('historical_logs_by_date', historical);
            }
            
            mostrarToast("Turno activo sincronizado desde la nube.", "success");
          } else {
            // No hay turno activo en la nube: forzar sesión cerrada localmente
            sessionActive = false;
            activeOperator = null;
            DB.set('state', { session_active: false, operator: null, opened_date: null });
          }
        } catch (e) {
          console.error("Error al sincronizar estado activo inicial:", e);
          mostrarToast("Error de conexión. Trabajando con datos locales.", "warning");
          const state = DB.get('state', { session_active: false, operator: null, opened_date: null });
          sessionActive = state.session_active;
          activeOperator = state.operator;
        }
      } else {
        const state = DB.get('state', { session_active: false, operator: null, opened_date: null });
        sessionActive = state.session_active;
        activeOperator = state.operator;
      }

      // 2. Ejecutar bypass de pre-apertura y alertas de cierre sobre el estado final obtenido
      if (sessionActive && DB.get('state', {}).opened_date && DB.get('state', {}).opened_date !== todayStr) {
        // --- EVITAR CONFLICTOS POR PRE-APERTURA (FOOLPROOF) ---
        const currentLogs = DB.get('logs', []);
        const nonOpeningLogs = currentLogs.filter(log => log.category !== 'Apertura');
        
        if (nonOpeningLogs.length === 0) {
          const state = DB.get('state', {});
          state.opened_date = todayStr;
          state.opened_time = now.toLocaleTimeString();
          DB.set('state', state);
          
          if (currentLogs.length > 0) {
            currentLogs[0].date = todayStr;
            currentLogs[0].time = now.toLocaleTimeString();
            DB.set('logs', currentLogs);
          }
          console.log(`Auto-actualización de pre-apertura de turno detectada. Turno movido al día de hoy (${todayStr}).`);
        } else {
          // Inicializar o restablecer intentos si cambia de día
          const lastAttemptDay = localStorage.getItem('caja_cierre_ultimo_dia_intento');
          if (lastAttemptDay !== todayStr) {
            localStorage.setItem('caja_cierre_intentos', '0');
            localStorage.setItem('caja_cierre_ultimo_dia_intento', todayStr);
          }
          
          // Verificar si la alerta ya está silenciada para hoy
          const isMutedToday = localStorage.getItem('caja_cierre_mutada_dia') === todayStr;
          if (!isMutedToday) {
            const proximoReminder = parseInt(localStorage.getItem('caja_cierre_proximo_reminder')) || 0;
            const timeLeft = proximoReminder - Date.now();
            
            if (timeLeft <= 0) {
              setTimeout(() => {
                mostrarModalDiferenciaFecha(DB.get('state', {}).opened_date);
              }, 300);
            } else {
              console.log(`Alerta de cierre pospuesta. Siguiente recordatorio en ${Math.round(timeLeft / 1000 / 60)} min.`);
              setTimeout(() => {
                mostrarModalDiferenciaFecha(DB.get('state', {}).opened_date);
              }, timeLeft);
            }
          }
        }
      }

      if (localStorage.getItem('lc5_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        document.getElementById('body-el').classList.remove('bg-slate-50', 'text-slate-800');
        document.getElementById('body-el').classList.add('bg-slate-900', 'text-slate-100');
        document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
      }

      evaluarModoNocturnoProgramado();

      cargarDropdownOperadores();
      construirInputsDesglose();
      refrescarPantallas();
      intentarSubirCierresPendientes();
      initCalcDragging();
      setupGlobalInputOverrides();
      
      const outInputs = document.querySelectorAll('[id^="cambio-out-"]');
      outInputs.forEach(inp => {
        inp.addEventListener('focus', function() {
          if (this.value === '0' || this.value === '') {
            this.value = '';
          } else {
            this.select();
          }
        });
        inp.addEventListener('blur', function() {
          if (this.value.trim() === '') {
            this.value = '0';
          }
        });
      });
      
      // Enter en PIN
      document.getElementById('pin-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') validarPIN();
      });

      // Teclado físico en Calculadora
      document.addEventListener('keydown', function(e) {
        const calcOpen = !document.getElementById('calc-widget').classList.contains('hidden');
        if (!calcOpen) return;
        
        // Si el foco está en un campo de texto/número, no capturar para la calculadora
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
          return;
        }
        
        let targetKey = null;

        if (e.key >= '0' && e.key <= '9') {
          pressCalc(e.key);
          targetKey = e.key;
        } else if (e.key === '.' || e.key === ',') {
          pressCalc('.');
          targetKey = '.';
        } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
          pressCalc(e.key);
          targetKey = e.key;
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          pressCalc('=');
          targetKey = '=';
        } else if (e.key === 'Escape') {
          pressCalc('C');
          targetKey = 'C';
        } else if (e.key === 'Backspace') {
          pressCalc('Backspace');
          targetKey = 'Backspace';
        }

        // Efecto visual de click
        if (targetKey) {
          const btn = Array.from(document.querySelectorAll('#calc-widget button')).find(b => b.getAttribute('data-calc-btn') === targetKey);
          if (btn) {
            btn.classList.add('bg-indigo-500', 'scale-95');
            setTimeout(() => {
              btn.classList.remove('bg-indigo-500', 'scale-95');
            }, 100);
          }
        }
      });

      lucide.createIcons();
    };

    // === CONFIGURACIÓN Y AUTO-BORRADO DE CERO AL FOCALIZAR ===
    function setupGlobalInputOverrides() {
      const inputs = [
        document.getElementById('apertura-yastas'),
        document.getElementById('op-monto-manual'),
        document.getElementById('edicion-monto-input')
      ];

      inputs.forEach(inp => {
        if (!inp) return;
        inp.addEventListener('focus', function() {
          if (this.value === '0' || this.value === '') {
            this.value = '';
          } else {
            this.select();
          }
        });
        inp.addEventListener('blur', function() {
          if (this.value.trim() === '') {
            this.value = '0';
          }
          calcularTotalLocal();
        });
      });
    }

    // === CONSTRUCCIÓN DINÁMICA DE LA CHAROLA ===
    function construirInputsDesglose() {
      const inventory = DB.get('inventory', {});

      const renderContainers = (containerPrefix, isApertura) => {
        const buildRows = (arr, id, type) => {
          const container = document.getElementById(id);
          container.innerHTML = '';
          arr.forEach(d => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-3 rounded-2xl hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm transition duration-150';
            
            const badgeBg = type === 'billete' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-slate-900';
            const displayLabel = d === 0.5 ? '50¢' : `$${d}`;
            row.innerHTML = `
              <div class="w-16 text-center py-2 rounded-xl text-sm font-black shadow-sm ${badgeBg}">
                ${displayLabel}
              </div>
              <div class="flex-grow flex flex-col">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cantidad</span>
                <input type="number" 
                       id="${containerPrefix}-${d}" 
                       data-denom="${d}" 
                       data-type="${type}"
                       min="0" 
                       value="0" 
                       placeholder="0" 
                       oninput="calcularTotalLocal()" 
                       class="denom-input-field w-full bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 text-base font-black text-slate-800 dark:text-white text-center outline-none py-1">
              </div>
              <div class="w-20 text-right flex flex-col justify-end">
                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
                <span id="${containerPrefix}-sub-${d}" class="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">$0.00</span>
              </div>
            `;
            container.appendChild(row);

            const inputEl = row.querySelector('input');
            inputEl.addEventListener('focus', function() {
              if (this.value === '0' || this.value === '') {
                this.value = '';
              } else {
                this.select();
              }
            });
            inputEl.addEventListener('blur', function() {
              if (this.value.trim() === '') {
                this.value = '0';
              }
              calcularTotalLocal();
            });
          });
        };

        if (isApertura) {
          buildRows(Denominations.billetes, 'apertura-billetes-container', 'billete');
          buildRows(Denominations.monedas, 'apertura-monedas-container', 'moneda');
        } else {
          buildRows(Denominations.billetes, 'dash-billetes-container', 'billete');
          buildRows(Denominations.monedas, 'dash-monedas-container', 'moneda');
        }
      };

      renderContainers('apertura', true);
      renderContainers('dash', false);
    }

    // === CÁLCULO DE TOTALES ===
    function calcularTotalLocal() {
      const isApertura = !sessionActive;
      const prefix = isApertura ? 'apertura' : 'dash';
      
      let sum = 0;
      const inputs = document.querySelectorAll(`.denom-input-field[id^="${prefix}-"]`);
      
      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        const rowTotal = denom * cant;
        sum += rowTotal;

        document.getElementById(`${prefix}-sub-${denom}`).innerText = fmt.format(rowTotal);
      });

      if (isApertura) {
        document.getElementById('apertura-total-caja').innerText = fmt.format(sum);
        
        const yastasInput = document.getElementById('apertura-yastas');
        const yastasVal = yastasInput ? (parseFloat(yastasInput.value) || 0) : 0;
        
        const yastasValEl = document.getElementById('apertura-total-yastas-val');
        if (yastasValEl) yastasValEl.innerText = fmt.format(yastasVal);
        
        const totalOperativo = sum + yastasVal;
        const totalOperativoEl = document.getElementById('apertura-total-operativo');
        if (totalOperativoEl) totalOperativoEl.innerText = fmt.format(totalOperativo);
      } else {
        const srv = document.getElementById('op-service').value;
        if (srv === 'cambio') {
          calcularCambioEfectivo();
          return;
        }
        if (srv === 'yastas' && currentOpType === 'redeposito') {
          calcularDiferenciaRedeposito();
          return;
        }
        if (srv === 'capital' && currentOpType === 'ingreso' && modoAnexarCapital === 'efectivo') {
          calcularTotalAnexarCapital();
        }

        document.getElementById('op-monto-desglosado').innerText = fmt.format(sum);
        
        const btn = document.getElementById('btn-procesar-operacion');
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        if (srv === 'banorte') {
          if (btn) btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Banorte`;
        } else {
          if (btn) btn.innerHTML = sum > 0 
            ? `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar ${fmt.format(sum)}` 
            : `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Operación`;
        }
        
        calcularCambioOperacion();
        calcularRetiroOperacion();
        calcularBovedaOperacion();
        lucide.createIcons();
      }
    }

    function limpiarDesglose(silent = false) {
      const prefix = sessionActive ? 'dash' : 'apertura';
      const inputs = document.querySelectorAll(`.denom-input-field[id^="${prefix}-"]`);
      inputs.forEach(inp => {
        inp.value = 0;
        const sub = document.getElementById(`${prefix}-sub-${inp.getAttribute('data-denom')}`);
        if (sub) sub.innerText = fmt.format(0);
      });
      document.getElementById('op-monto-manual').value = "";
      document.getElementById('op-concepto-transferencia').value = "";
      document.getElementById('op-motivo-capital').value = "";
      document.getElementById('op-ubicacion-boveda').value = "";
      
      const inputDep = document.getElementById('op-cambio-deposito');
      if (inputDep) inputDep.value = '';
      currentSugerenciaCambio = null;
      currentModoCambio = 'sugerido';
      currentManualCambioPieces = {};
      const cambioModoVal = document.getElementById('op-cambio-modo-val');
      if (cambioModoVal) cambioModoVal.value = 'sugerido';

      // Resetear campos de retiro asistido
      const inputRet = document.getElementById('op-retiro-monto');
      if (inputRet) inputRet.value = '';
      currentModoRetiro = 'sugerido';
      currentSugerenciaRetiro = null;
      const retModoVal = document.getElementById('op-retiro-modo-val');
      if (retModoVal) retModoVal.value = 'sugerido';
      toggleCharolaInputs(false);

      // Resetear campos de recarga
      const inputRec = document.getElementById('op-recarga-monto');
      if (inputRec) inputRec.value = '';
      actualizarMontoRecarga();

      // Resetear cambio de efectivo
      if (document.getElementById('op-service') && document.getElementById('op-service').value === 'cambio') {
        const ids = [
          'cambio-out-1000', 'cambio-out-500', 'cambio-out-200', 'cambio-out-100',
          'cambio-out-50', 'cambio-out-20', 'cambio-out-m10', 'cambio-out-m5',
          'cambio-out-m2', 'cambio-out-m1', 'cambio-out-m05'
        ];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = 0;
        });
        calcularCambioOperacion();
      }

      calcularTotalLocal();
      
      // Ejecutar validaciones correspondientes al tipo de operación activo para sincronizar el botón de envío
      if (typeof currentOpType !== 'undefined') {
        if (currentOpType === 'ingreso') {
          calcularCambioOperacion();
        } else if (currentOpType === 'salida') {
          calcularRetiroOperacion();
        }
      }

      if (!silent) {
        mostrarToast("Campos limpios", "info");
      }
    }

    // === SWITCH DE TEMA ===
    function setTemaModo(modoDark) {
      const bodyEl = document.getElementById('body-el');
      if (!bodyEl) return;
      
      if (!modoDark) {
        document.body.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark');
        bodyEl.classList.remove('bg-slate-900', 'text-slate-100');
        bodyEl.classList.add('bg-slate-50', 'text-slate-800');
        localStorage.setItem('lc5_theme', 'light');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.setAttribute('data-lucide', 'moon');
      } else {
        document.body.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        bodyEl.classList.remove('bg-slate-50', 'text-slate-800');
        bodyEl.classList.add('bg-slate-900', 'text-slate-100');
        localStorage.setItem('lc5_theme', 'dark');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.setAttribute('data-lucide', 'sun');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function toggleTheme() {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      setTemaModo(!isDark);
    }

    // === FUNCIONES DE MODO NOCTURNO AUTOMÁTICO ===
    function abrirModalConfigTema() {
      const modal = document.getElementById('modal-config-tema');
      if (!modal) return;
      
      const autoEnabled = localStorage.getItem('lc5_theme_auto_enabled') === 'true';
      const autoType = localStorage.getItem('lc5_theme_auto_type') || 'standard';
      const startTime = localStorage.getItem('lc5_theme_start_time') || '19:00';
      const endTime = localStorage.getItem('lc5_theme_end_time') || '07:00';
      
      const switchEl = document.getElementById('tema-switch-auto');
      if (switchEl) switchEl.checked = autoEnabled;
      
      if (autoType === 'custom') {
        const opCustom = document.getElementById('tema-op-custom');
        if (opCustom) opCustom.checked = true;
      } else {
        const opStandard = document.getElementById('tema-op-standard');
        if (opStandard) opStandard.checked = true;
      }
      
      const inputStart = document.getElementById('tema-hora-inicio');
      const inputEnd = document.getElementById('tema-hora-fin');
      if (inputStart) inputStart.value = startTime;
      if (inputEnd) inputEnd.value = endTime;
      
      toggleModoAutoSwitch();
      modal.classList.remove('hidden');
    }

    function cerrarModalConfigTema() {
      const modal = document.getElementById('modal-config-tema');
      if (modal) modal.classList.add('hidden');
    }

    function toggleModoAutoSwitch() {
      const switchEl = document.getElementById('tema-switch-auto');
      const opciones = document.getElementById('tema-opciones-horario');
      if (!switchEl || !opciones) return;
      
      if (switchEl.checked) {
        opciones.classList.remove('hidden');
        actualizarVisibilidadHorariosCustom();
      } else {
        opciones.classList.add('hidden');
      }
    }

    function actualizarVisibilidadHorariosCustom() {
      const opCustom = document.getElementById('tema-op-custom');
      const customInputs = document.getElementById('tema-inputs-custom');
      if (!opCustom || !customInputs) return;
      
      if (opCustom.checked) {
        customInputs.classList.remove('hidden');
      } else {
        customInputs.classList.add('hidden');
      }
    }

    function guardarConfigTema() {
      const switchEl = document.getElementById('tema-switch-auto');
      const autoEnabled = switchEl ? switchEl.checked : false;
      localStorage.setItem('lc5_theme_auto_enabled', autoEnabled ? 'true' : 'false');
      
      if (autoEnabled) {
        const opCustom = document.getElementById('tema-op-custom');
        const autoType = (opCustom && opCustom.checked) ? 'custom' : 'standard';
        localStorage.setItem('lc5_theme_auto_type', autoType);
        
        const startTime = document.getElementById('tema-hora-inicio') ? document.getElementById('tema-hora-inicio').value : '19:00';
        const endTime = document.getElementById('tema-hora-fin') ? document.getElementById('tema-hora-fin').value : '07:00';
        localStorage.setItem('lc5_theme_start_time', startTime);
        localStorage.setItem('lc5_theme_end_time', endTime);
        
        evaluarModoNocturnoProgramado();
        mostrarToast("Ajustes de Modo Nocturno Automático guardados.", "success");
      } else {
        mostrarToast("Modo Automático desactivado. Modo manual activo.", "info");
      }
      cerrarModalConfigTema();
    }

    function evaluarModoNocturnoProgramado() {
      const autoEnabled = localStorage.getItem('lc5_theme_auto_enabled') === 'true';
      if (!autoEnabled) return;
      
      const autoType = localStorage.getItem('lc5_theme_auto_type') || 'standard';
      let startStr = '19:00';
      let endStr = '07:00';
      
      if (autoType === 'custom') {
        startStr = localStorage.getItem('lc5_theme_start_time') || '19:00';
        endStr = localStorage.getItem('lc5_theme_end_time') || '07:00';
      }
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const [sH, sM] = startStr.split(':').map(Number);
      const [eH, eM] = endStr.split(':').map(Number);
      
      const startMinutes = (sH || 0) * 60 + (sM || 0);
      const endMinutes = (eH || 0) * 60 + (eM || 0);
      
      let shouldBeDark = false;
      if (startMinutes <= endMinutes) {
        // Mismo día (ej. 08:00 a 18:00)
        shouldBeDark = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Cruza medianoche (ej. 19:00 a 07:00)
        shouldBeDark = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
      
      const isCurrentlyDark = document.body.getAttribute('data-theme') === 'dark';
      if (shouldBeDark && !isCurrentlyDark) {
        setTemaModo(true);
      } else if (!shouldBeDark && isCurrentlyDark) {
        setTemaModo(false);
      }
    }

    // Intervalo de evaluación continua cada 60 segundos
    setInterval(evaluarModoNocturnoProgramado, 60000);

    // === ALTERNANCIA DE SUBVISTAS (TABLERO vs BITÁCORA) ===
    function mostrarSubvista(vista) {
      if (!sessionActive) return;
      const mainView = document.getElementById('dash-main-view');
      const bitacoraView = document.getElementById('dash-bitacora-view');
      const cierreView = document.getElementById('dash-cierre-view');
      const btnBitacora = document.getElementById('btn-abrir-bitacora');
      
      // Esconder todas primero
      if (mainView) mainView.classList.add('hidden');
      if (bitacoraView) bitacoraView.classList.add('hidden');
      if (cierreView) cierreView.classList.add('hidden');
      
      if (vista === 'bitacora') {
        if (bitacoraView) bitacoraView.classList.remove('hidden');
        if (btnBitacora) {
          btnBitacora.innerHTML = `
            <i data-lucide="layout-dashboard" class="w-4.5 h-4.5"></i>
            <span class="hidden md:inline">Tablero</span>
          `;
          btnBitacora.setAttribute('onclick', "mostrarSubvista('tablero')");
          btnBitacora.setAttribute('title', "Volver al Tablero");
        }
        cargarBitacora();
      } else if (vista === 'cierre') {
        if (cierreView) cierreView.classList.remove('hidden');
      } else {
        if (mainView) mainView.classList.remove('hidden');
        if (btnBitacora) {
          btnBitacora.innerHTML = `
            <i data-lucide="file-text" class="w-4.5 h-4.5"></i>
            <span class="hidden md:inline">Bitácora</span>
          `;
          btnBitacora.setAttribute('onclick', "mostrarSubvista('bitacora')");
          btnBitacora.setAttribute('title', "Ver Bitácora de Movimientos");
        }
      }
      lucide.createIcons();
      sincronizarEstadoActivoInicial();
    }

    // === CONTROL DE VISTAS (PÁGINA 1: Apertura de Turno, PÁGINA 2: Tablero/Dashboard) ===
    function refrescarPantallas() {
      const vistaApertura = document.getElementById('vista-apertura');
      const vistaDashboard = document.getElementById('vista-dashboard');
      const cajeroBadge = document.getElementById('cajero-badge');
      const btnCerrarTurno = document.getElementById('btn-cerrar-turno');
      const btnVerPiezas = document.getElementById('btn-ver-piezas');

      // Resetear filtros de la bitácora al cambiar estado de sesión
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      const filtroFecha = document.getElementById('filtro-fecha');
      if (filtroFecha) filtroFecha.value = todayStr;
      
      if (document.getElementById('filtro-tipo')) document.getElementById('filtro-tipo').value = 'todos';
      if (document.getElementById('filtro-cuenta')) document.getElementById('filtro-cuenta').value = 'todas';
      if (document.getElementById('filtro-operador')) document.getElementById('filtro-operador').value = 'todos';

      cargarSaldosDigitales();
      cargarBitacora();

      // Referencias a los botones de la barra superior (cabecera)
      const btnHeaderCalc = document.getElementById('btn-header-calc');
      const btnHeaderIva = document.getElementById('btn-header-iva');
      const btnHeaderUsers = document.getElementById('btn-header-users');
      const btnHeaderBitacora = document.getElementById('btn-abrir-bitacora');

      if (sessionActive) {
        // Mostrar segunda página (dashboard) y ocultar primera (apertura)
        vistaApertura.classList.add('hidden');
        vistaDashboard.classList.remove('hidden');
        
        cajeroBadge.classList.remove('hidden');
        btnCerrarTurno.classList.remove('hidden');
        btnVerPiezas.classList.remove('hidden');
        document.getElementById('cajero-nombre').innerText = activeOperator || 'Turno Activo';
        
        // Habilitar botones de utilidades de la cabecera
        if (btnHeaderCalc) btnHeaderCalc.classList.remove('opacity-40', 'pointer-events-none');
        if (btnHeaderIva) btnHeaderIva.classList.remove('opacity-40', 'pointer-events-none');
        if (btnHeaderUsers) btnHeaderUsers.classList.remove('opacity-40', 'pointer-events-none');
        if (btnHeaderBitacora) btnHeaderBitacora.classList.remove('opacity-40', 'pointer-events-none');

        actualizarFormularioOperacion();
        limpiarDesglose(true);
      } else {
        // Mostrar primera página (apertura) y ocultar segunda (dashboard)
        vistaApertura.classList.remove('hidden');
        vistaDashboard.classList.add('hidden');
        
        cajeroBadge.classList.add('hidden');
        btnCerrarTurno.classList.add('hidden');
        btnVerPiezas.classList.add('hidden');

        // Desactivar botones de utilidades de la cabecera durante configuración de apertura
        if (btnHeaderCalc) btnHeaderCalc.classList.add('opacity-40', 'pointer-events-none');
        if (btnHeaderIva) btnHeaderIva.classList.add('opacity-40', 'pointer-events-none');
        if (btnHeaderUsers) btnHeaderUsers.classList.add('opacity-40', 'pointer-events-none');
        if (btnHeaderBitacora) btnHeaderBitacora.classList.add('opacity-40', 'pointer-events-none');
        
        // Resetear subvista a tablero
        const mainView = document.getElementById('dash-main-view');
        const bitacoraView = document.getElementById('dash-bitacora-view');
        const btnBitacora = document.getElementById('btn-abrir-bitacora');
        if (mainView) mainView.classList.remove('hidden');
        if (bitacoraView) bitacoraView.classList.add('hidden');
        if (btnBitacora) {
          btnBitacora.innerHTML = `
            <i data-lucide="file-text" class="w-4.5 h-4.5"></i>
            <span class="hidden md:inline">Bitácora</span>
          `;
          btnBitacora.setAttribute('onclick', "mostrarSubvista('bitacora')");
          btnBitacora.setAttribute('title', "Ver Bitácora de Movimientos");
        }

        const opSel = document.getElementById('apertura-operator');
        if (opSel) opSel.value = "";
        document.getElementById('apertura-yastas').value = "";
        limpiarDesglose(true);
      }
    }

    function formatSignedCurrency(val) {
      if (val === 0) return fmt.format(0);
      const sign = val > 0 ? '+' : '';
      return sign + fmt.format(val);
    }

    function cargarSaldosDigitales() {
      const balances = DB.get('balances', {});
      const inventory = DB.get('inventory', {});
      const inventoryBoveda = DB.get('inventoryBoveda', {});

      // Inicializar el saldo base de Meli al valor actual si no está definido
      if (typeof balances.meliBase === 'undefined') {
        balances.meliBase = balances.meli || 0;
        DB.set('balances', balances);
      }

      // Reconstrucción del desglose de Capital Terminal/Efectivo si no existe
      if (typeof balances.capitalTerminal === 'undefined' || typeof balances.capitalEfectivo === 'undefined') {
        balances.capitalTerminal = 0;
        balances.capitalEfectivo = 0;
        const historical = DB.get('historical_logs_by_date', {}) || {};
        Object.keys(historical).forEach(dateStr => {
          const logsList = historical[dateStr] || [];
          if (Array.isArray(logsList)) {
            logsList.forEach(log => {
              if (log) {
                if (log.category === 'CAPITAL_TERMINAL') {
                  balances.capitalTerminal += (log.amount || 0);
                } else if (log.category === 'CAPITAL_EFECTIVO') {
                  balances.capitalEfectivo += (log.amount || 0);
                }
              }
            });
          }
        });
        const sum = balances.capitalTerminal + balances.capitalEfectivo;
        if (sum !== (balances.capital || 0)) {
          balances.capitalTerminal = (balances.capital || 0) - balances.capitalEfectivo;
        }
        DB.set('balances', balances);
      }

      document.getElementById('dash-bal-yastas-terminal').innerText = fmt.format(balances.yastasTerminal || 0);
      document.getElementById('dash-bal-yastas-efectivo').innerText = fmt.format(balances.yastasEfectivo || 0);
      document.getElementById('dash-bal-banorte').innerText = fmt.format(balances.banorte || 0);
      // Mercado Libre (Meli)
      const meliVal = balances.meli || 0;
      const meliBase = balances.meliBase || 0;
      const meliDiff = meliVal - meliBase;

      const meliTerminalEl = document.getElementById('dash-bal-meli-terminal');
      if (meliTerminalEl) meliTerminalEl.innerText = fmt.format(meliVal);

      const meliDiffEl = document.getElementById('dash-bal-meli-diff');
      if (meliDiffEl) {
        meliDiffEl.innerText = (meliDiff >= 0 ? '+' : '') + fmt.format(meliDiff);
        if (meliDiff === 0) {
          meliDiffEl.className = 'font-bold text-slate-700';
        } else if (meliDiff > 0) {
          meliDiffEl.className = 'font-bold text-emerald-600';
        } else {
          meliDiffEl.className = 'font-bold text-rose-600';
        }
      }
      document.getElementById('dash-bal-bbva').innerText = fmt.format(balances.bbva || 0);
      const balTermEl = document.getElementById('dash-bal-tconecta-term');
      const balBanamexEl = document.getElementById('dash-bal-tconecta-banamex');
      if (balTermEl) balTermEl.innerText = `Term: ${fmt.format(balances.tconectaTerminal || 0)}`;
      if (balBanamexEl) balBanamexEl.innerText = `Banamex: ${fmt.format(balances.banamex || 0)}`;
      const balTransf = document.getElementById('dash-bal-transferencia');
      if (balTransf) {
        balTransf.innerText = fmt.format(balances.transferencia || 0);
      }

      // Calcular saldo de bóveda desde su propio inventario
      let bovedaTotal = 0;
      Object.keys(inventoryBoveda).forEach(denom => {
        bovedaTotal += parseInt(denom) * (inventoryBoveda[denom] || 0);
      });
      balances.boveda = bovedaTotal;
      DB.set('balances', balances); // persistir el valor calculado
      document.getElementById('dash-bal-boveda').innerText = fmt.format(bovedaTotal);

      // Capital
      document.getElementById('dash-bal-capital').innerText = fmt.format(balances.capital || 0);

      // Calcular total del inventario físico en charola
      let inventarioTotalVal = 0;
      Object.keys(inventory).forEach(denom => {
        inventarioTotalVal += parseInt(denom) * (inventory[denom] || 0);
      });

      // Verificar alertas de bajo stock (Desactivado)
      const badge = document.getElementById('low-stock-badge');
      if (badge) {
        badge.classList.add('hidden');
      }

      // === DYNAMIC TOTAL OPERATIVO BAR ===
      const activeSrv = (document.getElementById('op-service') && document.getElementById('op-service').value) || 'yastas';
      const config = SERVICE_BAR_CONFIGS[activeSrv] || SERVICE_BAR_CONFIGS['yastas'];

      // Reset defaults for operator, equals, and label3 / operativo text classes
      const barOpEl = document.getElementById('dash-total-bar-operator');
      const barEqEl = document.getElementById('dash-total-bar-equals');
      if (barOpEl) barOpEl.innerText = '+';
      if (barEqEl) barEqEl.innerText = '=';

      const label3El = document.getElementById('dash-total-bar-label3');
      if (label3El) label3El.className = "text-[9px] font-bold text-yellow-300 uppercase tracking-wider block";

      const totalEl = document.getElementById('dash-total-operativo');
      if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

      const barOpRetiroEl = document.getElementById('dash-total-bar-operator-retiro');
      if (barOpRetiroEl) barOpRetiroEl.innerText = '-';

      const labelRetiroEl = document.getElementById('dash-total-bar-label-retiro');
      if (labelRetiroEl) labelRetiroEl.innerText = 'Retiros';

      // Update Title & Desc
      document.getElementById('dash-total-bar-title').innerText = config.title;
      document.getElementById('dash-total-bar-desc').innerText = config.desc;

      // Update Labels
      document.getElementById('dash-total-bar-label1').innerText = config.label1;
      document.getElementById('dash-total-bar-label2').innerText = config.label2;
      document.getElementById('dash-total-bar-label3').innerText = config.label3;

      // Get today's movements for this service
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      
      const dateLogs = DB.get('logs', []) || [];

      let todayMovements = 0;
      dateLogs.forEach(log => {
        if (!log || !log.category) return;
        const cat = log.category.toUpperCase();
        const target = activeSrv.toUpperCase();
        if (target === 'YASTAS') {
          // Para Yastas se maneja por separado (Charola + Terminal)
        } else {
          if (cat === target || cat.endsWith(`_${target}`) || cat.startsWith(`${target}_`)) {
            todayMovements += log.amount;
          }
        }
      });

      // Reset additional columns visibility by default
      const opRetiro = document.getElementById('dash-total-bar-operator-retiro');
      const colRetiro = document.getElementById('dash-total-col-retiro');
      if (opRetiro) opRetiro.classList.add('hidden');
      if (colRetiro) colRetiro.classList.add('hidden');

      if (activeSrv === 'yastas') {
        const yastasEfectivoVal = balances.yastasEfectivo || 0;
        const terminalVal = balances.yastasTerminal || 0;
        const totalOperativo = yastasEfectivoVal + terminalVal;

        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(yastasEfectivoVal);
        document.getElementById('dash-total-terminal').innerText = fmt.format(terminalVal);
        document.getElementById('dash-total-operativo').innerText = fmt.format(totalOperativo);
        document.getElementById('dash-total-bar-operator').innerText = '+';
      } else if (activeSrv === 'capital') {
        // Calcular retiros de capital de hoy
        let todayCapitalRetiros = 0;
        dateLogs.forEach(log => {
          if (log && log.category === 'CAPITAL_RETIRO') {
            todayCapitalRetiros += Math.abs(log.amount || 0);
          }
        });

        const capEfectivo = balances.capitalEfectivo || 0;
        const capTerminal = balances.capitalTerminal || 0;
        const capTotal = balances.capital || 0;

        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');

        if (opRetiro) opRetiro.classList.remove('hidden');
        if (colRetiro) colRetiro.classList.remove('hidden');

        const capEfectivoGross = capEfectivo + todayCapitalRetiros;

        document.getElementById('dash-total-charola').innerText = fmt.format(capEfectivoGross);
        document.getElementById('dash-total-terminal').innerText = fmt.format(capTerminal);
        const totalRetiroEl = document.getElementById('dash-total-retiro');
        if (totalRetiroEl) totalRetiroEl.innerText = fmt.format(todayCapitalRetiros);
        
        document.getElementById('dash-total-operativo').innerText = fmt.format(capTotal);
        document.getElementById('dash-total-bar-operator').innerText = '+';
      } else if (activeSrv === 'meli') {
        const meliVal = balances.meli || 0;
        const meliBase = balances.meliBase || 0;
        const meliDiff = meliVal - meliBase;

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(meliVal);
        document.getElementById('dash-total-terminal').innerText = fmt.format(meliBase);
        
        const totalEl = document.getElementById('dash-total-operativo');
        const operatorEl = document.getElementById('dash-total-bar-operator');
        if (operatorEl) operatorEl.innerText = '-';
        
        if (totalEl) {
          if (meliDiff === 0) {
            totalEl.innerText = "✅ Cuadrado: $0.00";
            totalEl.className = "text-xl font-black text-white";
          } else if (meliDiff > 0) {
            totalEl.innerText = `🟢 Sobrante: +${fmt.format(meliDiff)}`;
            totalEl.className = "text-xl font-black text-emerald-200";
          } else {
            totalEl.innerText = `🔴 Faltante: -${fmt.format(Math.abs(meliDiff))}`;
            totalEl.className = "text-xl font-black text-rose-200";
          }
        }
      } else if (activeSrv === 'bbva') {
        // BBVA: Solo mostrar retiros realizados en el día, ocultando columnas inicial/flujo
        let totalRetiros = 0;
        dateLogs.forEach(log => {
          if (!log || !log.category) return;
          if (log.category.toUpperCase() === 'BBVA' && log.amount < 0) {
            totalRetiros += Math.abs(log.amount);
          }
        });

        // Asegurarnos de que el texto de operativo restablece su clase
        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Ocultar elementos de la barra para BBVA
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.add('hidden');
        if (col2) col2.classList.add('hidden');
        if (op) op.classList.add('hidden');
        if (eq) eq.classList.add('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(0);
        document.getElementById('dash-total-terminal').innerText = fmt.format(totalRetiros);
        document.getElementById('dash-total-operativo').innerText = fmt.format(totalRetiros);
        document.getElementById('dash-total-bar-operator').innerText = '+';
      } else if (activeSrv === 'caja') {
        // Bóveda (Caja):
        // Ingreso Agregado = Saldo Inicial + Depósitos a Bóveda
        // Retiros = Retiros de Bóveda a Caja
        // Bóveda Total = Ingreso Agregado - Retiros
        let totalDepositsToBoveda = 0;
        let totalWithdrawalsFromBoveda = 0;
        
        dateLogs.forEach(log => {
          if (!log || !log.category) return;
          if (log.category.toUpperCase() === 'CAJA') {
            if (log.amount < 0) {
              totalDepositsToBoveda += Math.abs(log.amount);
            } else {
              totalWithdrawalsFromBoveda += log.amount;
            }
          }
        });

        const currentBoveda = balances.boveda || 0;
        const startingBoveda = currentBoveda - totalDepositsToBoveda + totalWithdrawalsFromBoveda;
        const ingresoAgregado = startingBoveda + totalDepositsToBoveda;
        const retiros = totalWithdrawalsFromBoveda;

        // Asegurarnos de que el texto de operativo restablece su clase
        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(ingresoAgregado);
        document.getElementById('dash-total-terminal').innerText = fmt.format(retiros);
        document.getElementById('dash-total-operativo').innerText = fmt.format(currentBoveda);
        const operatorEl = document.getElementById('dash-total-bar-operator');
        if (operatorEl) operatorEl.innerText = '-';
      } else if (activeSrv === 'tconecta') {
        // T-Conecta: Recarga Efectivo + T-Conecta Retiro = Entradas Banamex; T-Conecta Recarga (Terminal) Informativo
        let recargaEfectivo = 0;
        let tconectaRecarga = 0;
        let tconectaRetiro = 0;

        dateLogs.forEach(log => {
          if (!log || !log.category) return;
          const cat = log.category.toUpperCase();
          if (cat === 'TCONECTA_RECARGA_EFECTIVO') {
            recargaEfectivo += log.amount;
          } else if (cat === 'TCONECTA_RECARGA_TARJETA') {
            tconectaRecarga += log.amount;
          } else if (cat === 'TCONECTA_RETIRO') {
            tconectaRetiro += Math.abs(log.amount);
          }
        });

        const totalBanamexTConecta = recargaEfectivo + tconectaRetiro;

        // Configurar títulos de las columnas
        const label1El = document.getElementById('dash-total-bar-label1');
        const label2El = document.getElementById('dash-total-bar-label2');
        const label3El = document.getElementById('dash-total-bar-label3');
        const labelRetiro = document.getElementById('dash-total-bar-label-retiro');

        if (label1El) label1El.innerText = "Recarga Efectivo";
        if (label2El) label2El.innerText = "Recarga Terminal (Info)";
        if (labelRetiro) labelRetiro.innerText = "T-Conecta Retiro";
        if (label3El) {
          label3El.innerText = "Entradas Banamex";
          label3El.className = "text-[9px] font-bold text-yellow-300 uppercase tracking-wider block";
        }

        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        const opRetiro = document.getElementById('dash-total-bar-operator-retiro');
        const colRetiro = document.getElementById('dash-total-col-retiro');

        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');
        if (opRetiro) opRetiro.classList.remove('hidden');
        if (colRetiro) colRetiro.classList.remove('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(recargaEfectivo);
        document.getElementById('dash-total-terminal').innerText = fmt.format(tconectaRecarga);
        const totalRetiroEl = document.getElementById('dash-total-retiro');
        if (totalRetiroEl) totalRetiroEl.innerText = fmt.format(tconectaRetiro);
        document.getElementById('dash-total-operativo').innerText = fmt.format(totalBanamexTConecta);

        if (op) op.innerText = '|';
        if (opRetiro) opRetiro.innerText = '+';
        if (eq) eq.innerText = '=';
      } else {
        const totalVal = balances[activeSrv] || 0;
        const flujoVal = todayMovements;
        const inicialVal = totalVal - flujoVal;

        // Asegurarnos de que el texto de operativo restablece su clase
        const totalEl = document.getElementById('dash-total-operativo');
        if (totalEl) totalEl.className = "text-xl font-black text-yellow-300";

        // Mostrar elementos de la barra
        const col1 = document.getElementById('dash-total-col1');
        const col2 = document.getElementById('dash-total-col2');
        const op = document.getElementById('dash-total-bar-operator');
        const eq = document.getElementById('dash-total-bar-equals');
        if (col1) col1.classList.remove('hidden');
        if (col2) col2.classList.remove('hidden');
        if (op) op.classList.remove('hidden');
        if (eq) eq.classList.remove('hidden');

        document.getElementById('dash-total-charola').innerText = fmt.format(inicialVal);
        document.getElementById('dash-total-terminal').innerText = formatSignedCurrency(flujoVal);
        document.getElementById('dash-total-operativo').innerText = fmt.format(totalVal);
        document.getElementById('dash-total-bar-operator').innerText = '+';
      }

      // Update Gradient
      const container = document.getElementById('dash-total-bar-container');
      if (container) {
        // Remove all possible gradients
        const allGradients = [];
        Object.values(SERVICE_BAR_CONFIGS).forEach(cfg => {
          allGradients.push(...cfg.gradient);
        });
        container.classList.remove(...allGradients);
        container.classList.add(...config.gradient);
      }

      // Mostrar/ocultar los detalles de Charola + Terminal del totalizador bar
      const detailsContainer = document.getElementById('dash-total-bar-details');
      const barContainer = document.getElementById('dash-total-bar-container');
      if (detailsContainer) {
        if (activeSrv === 'cambio') {
          detailsContainer.classList.add('hidden');
          if (barContainer) {
            barContainer.classList.remove('justify-between');
            barContainer.classList.add('justify-center');
          }
        } else {
          detailsContainer.classList.remove('hidden');
          if (barContainer) {
            barContainer.classList.remove('justify-center');
            barContainer.classList.add('justify-between');
          }
        }
      }

      // Actualizar visualmente los últimos 5 movimientos del servicio activo
      actualizarUltimosMovimientos();
    }

    // === INICIO Y CIERRE DE TURNO ===
    function intentarIniciarTurno() {
      const startingYastas = parseFloat(document.getElementById('apertura-yastas').value);

      if (isNaN(startingYastas) || startingYastas < 0) {
        mostrarToast("Ingrese un saldo inicial para la terminal Yastas.", "error");
        return;
      }

      let startingCashSum = 0;
      const inputs = document.querySelectorAll('.denom-input-field[id^="apertura-"]');
      const startingInventory = {};

      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        startingCashSum += denom * cant;
        startingInventory[denom] = cant;
      });

      if (startingCashSum <= 0) {
        mostrarToast("Declare las piezas físicas iniciales en la charola.", "error");
        return;
      }

      const operatorName = "Turno Activo";

      // Configurar inventario inicial de la charola
      DB.set('inventory', startingInventory);
      // NOTA: inventoryBoveda NO se resetea — persiste entre turnos
      
      const balances = DB.get('balances', {});
      const carryOverBanorte = balances.banorte || 0;
      const carryOverMeli = balances.meli || 0;

      // Yastas: terminal declarada en apertura; efectivo = suma del efectivo físico inicial
      balances.yastasTerminal = startingYastas; 
      balances.yastasEfectivo = startingCashSum; // El efectivo físico inicial VA al efectivo de Yastas
      balances.banorte = carryOverBanorte; 
      balances.meli = carryOverMeli; 
      
      // Restablecer flujos diarios
      balances.tconecta = 0;
      balances.transferencia = 0;
      balances.bbva = 0;
      balances.banamex = 0;
      balances.capital = (typeof balances.capital !== 'undefined') ? balances.capital : 0;
      // NOTA: balances.boveda se recalcula desde inventoryBoveda — no se resetea
      
      DB.set('balances', balances);

      // Restablecer logs de sesión activa
      DB.set('logs', []);

      // Obtener fecha de hoy
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Guardar el estado con fecha y hora de apertura
      const timeStr = now.toLocaleTimeString();
      DB.set('state', { 
        session_active: true, 
        operator: operatorName, 
        opened_date: todayStr,
        opened_time: timeStr
      });
      sessionActive = true;
      activeOperator = operatorName;

      registrarMovimientoBitacora("Apertura", "Apertura", startingCashSum, `Inicio de turno. Efectivo base: ${fmt.format(startingCashSum)}. Yastas: ${fmt.format(startingYastas)}`, startingInventory);

      mostrarToast("Turno iniciado.", "success");
      refrescarPantallas();
    }

    function cerrarTurno() {
      if (!sessionActive) return;
      
      // Asegurarnos de salir de la vista de reporte histórico al intentar cerrar el turno activo
      const filtroFecha = document.getElementById('filtro-fecha');
      if (filtroFecha) {
        const state = DB.get('state', {});
        let targetDate = '';
        if (state.apertura_date) {
          targetDate = state.apertura_date;
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          targetDate = `${year}-${month}-${day}`;
        }
        filtroFecha.value = targetDate;
      }

      viendoHistoricoCierre = false;
      restaurarCierreModoInteractivo();

      const banner = document.getElementById('cierre-historico-banner');
      if (banner) banner.classList.add('hidden');
      
      // Limpiar inputs del conteo a ceros
      const pzIds = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
      pzIds.forEach(id => {
        const input = document.getElementById(`cierre-pz-${id}`);
        if (input) input.value = '';
      });
      
      // Obtener balances esperados
      const balances = DB.get('balances', {});
      const expectedCajon = balances.yastasEfectivo || 0;
      const expectedBoveda = balances.boveda || 0;
      const expectedTotal = expectedCajon + expectedBoveda;
      
      // Transicionar a la pantalla completa de cierre
      mostrarSubvista('cierre');
      
      // Calcular e inicializar
      calcularTotalCierre();
    }

    // === CONFIGURACIÓN DE OPERACIÓN ===
    function setOpType(type) {
      const srv = document.getElementById('op-service').value;
      const meliModoInput = document.getElementById('op-modo-meli-val');
      const meliModo = meliModoInput ? meliModoInput.value : 'tienda';

      if (srv !== 'yastas' && (type === 'redeposito' || type === 'recarga')) {
        return;
      }

      if (srv === 'bbva' && type === 'ingreso') {
        mostrarToast("Solo se pueden hacer retiros de BBVA.", "warning");
        return; // Prevent changing to ingreso for BBVA
      }
      if (srv === 'meli' && meliModo === 'negocio' && type === 'salida') {
        mostrarToast("Solo se pueden hacer ingresos en Meli Terminal.", "warning");
        return;
      }

      currentOpType = type;
      const tabIngreso = document.getElementById('tab-ingreso');
      const tabSalida = document.getElementById('tab-salida');
      const tabRedeposito = document.getElementById('tab-redeposito');
      const tabRecarga = document.getElementById('tab-recarga');
      
      const allTabs = [tabIngreso, tabSalida, tabRedeposito, tabRecarga];
      allTabs.forEach(tab => {
        if (!tab) return;
        tab.classList.remove('border-emerald-500', 'text-emerald-600', 'bg-emerald-50/20',
                             'border-rose-500', 'text-rose-600', 'bg-rose-50/20',
                             'border-indigo-500', 'text-indigo-600', 'bg-indigo-50/20',
                             'border-teal-500', 'text-teal-600', 'bg-teal-50/20');
        tab.classList.add('border-transparent', 'text-slate-400', 'hover:text-slate-600', 'hover:bg-slate-50/50');
      });

      if (type === 'ingreso') {
        tabIngreso.classList.remove('border-transparent', 'text-slate-400');
        tabIngreso.classList.add('border-emerald-500', 'text-emerald-600', 'bg-emerald-50/20');
        document.getElementById('btn-procesar-operacion').className = "w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-100 flex items-center justify-center gap-2";
      } else if (type === 'salida') {
        tabSalida.classList.remove('border-transparent', 'text-slate-400');
        tabSalida.classList.add('border-rose-500', 'text-rose-600', 'bg-rose-50/20');
        document.getElementById('btn-procesar-operacion').className = "w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-rose-100 flex items-center justify-center gap-2";
      } else if (type === 'redeposito') {
        tabRedeposito.classList.remove('border-transparent', 'text-slate-400');
        tabRedeposito.classList.add('border-indigo-500', 'text-indigo-600', 'bg-indigo-50/20');
        document.getElementById('btn-procesar-operacion').className = "w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2";
      } else if (type === 'recarga') {
        if (tabRecarga) {
          tabRecarga.classList.remove('border-transparent', 'text-slate-400');
          tabRecarga.classList.add('border-teal-500', 'text-teal-600', 'bg-teal-50/20');
        }
        document.getElementById('btn-procesar-operacion').className = "w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-teal-100 flex items-center justify-center gap-2";
      }
      actualizarFormularioOperacion();
    }

    function actualizarFormularioOperacion() {
      limpiarDesglose(true);
      setCambioModo('sugerido');
      const srv = document.getElementById('op-service').value;
      const panelOrigen = document.getElementById('panel-origen-efectivo');
      const panelManual = document.getElementById('panel-monto-manual');
      const panelConceptoTransferencia = document.getElementById('panel-concepto-transferencia');
      const panelMotivoCapital = document.getElementById('panel-motivo-capital');
      const panelUbicacionBoveda = document.getElementById('panel-ubicacion-boveda');
      const labelManual = document.getElementById('label-monto-manual');
      const descManual = document.getElementById('desc-monto-manual');
      const tabIngreso = document.getElementById('tab-ingreso');
      const tabSalida = document.getElementById('tab-salida');
      const tabRedeposito = document.getElementById('tab-redeposito');
      const tabRecarga = document.getElementById('tab-recarga');

      // Default: show basic tabs, hide special ones
      tabIngreso.classList.remove('hidden');
      tabSalida.classList.remove('hidden');
      tabRedeposito.classList.add('hidden');
      if (tabRecarga) tabRecarga.classList.add('hidden');



      const meliModoInput = document.getElementById('op-modo-meli-val');
      const meliModo = meliModoInput ? meliModoInput.value : 'tienda';

      if (srv === 'yastas') {
        tabRedeposito.classList.remove('hidden');
        if (tabRecarga) tabRecarga.classList.remove('hidden');
        tabIngreso.innerHTML = `<i data-lucide="plus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Depósito (+)`;
        tabSalida.innerHTML = `<i data-lucide="minus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Retiro (-)`;
      } else if (srv === 'bbva') {
        tabIngreso.classList.add('hidden'); // Ocultar pestaña de Ingreso para BBVA
        tabSalida.innerHTML = `<i data-lucide="minus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Retiro (-)`;
        
        // Forzar a salida si estaba en ingreso u otras pestañas no válidas
        if (currentOpType === 'ingreso' || currentOpType === 'redeposito' || currentOpType === 'recarga') {
          currentOpType = 'salida';
          tabSalida.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-rose-500 text-rose-600 bg-rose-50/20";
          document.getElementById('btn-procesar-operacion').className = "w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-rose-100 flex items-center justify-center gap-2";
        }
      } else if (srv === 'meli' && meliModo === 'negocio') {
        tabSalida.classList.add('hidden'); // Ocultar pestaña de Salida para Meli Terminal
        tabIngreso.innerHTML = `<i data-lucide="plus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Ingreso (+)`;
        
        // Forzar a ingreso si estaba en salida o especial
        if (currentOpType === 'salida' || currentOpType === 'redeposito' || currentOpType === 'recarga') {
          currentOpType = 'ingreso';
          tabIngreso.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/20";
          document.getElementById('btn-procesar-operacion').className = "w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-100 flex items-center justify-center gap-2";
        }
      } else {
        // Otros servicios (T-Conecta, Banorte, etc.): Ocultar 100% garantizado Re-depósito y Recarga de Yastas
        tabRedeposito.classList.add('hidden');
        if (tabRecarga) tabRecarga.classList.add('hidden');

        tabIngreso.innerHTML = srv === 'tconecta'
          ? `<i data-lucide="plus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Recarga Telefónica (+)`
          : `<i data-lucide="plus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Ingreso (+)`;
        tabSalida.innerHTML = srv === 'tconecta' 
          ? `<i data-lucide="minus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Retiro de Efectivo (-)` 
          : `<i data-lucide="minus-circle" class="w-4.5 h-4.5 inline mr-1 mb-0.5"></i> Salida (-)`;
        
        // Forzar a ingreso si estaba en redeposito o recarga
        if (currentOpType === 'redeposito' || currentOpType === 'recarga') {
          currentOpType = 'ingreso';
          tabIngreso.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/20";
          document.getElementById('btn-procesar-operacion').className = "w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-100 flex items-center justify-center gap-2";
        }
      }
      lucide.createIcons();

      // Reset titles and classes
      const charolaTituloEl = document.getElementById('dash-charola-titulo');
      if (charolaTituloEl) {
        charolaTituloEl.innerHTML = 'Charola de Efectivo (Ingresa Piezas)';
        charolaTituloEl.className = 'font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider';
      }

      // Reset all panels visibility
      panelOrigen.classList.remove('hidden');
      panelManual.classList.add('hidden');
      panelConceptoTransferencia.classList.add('hidden');
      panelMotivoCapital.classList.add('hidden');
      panelUbicacionBoveda.classList.add('hidden');
      const panelMontoBoveda = document.getElementById('panel-monto-boveda');
      if (panelMontoBoveda) panelMontoBoveda.classList.add('hidden');
      const inputMontoBoveda = document.getElementById('op-monto-boveda');
      if (inputMontoBoveda) inputMontoBoveda.value = '';
      document.getElementById('panel-metodo-pago-banorte').classList.add('hidden');
      
      const inputDep = document.getElementById('op-cambio-deposito');
      if (inputDep) inputDep.value = '';
      document.getElementById('panel-modo-meli').classList.add('hidden');
      document.getElementById('panel-cambio-salida').classList.add('hidden');
      document.getElementById('panel-yastas-redeposito').classList.add('hidden');
      const panelRecarga = document.getElementById('panel-yastas-recarga');
      if (panelRecarga) panelRecarga.classList.add('hidden');
      document.getElementById('op-tabs-container').classList.remove('hidden');
      tabIngreso.disabled = false;
      tabIngreso.classList.remove('opacity-50', 'cursor-not-allowed');

      // Re-aplicar estilos visuales de pestañas y botón si no es BBVA
      if (srv !== 'bbva') {
        const btnProc = document.getElementById('btn-procesar-operacion');
        if (currentOpType === 'ingreso') {
          tabIngreso.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/20";
          tabSalida.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50";
          if (btnProc) btnProc.className = "w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-emerald-100 flex items-center justify-center gap-2";
        } else if (currentOpType === 'salida') {
          tabSalida.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-rose-500 text-rose-600 bg-rose-50/20";
          tabIngreso.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50";
          if (btnProc) btnProc.className = "w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-rose-100 flex items-center justify-center gap-2";
        }
      }

      if (srv === 'yastas') {
        if (currentOpType === 'redeposito') {
          panelOrigen.classList.add('hidden');
          document.getElementById('panel-yastas-redeposito').classList.remove('hidden');
          
          const charolaTituloEl = document.getElementById('dash-charola-titulo');
          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = `💰 EFECTIVO DE RE-DEPÓSITO`;
            charolaTituloEl.className = 'font-black text-indigo-600 dark:text-indigo-400 text-sm uppercase tracking-wider';
          }
          lucide.createIcons();
          calcularDiferenciaRedeposito();
        } else if (currentOpType === 'recarga') {
          panelOrigen.classList.add('hidden');
          if (panelRecarga) panelRecarga.classList.remove('hidden');
          
          const recargaTituloSpan = document.getElementById('recarga-panel-titulo');
          if (recargaTituloSpan) recargaTituloSpan.innerText = 'Recarga Telefónica (Yastas)';
          
          const charolaTituloEl = document.getElementById('dash-charola-titulo');
          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = `📱 RECARGA TELEFÓNICA`;
            charolaTituloEl.className = 'font-black text-teal-650 dark:text-teal-400 text-sm uppercase tracking-wider';
          }
          lucide.createIcons();
          
          const recargaMetodoVal = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
          setRecargaMetodo(recargaMetodoVal);
        }
      }

      if (srv === 'tconecta') {
        const panelRetiroCalc = document.getElementById('panel-calculadora-retiro');
        if (panelRetiroCalc) panelRetiroCalc.classList.add('hidden');

        if (currentOpType === 'ingreso') {
          panelOrigen.classList.add('hidden');
          if (panelRecarga) panelRecarga.classList.remove('hidden');
          
          const recargaTituloSpan = document.getElementById('recarga-panel-titulo');
          if (recargaTituloSpan) recargaTituloSpan.innerText = 'Recarga Telefónica (T-Conecta)';
          
          const charolaTituloEl = document.getElementById('dash-charola-titulo');
          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = `📱 RECARGA TELEFÓNICA`;
            charolaTituloEl.className = 'font-black text-teal-600 dark:text-teal-400 text-sm uppercase tracking-wider';
          }
          lucide.createIcons();
          
          const recargaMetodoVal = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
          setRecargaMetodo(recargaMetodoVal);
        } else if (currentOpType === 'salida') {
          // Ocultar paneles de recarga y redepósito al retirar
          if (panelRecarga) panelRecarga.classList.add('hidden');
          const panelRedeposito = document.getElementById('panel-yastas-redeposito');
          if (panelRedeposito) panelRedeposito.classList.add('hidden');
          
          panelOrigen.classList.remove('hidden');
          
          const charolaTituloEl = document.getElementById('dash-charola-titulo');
          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = `💸 RETIRO DE EFECTIVO (T-CONECTA)`;
            charolaTituloEl.className = 'font-black text-rose-600 dark:text-rose-400 text-sm uppercase tracking-wider';
          }
          lucide.createIcons();
          toggleCharolaInputs(false);
        }
      }

      if (srv === 'banorte') {
        panelOrigen.classList.add('hidden');
        panelManual.classList.remove('hidden');
        document.getElementById('op-monto-manual').value = "";
        labelManual.innerText = "Venta Electrónica (Terminal Banorte)";
        descManual.innerText = "Banorte no requiere desglose físico. Escriba el monto directamente en el campo.";
        
        // Si es depósito (Ingreso) de Banorte, elegir entre tarjeta y transferencia
        if (currentOpType === 'ingreso') {
          document.getElementById('panel-metodo-pago-banorte').classList.remove('hidden');
          setBanorteMetodo('terminal'); // default terminal
        }
        
        // Si es retiro (Salida) de Banorte, pedir motivo obligatoriamente
        if (currentOpType === 'salida') {
          panelMotivoCapital.classList.remove('hidden');
          document.getElementById('op-motivo-capital').value = "";
          document.getElementById('op-motivo-capital').placeholder = "Ej. Retiro por excedente, Traspaso a cuenta";
        }
      } else if (srv === 'transferencia') {
        panelOrigen.classList.add('hidden');
        panelManual.classList.remove('hidden');
        panelConceptoTransferencia.classList.remove('hidden');
        document.getElementById('op-monto-manual').value = "";
        document.getElementById('op-concepto-transferencia').value = "";
        labelManual.innerText = "Monto de la Transferencia";
        descManual.innerText = "Las transferencias no usan efectivo físico. Ingrese el monto de la transferencia.";
      } else if (srv === 'meli') {
        if (currentOpType === 'salida') {
          document.getElementById('panel-modo-meli').classList.add('hidden');
          document.getElementById('op-modo-meli-val').value = 'tienda';
          const btnTienda = document.getElementById('btn-meli-tienda');
          const btnNegocio = document.getElementById('btn-meli-negocio');
          if (btnTienda) btnTienda.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-amber-500 text-amber-600 bg-amber-50";
          if (btnNegocio) btnNegocio.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-slate-200 text-slate-500 bg-white hover:bg-slate-50";
        } else {
          document.getElementById('panel-modo-meli').classList.remove('hidden');
        }

        const meliModo = document.getElementById('op-modo-meli-val').value;
        if (meliModo === 'tienda') {
          panelOrigen.classList.remove('hidden');
          panelManual.classList.add('hidden');
        } else {
          panelOrigen.classList.add('hidden');
          panelManual.classList.remove('hidden');
          document.getElementById('op-monto-manual').value = "";
          labelManual.innerText = "Venta en el Negocio (Mercado Libre)";
          descManual.innerText = "Operación con terminal Mercado Libre para gastos del negocio. Escriba el monto directamente.";
        }
      } else if (srv === 'bbva') {
        if (currentOpType === 'ingreso') {
          currentOpType = 'salida'; // Force switch to Salida without calling setOpType (avoid recursion)
          tabIngreso.className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50";
          document.getElementById('tab-salida').className = "flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition border-b-2 border-rose-500 text-rose-600 bg-rose-50/20";
          document.getElementById('btn-procesar-operacion').className = "w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition shadow-md shadow-rose-100 flex items-center justify-center gap-2";
        }
        tabIngreso.disabled = true; // Disable Ingreso tab visually and functionally
        tabIngreso.classList.add('opacity-50', 'cursor-not-allowed');
      } else if (srv === 'capital') {
        panelOrigen.classList.add('hidden');
        panelManual.classList.add('hidden');

        const panelCapital = document.getElementById('panel-anexar-capital');
        const panelRetiro = document.getElementById('panel-calculadora-retiro');
        const btnProcesar = document.getElementById('btn-procesar-operacion');
        
        const fisicaSeccion = document.getElementById('dash-charola-fisica-seccion');
        const placeholderSeccion = document.getElementById('dash-charola-placeholder');
        const limpiarBtn = document.getElementById('dash-charola-limpiar-btn');
        const ultimosMovsSeccion = document.getElementById('dash-ultimos-movimientos-seccion');
        const charolaTituloEl = document.getElementById('dash-charola-titulo');
        const capitalMovsSeccion = document.getElementById('dash-capital-movimientos-seccion');

        if (currentOpType === 'ingreso') {
          // Vista de Anexo/Depósito de Capital
          if (panelCapital) panelCapital.classList.remove('hidden');
          if (panelRetiro) panelRetiro.classList.add('hidden');
          if (btnProcesar) btnProcesar.classList.add('hidden');

          // Ocultar sección de movimientos de la izquierda (ahora va en modal)
          if (capitalMovsSeccion) capitalMovsSeccion.classList.add('hidden');
          if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
          if (ultimosMovsSeccion) ultimosMovsSeccion.classList.add('hidden');

          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = 'Sistema Híbrido';
            charolaTituloEl.className = 'font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider';
          }
          
          abrirAnexarCapital();
        } else {
          // Vista de Retiro/Egreso de Capital
          if (panelCapital) panelCapital.classList.add('hidden');
          if (panelRetiro) panelRetiro.classList.remove('hidden');
          if (btnProcesar) btnProcesar.classList.remove('hidden');

          // Columna izquierda: mostrar charola física, ocultar lista de movimientos
          if (fisicaSeccion) fisicaSeccion.classList.remove('hidden');
          if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
          if (limpiarBtn) limpiarBtn.classList.remove('hidden');
          if (ultimosMovsSeccion) ultimosMovsSeccion.classList.add('hidden');
          if (capitalMovsSeccion) capitalMovsSeccion.classList.add('hidden');

          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = 'Charola de Efectivo (Ingresa Piezas)';
            charolaTituloEl.className = 'font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider';
          }
          
          calcularRetiroOperacion();
        }
      } else if (srv === 'caja') {
        panelUbicacionBoveda.classList.remove('hidden');
        const panelMontoBoveda = document.getElementById('panel-monto-boveda');
        if (panelMontoBoveda) panelMontoBoveda.classList.remove('hidden');
        const labelMontoBoveda = document.getElementById('label-monto-boveda');
        
        const labelUbicacion = document.getElementById('label-ubicacion-boveda');
        const inputUbicacion = document.getElementById('op-ubicacion-boveda');
        inputUbicacion.value = "";
        
        if (currentOpType === 'ingreso') {
          labelUbicacion.innerText = "Destino / Lugar de guardado";
          inputUbicacion.placeholder = "Ej. Caja fuerte principal, Sobre de depósito";
          if (labelMontoBoveda) labelMontoBoveda.innerText = "Monto a Depositar en Bóveda ($)";
        } else {
          labelUbicacion.innerText = "Origen / Lugar de salida";
          inputUbicacion.placeholder = "Ej. Caja fuerte principal, Compartimento B";
          if (labelMontoBoveda) labelMontoBoveda.innerText = "Monto a Retirar de Bóveda ($)";
        }
      } else if (srv === 'cambio') {
        panelOrigen.classList.add('hidden');
        document.getElementById('panel-cambio-salida').classList.remove('hidden');
        document.getElementById('op-tabs-container').classList.add('hidden');
        
        const charolaTituloEl = document.getElementById('dash-charola-titulo');
        if (charolaTituloEl) {
          charolaTituloEl.innerHTML = `📥 EFECTIVO RECIBIDO <span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md px-1.5 py-0.5 ml-2 normal-case font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-left" class="w-3.5 h-3.5 text-emerald-500"></i> Entrada a caja</span>`;
          charolaTituloEl.className = 'font-black text-emerald-600 dark:text-emerald-400 text-sm uppercase tracking-wider flex items-center';
        }

        setCambioSalidaModo('sugerido');
        
        lucide.createIcons();
      }

      // Resaltar tarjeta correspondiente al valor del select
      const srvIds = {
        'yastas': 'card-yastas',
        'meli': 'card-meli',
        'banorte': 'card-banorte',
        'bbva': 'card-bbva',
        'tconecta': 'card-tconecta',
        'transferencia': 'card-transferencia',
        'caja': 'card-caja',
        'capital': 'card-capital',
        'cambio': 'card-cambio'
      };
      Object.keys(srvIds).forEach(key => {
        const card = document.getElementById(srvIds[key]);
        if (card) {
          if (key === srv) {
            card.classList.add('ring-4', 'ring-indigo-600', 'ring-offset-2', 'shadow-md');
          } else {
            card.classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'shadow-md');
          }
        }
      });

      // Determinar si la operación usa la Charola de Efectivo Físico o es 100% digital/manual
      let usesCharola = true;
      if (srv === 'banorte' || srv === 'transferencia') {
        usesCharola = false;
      } else if (srv === 'meli') {
        const meliModo = document.getElementById('op-modo-meli-val') ? document.getElementById('op-modo-meli-val').value : 'tienda';
        usesCharola = (meliModo === 'tienda');
      } else if (srv === 'capital') {
        usesCharola = (currentOpType === 'salida' || modoAnexarCapital === 'efectivo');
      } else if (srv === 'yastas' && currentOpType === 'recarga') {
        const recargaMetodo = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
        usesCharola = (recargaMetodo === 'efectivo');
      } else if (srv === 'tconecta' && currentOpType === 'ingreso') {
        const recargaMetodo = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
        usesCharola = (recargaMetodo === 'efectivo');
      }

      const fisicaSeccion = document.getElementById('dash-charola-fisica-seccion');
      const placeholderSeccion = document.getElementById('dash-charola-placeholder');
      const limpiarBtn = document.getElementById('dash-charola-limpiar-btn');
      const ultimosMovsSeccion = document.getElementById('dash-ultimos-movimientos-seccion');

      const isBanorte = (srv === 'banorte');
      const isMeliNegocio = (srv === 'meli' && !usesCharola);

      if (fisicaSeccion && placeholderSeccion && limpiarBtn) {
        // Por defecto, resetear el desglose si no usa charola
        if (!usesCharola) {
          const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
          inputs.forEach(inp => {
            inp.value = 0;
            const sub = document.getElementById(`dash-sub-${inp.getAttribute('data-denom')}`);
            if (sub) sub.innerText = fmt.format(0);
          });
        }

        if (isBanorte || isMeliNegocio) {
          // Ocultar charola física, placeholder y botón limpiar
          fisicaSeccion.classList.add('hidden');
          placeholderSeccion.classList.add('hidden');
          limpiarBtn.classList.add('hidden');
          
          // Mostrar sólo los últimos movimientos en el espacio completo
          if (ultimosMovsSeccion) ultimosMovsSeccion.classList.remove('hidden');

          // Personalizar título
          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = `📊 HISTORIAL RECIENTE (${isBanorte ? 'BANORTE' : 'MERCADO LIBRE'})`;
            charolaTituloEl.className = 'font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider';
          }
        } else {
          // Comportamiento estándar (ocultar últimos movimientos de esta área para otros servicios)
          if (ultimosMovsSeccion) ultimosMovsSeccion.classList.add('hidden');

          if (charolaTituloEl) {
            charolaTituloEl.innerHTML = srv === 'cambio' 
              ? `📥 EFECTIVO RECIBIDO <span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md px-1.5 py-0.5 ml-2 normal-case font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-left" class="w-3.5 h-3.5 text-emerald-500"></i> Entrada a caja</span>`
              : (srv === 'yastas' && currentOpType === 'redeposito')
                ? `💰 EFECTIVO DE RE-DEPÓSITO`
                : 'Charola de Efectivo (Ingresa Piezas)';
            
            charolaTituloEl.className = (srv === 'cambio')
              ? 'font-black text-emerald-600 dark:text-emerald-400 text-sm uppercase tracking-wider flex items-center'
              : (srv === 'yastas' && currentOpType === 'redeposito')
                ? 'font-black text-indigo-600 dark:text-indigo-400 text-sm uppercase tracking-wider'
                : 'font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider';
          }

          // Restablecer estilos de la charola por defecto
          fisicaSeccion.classList.remove('opacity-40', 'pointer-events-none');

          if (usesCharola) {
            fisicaSeccion.classList.remove('hidden');
            placeholderSeccion.classList.add('hidden');
            limpiarBtn.classList.remove('hidden');
          } else {
            // Mostrar charola desactivada (opaca) en lugar de ocultarla
            fisicaSeccion.classList.remove('hidden');
            fisicaSeccion.classList.add('opacity-40', 'pointer-events-none');
            placeholderSeccion.classList.add('hidden');
            limpiarBtn.classList.add('hidden');
          }
        }
      }

      cargarSaldosDigitales();
      calcularTotalLocal();
      calcularCambioOperacion();
      calcularRetiroOperacion();
    }

    function seleccionarServicioCard(srv) {
      const select = document.getElementById('op-service');
      if (!select) return;

      const prevSrv = select.value;
      if (prevSrv === 'bbva' && srv !== 'bbva') {
        currentOpType = 'ingreso';
      }

      if ((currentOpType === 'redeposito' || currentOpType === 'recarga') && srv !== 'yastas') {
        currentOpType = 'ingreso';
      }

      // Actualizar destaque visual de las tarjetas con su color distintivo
      const srvThemes = {
        'yastas': { ring: 'ring-purple-600', ringDark: 'dark:ring-purple-400' },
        'banorte': { ring: 'ring-rose-600', ringDark: 'dark:ring-rose-400' },
        'meli': { ring: 'ring-amber-500', ringDark: 'dark:ring-amber-400' },
        'bbva': { ring: 'ring-blue-700', ringDark: 'dark:ring-blue-500' },
        'tconecta': { ring: 'ring-sky-500', ringDark: 'dark:ring-sky-400' },
        'capital': { ring: 'ring-teal-600', ringDark: 'dark:ring-teal-400' },
        'caja': { ring: 'ring-slate-700', ringDark: 'dark:ring-slate-400' },
        'cambio': { ring: 'ring-amber-600', ringDark: 'dark:ring-amber-400' }
      };

      const srvIds = {
        'yastas': 'card-yastas',
        'meli': 'card-meli',
        'banorte': 'card-banorte',
        'bbva': 'card-bbva',
        'tconecta': 'card-tconecta',
        'caja': 'card-caja',
        'capital': 'card-capital',
        'cambio': 'card-cambio'
      };

      Object.keys(srvIds).forEach(key => {
        const card = document.getElementById(srvIds[key]);
        if (card) {
          const theme = srvThemes[key];
          // Limpiar cualquier resaltado activo previo de cualquier color
          card.classList.remove(
            'ring-4', 'ring-offset-2', 'shadow-md',
            'ring-indigo-600', 'ring-purple-600', 'ring-rose-600', 'ring-amber-500', 'ring-blue-700', 'ring-sky-500', 'ring-teal-600', 'ring-slate-700', 'ring-amber-600',
            'dark:ring-purple-400', 'dark:ring-rose-400', 'dark:ring-amber-400', 'dark:ring-blue-500', 'dark:ring-sky-400', 'dark:ring-teal-400', 'dark:ring-slate-400'
          );
          if (key === srv && theme) {
            card.classList.add('ring-4', theme.ring, theme.ringDark, 'ring-offset-2', 'shadow-md');
          }
        }
      });

      if (srv === 'capital') {
        select.value = srv;

        // Reset inputs de capital
        const inputTerminal = document.getElementById('cap-monto-terminal');
        if (inputTerminal) inputTerminal.value = '';
        
        const inputMotivo = document.getElementById('cap-motivo');
        if (inputMotivo) inputMotivo.value = '';

        setModoAnexarCapital('efectivo');
      } else {
        // Para otros servicios: ocultar paneles de capital
        const panelCapital = document.getElementById('panel-anexar-capital');
        const capitalMovsSeccion = document.getElementById('dash-capital-movimientos-seccion');
        if (panelCapital) panelCapital.classList.add('hidden');
        if (capitalMovsSeccion) capitalMovsSeccion.classList.add('hidden');
      }

      // Para todos los servicios (incluyendo capital): restaurar tabs y botón normal
      const tabsContainer = document.getElementById('op-tabs-container');
      const btnProcesar = document.getElementById('btn-procesar-operacion');

      if (tabsContainer) tabsContainer.classList.remove('hidden');
      if (btnProcesar) btnProcesar.classList.remove('hidden');

      select.value = srv;
      actualizarFormularioOperacion();
      cargarSaldosDigitales();
    }


    function setRecargaMetodo(metodo) {
      const srv = document.getElementById('op-service').value;
      const valInput = document.getElementById('op-metodo-recarga-val');
      if (!valInput) return;
      valInput.value = metodo;

      const btnEfectivo = document.getElementById('btn-recarga-metodo-efectivo');
      const btnTerminal = document.getElementById('btn-recarga-metodo-terminal');
      const descEl = document.getElementById('desc-recarga-metodo');

      const fisicaSeccion = document.getElementById('dash-charola-fisica-seccion');
      const placeholderSeccion = document.getElementById('dash-charola-placeholder');
      const limpiarBtn = document.getElementById('dash-charola-limpiar-btn');

      if (metodo === 'efectivo') {
        if (btnEfectivo) btnEfectivo.className = "flex-grow py-2.5 rounded-xl text-xs font-bold border-2 border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 transition";
        if (btnTerminal) btnTerminal.className = "flex-grow py-2.5 rounded-xl text-xs font-bold border-2 border-transparent text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition";
        
        if (descEl) {
          descEl.innerText = srv === 'tconecta'
            ? "El cliente paga con efectivo. El efectivo ingresa a caja y el saldo digital de T-Conecta aumenta."
            : "El cliente paga con efectivo. El efectivo ingresa a caja y el saldo de la terminal disminuye.";
        }

        // Mostrar charola activa
        if (fisicaSeccion) {
          fisicaSeccion.classList.remove('hidden', 'opacity-40', 'pointer-events-none');
        }
        if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
        if (limpiarBtn) limpiarBtn.classList.remove('hidden');
        
        toggleCharolaInputs(false);
      } else {
        if (btnEfectivo) btnEfectivo.className = "flex-grow py-2.5 rounded-xl text-xs font-bold border-2 border-transparent text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition";
        if (btnTerminal) btnTerminal.className = "flex-grow py-2.5 rounded-xl text-xs font-bold border-2 border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 transition";
        
        if (descEl) {
          descEl.innerText = srv === 'tconecta'
            ? "El cliente paga con tarjeta en la terminal. El efectivo de la caja no cambia y el saldo digital de T-Conecta aumenta."
            : "El cliente paga con depósito/transferencia directo a la terminal. El saldo de la terminal Yastas aumenta por el abono.";
        }

        // Mostrar charola desactivada (opaca)
        if (fisicaSeccion) {
          fisicaSeccion.classList.remove('hidden');
          fisicaSeccion.classList.add('opacity-40', 'pointer-events-none');
        }
        if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
        if (limpiarBtn) limpiarBtn.classList.add('hidden');
      }
      actualizarMontoRecarga();
    }

    function actualizarMontoRecarga() {
      const input = document.getElementById('op-recarga-monto');
      const monto = input ? (parseFloat(input.value) || 0) : 0;
      
      const inputDep = document.getElementById('op-cambio-deposito');
      if (inputDep) inputDep.value = input ? input.value : '';

      calcularCambioOperacion();

      const btn = document.getElementById('btn-procesar-operacion');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = monto > 0 
          ? `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Recarga ${fmt.format(monto)}`
          : `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Recarga`;
      }
    }


    function setBanorteMetodo(metodo) {
      const valInput = document.getElementById('op-metodo-banorte-val');
      if (!valInput) return;
      valInput.value = metodo;

      const btnTerminal = document.getElementById('btn-metodo-terminal');
      const btnTransferencia = document.getElementById('btn-metodo-transferencia');
      const descManual = document.getElementById('desc-monto-manual');

      if (metodo === 'terminal') {
        btnTerminal.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-rose-500 text-rose-600 bg-rose-50";
        btnTransferencia.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-slate-200 text-slate-500 bg-white hover:bg-slate-50";
        if (descManual) descManual.innerText = "Venta con terminal Banorte. Deduce automáticamente un 2.32% de comisión bancaria.";
      } else {
        btnTerminal.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-slate-200 text-slate-500 bg-white hover:bg-slate-50";
        btnTransferencia.className = "py-2.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 border-rose-500 text-rose-600 bg-rose-50";
        if (descManual) descManual.innerText = "Pago con transferencia a Banorte. No aplica comisión.";
      }
    }

    function setMeliModo(modo) {
      const valInput = document.getElementById('op-modo-meli-val');
      if (!valInput) return;
      valInput.value = modo;

      const btnTienda = document.getElementById('btn-meli-tienda');
      const btnNegocio = document.getElementById('btn-meli-negocio');

      if (modo === 'tienda') {
        btnTienda.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-1.5 border-amber-600 bg-amber-500 text-white shadow-md shadow-amber-500/20";
        btnNegocio.className = "py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800";
      } else {
        btnTienda.className = "py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800";
        btnNegocio.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-black transition flex items-center justify-center gap-1.5 border-amber-600 bg-amber-500 text-white shadow-md shadow-amber-500/20";
      }
      
      actualizarFormularioOperacion();
    }



    // === VALIDAR OPERACIÓN Y PROCESAR ===
    function abrirModalPIN() {
      if (!sessionActive) return;
      const srv = document.getElementById('op-service').value;

      if (srv === 'yastas' && currentOpType === 'redeposito') {
        const totalRetiros = redepositoRetiros.reduce((sum, val) => sum + val, 0);
        const charolaSum = getCharolaFisicaTotalSum();
        const totalDeposito = totalRetiros + charolaSum;
        const diff = charolaSum;

        if (totalRetiros <= 0) {
          mostrarToast("Ingrese al menos un retiro virtual.", "error");
          return;
        }

        const balances = DB.get('balances', {});
        const saldoTerminal = balances.yastasTerminal || 0;
        if (totalDeposito > saldoTerminal) {
          mostrarAlertaError("Saldo Insuficiente en Terminal", `El depósito calculado de <b>${fmt.format(totalDeposito)}</b> supera el saldo disponible en tu terminal Yastas (disponible: <b>${fmt.format(saldoTerminal)}</b>).<br><br>Por favor, recargue saldo en la terminal antes de continuar.`);
          return;
        }
        if (Math.abs(charolaSum - Math.abs(diff)) < 0.01) {
          // Coincide, todo bien
        } else {
          mostrarToast(`La charola física (${fmt.format(charolaSum)}) no coincide con la diferencia de efectivo (${fmt.format(Math.abs(diff))}).`, "error");
          return;
        }

        // Si diff < 0, se entrega efectivo al cliente. Validar stock.
        if (diff < 0) {
          const inventory = DB.get('inventory', {});
          let errorStock = false;
          const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
          inputs.forEach(inp => {
            const denom = parseFloat(inp.getAttribute('data-denom'));
            const cant = parseInt(inp.value) || 0;
            if (cant > (inventory[denom] || 0)) {
              errorStock = true;
            }
          });
          if (errorStock) {
            mostrarToast("Error: La charola no tiene suficientes piezas de esa denominación para entregar al cliente.", "error");
            return;
          }
        }

        // Título del modal del PIN
        document.getElementById('pin-modal-titulo').innerText = `RE-DEPÓSITO: YASTAS`;
        const actionDesc = diff > 0 
          ? `Ingreso neto de ${fmt.format(diff)} (Depósito: ${fmt.format(totalDeposito)} | Retiros: ${fmt.format(totalRetiros)})`
          : (diff < 0 
              ? `Egreso neto de ${fmt.format(Math.abs(diff))} (Depósito: ${fmt.format(totalDeposito)} | Retiros: ${fmt.format(totalRetiros)})`
              : `Operación neta a $0.00 (Depósito: ${fmt.format(totalDeposito)} | Retiros: ${fmt.format(totalRetiros)})`);
        
        document.getElementById('pin-modal-desc').innerText = `Se va a autorizar la operación de Re-depósito. ${actionDesc}. Ingrese su PIN.`;
        
        abrirPINModal("Confirmación de Re-depósito", (opName) => {
          completarTransaccion(opName, charolaSum);
        });
        return;
      }

      let totalSum = 0;

      const isRecargaTerminal = (srv === 'yastas' && currentOpType === 'recarga' && document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
      const isRecargaTConectaTerminal = (srv === 'tconecta' && currentOpType === 'ingreso' && document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
      const isManualAmount = (srv === 'banorte' || srv === 'transferencia' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'negocio') || isRecargaTerminal || isRecargaTConectaTerminal);

      if (isManualAmount) {
        const inputVal = (isRecargaTerminal || isRecargaTConectaTerminal) ? document.getElementById('op-recarga-monto') : document.getElementById('op-monto-manual');
        const manualVal = inputVal ? parseFloat(inputVal.value) : 0;
        if (isNaN(manualVal) || manualVal <= 0) {
          mostrarToast("Ingrese un monto válido.", "error");
          return;
        }
        
        // Validación de saldo de terminal para retiros de Banorte
        if (srv === 'banorte' && currentOpType === 'salida') {
          const balances = DB.get('balances', {});
          const saldoBanorte = balances.banorte || 0;
          if (manualVal > saldoBanorte) {
            mostrarAlertaError("Saldo Insuficiente en Banorte", `El retiro de <b>${fmt.format(manualVal)}</b> supera el saldo disponible en tu cuenta Banorte (disponible: <b>${fmt.format(saldoBanorte)}</b>).<br><br>Por favor, ingrese un monto menor o ajuste el saldo disponible.`);
            return;
          }
        }
        totalSum = manualVal;
      }

      // Validaciones de campos de texto requeridos
      if (srv === 'transferencia') {
        const concepto = document.getElementById('op-concepto-transferencia').value.trim();
        if (!concepto) {
          mostrarToast("Ingrese el concepto de la transferencia.", "error");
          return;
        }
      } else if (srv === 'capital') {
        const motivo = document.getElementById('op-motivo-capital').value.trim();
        if (!motivo) {
          mostrarToast("Ingrese el motivo de la operación de capital.", "error");
          return;
        }
      } else if (srv === 'banorte' && currentOpType === 'salida') {
        const motivo = document.getElementById('op-motivo-capital').value.trim();
        if (!motivo) {
          mostrarToast("Ingrese el motivo del retiro de Banorte.", "error");
          return;
        }
      } else if (srv === 'caja') {
        const ubicacion = document.getElementById('op-ubicacion-boveda').value.trim();
        if (!ubicacion) {
          const msg = currentOpType === 'ingreso' 
            ? "Ingrese el destino / lugar de guardado del dinero en la bóveda." 
            : "Ingrese el origen / lugar de salida del dinero de la bóveda.";
          mostrarToast(msg, "error");
          return;
        }

        const inputMontoBoveda = document.getElementById('op-monto-boveda');
        const montoBoveda = inputMontoBoveda ? parseFloat(inputMontoBoveda.value) || 0 : 0;
        if (montoBoveda <= 0) {
          mostrarToast("Ingrese el monto total de la operación de bóveda.", "error");
          return;
        }
      }

      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        totalSum += denom * cant;
      });

      // Validación de doble confirmación para Bóveda (comparar charola vs monto indicado)
      if (srv === 'caja') {
        const inputMontoBoveda = document.getElementById('op-monto-boveda');
        const montoBoveda = inputMontoBoveda ? parseFloat(inputMontoBoveda.value) || 0 : 0;
        if (Math.abs(totalSum - montoBoveda) > 0.01) {
          mostrarToast(`El desglose físico de la charola (${fmt.format(totalSum)}) no coincide con el monto indicado para la bóveda (${fmt.format(montoBoveda)}).`, "error");
          return;
        }
      }

      if (srv === 'cambio') {
        let totalEntrada = totalSum;
        let totalSalida = 0;
        const idsMap = {
          'cambio-out-1000': 1000,
          'cambio-out-500': 500,
          'cambio-out-200': 200,
          'cambio-out-100': 100,
          'cambio-out-50': 50,
          'cambio-out-20': 20,
          'cambio-out-m10': 10,
          'cambio-out-m5': 5,
          'cambio-out-m2': 2,
          'cambio-out-m1': 1,
          'cambio-out-m05': 0.5
        };
        
        let errorStock = false;
        let denomError = '';
        const inventory = DB.get('inventory', {});

        Object.keys(idsMap).forEach(id => {
          const denom = idsMap[id];
          const cantOut = parseInt(document.getElementById(id).value) || 0;
          totalSalida += cantOut * denom;
          if (cantOut > (inventory[denom] || 0)) {
            errorStock = true;
            denomError = fmt.format(denom);
          }
        });

        if (totalEntrada <= 0) {
          mostrarToast("Ingrese las piezas recibidas en la charola izquierda.", "error");
          return;
        }
        if (totalEntrada !== totalSalida) {
          mostrarToast("El total de piezas recibidas no coincide con el total de piezas a entregar.", "error");
          return;
        }
        if (errorStock) {
          mostrarToast(`Error: La charola no tiene suficientes piezas de ${denomError} para entregar.`, "error");
          return;
        }
      } else if (!isManualAmount && totalSum <= 0) {
        const isRetiro = currentOpType === 'salida';
        const isPhysical = (srv === 'yastas' || srv === 'bbva' || srv === 'capital' || srv === 'tconecta' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'tienda'));
        const hasRetiroAsistido = (isRetiro && isPhysical);

        if (hasRetiroAsistido && currentModoRetiro === 'sugerido') {
          const inputRet = document.getElementById('op-retiro-monto');
          const montoRet = inputRet ? parseFloat(inputRet.value) : 0;
          if (montoRet <= 0) {
            mostrarToast("Por favor, ingrese el monto a retirar.", "error");
            return;
          }
          if (!currentSugerenciaRetiro) {
            mostrarToast("No hay suficiente efectivo físico en caja para este retiro.", "error");
            return;
          }
        } else {
          mostrarToast("Anote las piezas en la charola izquierda.", "error");
          return;
        }
      }

      // Validación de stock de la charola para salidas en efectivo
      const isSalidaDeCaja = (srv === 'caja') ? (currentOpType === 'ingreso') : (currentOpType === 'salida');
      if (isSalidaDeCaja && !isManualAmount) {
        const isRetiro = (srv !== 'caja' && currentOpType === 'salida');
        const isPhysical = (srv === 'yastas' || srv === 'bbva' || srv === 'capital' || srv === 'tconecta' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'tienda'));
        const hasRetiroAsistido = (isRetiro && isPhysical);

        if (!(hasRetiroAsistido && currentModoRetiro === 'sugerido')) {
          const inventory = DB.get('inventory', {});
          let errorStock = false;
          inputs.forEach(inp => {
            const denom = parseFloat(inp.getAttribute('data-denom'));
            const cant = parseInt(inp.value) || 0;
            if (cant > (inventory[denom] || 0)) {
              errorStock = true;
            }
          });
          if (errorStock) {
            mostrarToast("Error: La charola no tiene suficientes piezas de esa denominación para el retiro.", "error");
            return;
          }
        }
      }

      // Validación extra para Meli Salida: total disponible en caja debe alcanzar
      if (srv === 'meli' && currentOpType === 'salida') {
        const inventory = DB.get('inventory', {});
        let totalEnCaja = 0;
        Object.keys(inventory).forEach(d => { totalEnCaja += parseInt(d) * (inventory[d] || 0); });
        
        const isMeliTienda = document.getElementById('op-modo-meli-val').value === 'tienda';
        const checkAmount = (isMeliTienda && currentModoRetiro === 'sugerido')
          ? (parseFloat(document.getElementById('op-retiro-monto').value) || 0)
          : totalSum;

        if (checkAmount > totalEnCaja) {
          mostrarToast(`No hay suficiente efectivo en caja para este retiro de Meli. Disponible: ${fmt.format(totalEnCaja)}.`, "error");
          return;
        }
      }

      // Validación para Meli Ingreso (Depósito): debe haber saldo en la terminal Mercado Libre
      if (srv === 'meli' && currentOpType === 'ingreso') {
        const balances = DB.get('balances', {});
        const meliModo = document.getElementById('op-modo-meli-val').value;
        if (meliModo === 'tienda') {
          const saldoMeli = balances.meli || 0;
          if (totalSum > saldoMeli) {
            mostrarAlertaError("Saldo Insuficiente en Terminal Mercado Libre", `El depósito de <b>${fmt.format(totalSum)}</b> supera el saldo disponible en tu terminal Mercado Libre (disponible: <b>${fmt.format(saldoMeli)}</b>).<br><br>Por favor, recargue saldo en la terminal antes de continuar.`);
            return;
          }
        }
      }

      // Validación de stock propio de la Bóveda al RETIRAR (= retirar de bóveda a caja)
      if (srv === 'caja' && currentOpType === 'salida') {
        const inventoryBoveda = DB.get('inventoryBoveda', {});
        let errorBoveda = false;
        let errorDetalle = '';
        inputs.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          if (cant > (inventoryBoveda[denom] || 0)) {
            errorBoveda = true;
            errorDetalle = `No hay suficientes billetes/monedas de $${denom} en la bóveda (hay ${inventoryBoveda[denom] || 0}).`;
          }
        });
        if (errorBoveda) {
          mostrarToast(`Bóveda: ${errorDetalle}`, "error");
          return;
        }
      }

      // Validación de saldo de terminal para depósitos de Yastas
      if (srv === 'yastas' && currentOpType === 'ingreso') {
        const balances = DB.get('balances', {});
        const saldoTerminal = balances.yastasTerminal || 0;
        if (totalSum > saldoTerminal) {
          mostrarAlertaError("Saldo Insuficiente en Terminal", `El depósito de <b>${fmt.format(totalSum)}</b> supera el saldo disponible en tu terminal Yastas (disponible: <b>${fmt.format(saldoTerminal)}</b>).<br><br>Por favor, recargue saldo en la terminal antes de continuar.`);
          return;
        }
      }

      const actionText = currentOpType === 'ingreso' ? 'INGRESO' : 'SALIDA';
      document.getElementById('pin-modal-titulo').innerText = `${actionText}: ${srv.toUpperCase()}`;
      
      // Si es un retiro asistido en modo sugerido, el total es el monto del retiro
      const isRetiro = currentOpType === 'salida';
      const isPhysical = (srv === 'yastas' || srv === 'bbva' || srv === 'capital' || srv === 'tconecta' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'tienda'));
      const hasRetiroAsistido = (isRetiro && isPhysical);
      if (hasRetiroAsistido && currentModoRetiro === 'sugerido') {
        const inputRet = document.getElementById('op-retiro-monto');
        totalSum = inputRet ? (parseFloat(inputRet.value) || 0) : 0;
      }

      let descMonto = isManualAmount ? 'Valor Electrónico' : fmt.format(totalSum);
      document.getElementById('pin-modal-desc').innerText = `Se va a autorizar por un monto de ${descMonto}. Ingrese su PIN.`;

      abrirPINModal(`Confirmación de ${actionText}`, (opName) => {
        completarTransaccion(opName, totalSum);
      });
    }

    function completarTransaccion(opName, totalSum) {
      const srv = document.getElementById('op-service').value;
      const isRecarga = (srv === 'yastas' && currentOpType === 'recarga');
      
      let finalAmount = totalSum;
      if (isRecarga) {
        const inputRec = document.getElementById('op-recarga-monto');
        finalAmount = inputRec ? (parseFloat(inputRec.value) || 0) : 0;
      }

      const isIngreso = currentOpType === 'ingreso';
      let multiplier = isIngreso ? 1 : -1;
      if (srv === 'caja') {
        multiplier = isIngreso ? -1 : 1;
      }
      let commissionText = '';
      const isRecargaTerminal = (srv === 'yastas' && currentOpType === 'recarga' && document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
      const isRecargaTConectaTerminal = (srv === 'tconecta' && currentOpType === 'ingreso' && document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
      const isManualAmount = (srv === 'banorte' || srv === 'transferencia' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'negocio') || isRecargaTerminal || isRecargaTConectaTerminal);

      let montoDep = 0;
      if (isRecarga || (srv === 'tconecta' && isIngreso)) {
        const inputRec = document.getElementById('op-recarga-monto');
        montoDep = inputRec ? (parseFloat(inputRec.value) || 0) : 0;
      } else {
        const inputDep = document.getElementById('op-cambio-deposito');
        montoDep = inputDep ? (parseFloat(inputDep.value) || 0) : 0;
      }

      const hasCambio = ((isIngreso || isRecarga) && !isManualAmount && srv !== 'caja' && montoDep > 0 && totalSum > montoDep && currentSugerenciaCambio);
      
      if (hasCambio) {
        finalAmount = montoDep;
      }

      const isRetiro = currentOpType === 'salida';
      const isPhysical = (srv === 'yastas' || srv === 'bbva' || srv === 'capital' || srv === 'tconecta' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'tienda'));
      const hasRetiroAsistido = (isRetiro && isPhysical);
      if (hasRetiroAsistido) {
        const inputRet = document.getElementById('op-retiro-monto');
        const montoRet = inputRet ? parseFloat(inputRet.value) : 0;
        if (montoRet > 0) {
          finalAmount = montoRet;
        }
      }

      const isRedeposito = (srv === 'yastas' && currentOpType === 'redeposito');
      let redepDiff = 0;
      let totalRetiros = 0;
      let totalDeposito = 0;
      if (isRedeposito) {
        totalRetiros = redepositoRetiros.reduce((sum, val) => sum + val, 0);
        const charolaSum = getCharolaFisicaTotalSum();
        totalDeposito = totalRetiros + charolaSum;
        redepDiff = charolaSum;
      }

      if (isManualAmount) {
        const inputVal = (isRecargaTerminal || isRecargaTConectaTerminal) ? document.getElementById('op-recarga-monto') : document.getElementById('op-monto-manual');
        const manualVal = inputVal ? parseFloat(inputVal.value) : 0;
        if (isNaN(manualVal) || manualVal <= 0) {
          mostrarToast("Ingrese un monto válido.", "error");
          return;
        }
        if (srv === 'banorte' && isIngreso) {
          const metodo = document.getElementById('op-metodo-banorte-val').value;
          if (metodo === 'terminal') {
            const com = manualVal * 0.0232;
            finalAmount = manualVal - com;
            commissionText = `Tarjeta. Bruto: ${fmt.format(manualVal)}, Com (2.32%): ${fmt.format(com)}, Neto: ${fmt.format(finalAmount)}`;
          } else {
            finalAmount = manualVal;
            commissionText = `Transferencia. Neto: ${fmt.format(finalAmount)}`;
          }
        } else {
          finalAmount = manualVal;
        }
      }

      const balances = DB.get('balances', {});
      const inventory = DB.get('inventory', {});
      const inventoryBoveda = DB.get('inventoryBoveda', {});

      // 1. Modificar inventarios físicos
      if (srv === 'cambio') {
        const leftInputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        leftInputs.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          inventory[denom] = (inventory[denom] || 0) + cant;
        });

        const idsMap = {
          'cambio-out-1000': 1000,
          'cambio-out-500': 500,
          'cambio-out-200': 200,
          'cambio-out-100': 100,
          'cambio-out-50': 50,
          'cambio-out-20': 20,
          'cambio-out-m10': 10,
          'cambio-out-m5': 5,
          'cambio-out-m2': 2,
          'cambio-out-m1': 1,
          'cambio-out-m05': 0.5
        };
        Object.keys(idsMap).forEach(id => {
          const denom = idsMap[id];
          const cantOut = parseInt(document.getElementById(id).value) || 0;
          inventory[denom] = (inventory[denom] || 0) - cantOut;
        });
        DB.set('inventory', inventory);
      } else if (!isManualAmount && srv !== 'caja') {
        // Charola principal (para todas las ops de efectivo excepto bóveda)
        const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputs.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          
          let addPieces = isIngreso;
          if (isRedeposito) {
            addPieces = (redepDiff > 0);
          }
          if (isRecarga) {
            addPieces = true; // Recarga en efectivo: entran piezas a caja
          }
          
          if (addPieces) {
            inventory[denom] = (inventory[denom] || 0) + cant;
          } else {
            inventory[denom] = (inventory[denom] || 0) - cant;
          }
        });

        // Descontar el cambio entregado al cliente si aplica
        if (hasCambio && currentSugerenciaCambio) {
          Object.keys(currentSugerenciaCambio).forEach(denomStr => {
            const denom = parseFloat(denomStr);
            const cantOut = currentSugerenciaCambio[denomStr] || 0;
            inventory[denom] = (inventory[denom] || 0) - cantOut;
          });
        }

        // Descontar piezas del retiro sugerido (Auto)
        if (hasRetiroAsistido && currentModoRetiro === 'sugerido' && currentSugerenciaRetiro) {
          Object.keys(currentSugerenciaRetiro).forEach(denomStr => {
            const denom = parseFloat(denomStr);
            const cantOut = currentSugerenciaRetiro[denomStr] || 0;
            inventory[denom] = (inventory[denom] || 0) - cantOut;
          });
        }

        DB.set('inventory', inventory);
      }

      // Lógica especial para Bóveda (Caja Fuerte): usa inventario propio
      if (srv === 'caja') {
        const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputs.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          if (isIngreso) {
            // Ingreso a Bóveda (Depósito) → piezas salen de charola, entran a bóveda
            inventory[denom] = (inventory[denom] || 0) - cant;
            inventoryBoveda[denom] = (inventoryBoveda[denom] || 0) + cant;
          } else {
            // Salida de Bóveda (Retiro) → piezas salen de bóveda, entran a charola
            inventoryBoveda[denom] = (inventoryBoveda[denom] || 0) - cant;
            inventory[denom] = (inventory[denom] || 0) + cant;
          }
        });
        DB.set('inventory', inventory);
        DB.set('inventoryBoveda', inventoryBoveda);
        // Recalcular saldo bóveda
        let bovedaTotal = 0;
        Object.keys(inventoryBoveda).forEach(d => { bovedaTotal += parseFloat(d) * (inventoryBoveda[d] || 0); });
        balances.boveda = bovedaTotal;

        // Vínculo digital con Yastas Efectivo (Caja)
        if (!isIngreso) {
          // Salida de caja a bóveda: el efectivo en caja disminuye
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) - finalAmount;
        } else {
          // Ingreso de bóveda a caja: el efectivo en caja aumenta
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) + finalAmount;
        }
      }

      // 2. Modificar saldos digitales
      if (srv === 'yastas') {
        if (isRedeposito) {
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) + redepDiff;
          balances.yastasTerminal = (balances.yastasTerminal || 0) - redepDiff;
        } else if (isRecarga) {
          const recargaMetodo = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
          if (recargaMetodo === 'efectivo') {
            balances.yastasEfectivo = (balances.yastasEfectivo || 0) + finalAmount;
            balances.yastasTerminal = (balances.yastasTerminal || 0) - finalAmount;
          } else {
            // Pago a Terminal: sube saldo terminal (+finalAmount), pero baja por la recarga (-finalAmount).
            // Efecto neto digital es 0; efectivo físico no cambia.
            balances.yastasTerminal = (balances.yastasTerminal || 0) + finalAmount - finalAmount;
          }
        } else {
          // Depósito del cliente (Ingreso): entra efectivo a caja (+efectivo), terminal entrega valor digital (-terminal)
          // Retiro del cliente (Salida): sale efectivo de caja (-efectivo), terminal recibe valor digital (+terminal)
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) + (finalAmount * multiplier);
          balances.yastasTerminal = (balances.yastasTerminal || 0) - (finalAmount * multiplier); // movimiento inverso
        }
      }
      if (srv === 'banorte') balances.banorte = (balances.banorte || 0) + (finalAmount * multiplier);
      if (srv === 'meli') {
        const meliModo = document.getElementById('op-modo-meli-val').value;
        if (meliModo === 'tienda') { // Tienda Express (Efectivo)
          if (isIngreso) {
            balances.meli = (balances.meli || 0) - finalAmount;
            balances.yastasEfectivo = (balances.yastasEfectivo || 0) + finalAmount;
          } else {
            balances.meli = (balances.meli || 0) + finalAmount;
            balances.yastasEfectivo = (balances.yastasEfectivo || 0) - finalAmount;
          }
        } else { // Venta Negocio (Terminal Manual)
          balances.meli = (balances.meli || 0) + (finalAmount * multiplier);
        }
      }
      if (srv === 'tconecta') {
        const isRecargaTConectaTerminal = (currentOpType === 'ingreso' && document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
        
        if (isIngreso) {
          if (!isRecargaTConectaTerminal) {
            // Recarga en Efectivo: Se descuenta de la terminal T-Conecta y el dinero entra a la caja de Yastas
            balances.tconectaTerminal = (balances.tconectaTerminal || 0) - finalAmount;
            balances.yastasEfectivo = (balances.yastasEfectivo || 0) + finalAmount;
          } else {
            // Recarga con Tarjeta (Terminal): Operación INFORMATIVA. No genera movimiento directo en saldos de caja, terminal ni Banamex.
          }
        } else {
          // Retiro de Efectivo (con Tarjeta): Terminal T-Conecta se queda igual. Disminuye caja de Yastas por el efectivo entregado e incrementa Banamex por el cobro con tarjeta.
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) - finalAmount;
          balances.banamex = (balances.banamex || 0) + finalAmount;
        }
      }
      
      // Transferencia: va al saldo terminal de Yastas (electrónico, no charola)
      if (srv === 'transferencia') {
        balances.transferencia = (balances.transferencia || 0) + (finalAmount * multiplier);
        balances.yastasTerminal = (balances.yastasTerminal || 0) + (finalAmount * multiplier);
      }

      if (srv === 'bbva') {
        balances.bbva = (balances.bbva || 0) + finalAmount; // Aumenta el acumulado depositado a BBVA hoy
        balances.yastasTerminal = (balances.yastasTerminal || 0) + finalAmount; // Se recupera saldo digital en Yastas Terminal
        balances.yastasEfectivo = (balances.yastasEfectivo || 0) - finalAmount; // Disminuye el efectivo físico de la caja
      }

      // Capital / Fondo: efectivo físico afecta balance de capital
      if (srv === 'capital') {
        if (typeof balances.capital === 'undefined') balances.capital = 0;
        balances.capital += (finalAmount * multiplier);
        // Como es retiro físico, disminuye también el efectivo en caja y el capital en efectivo
        balances.capitalEfectivo = (balances.capitalEfectivo || 0) + (finalAmount * multiplier);
        balances.yastasEfectivo = (balances.yastasEfectivo || 0) + (finalAmount * multiplier);
      }

      DB.set('balances', balances);

      // 3. Escribir en la bitácora con desglose de piezas
      let piecesObj = null;
      if (srv === 'cambio') {
        piecesObj = {};
        const inputsLeft = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputsLeft.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          if (cant > 0) {
            piecesObj[denom] = (piecesObj[denom] || 0) + cant;
          }
        });

        const idsMap = {
          'cambio-out-1000': 1000,
          'cambio-out-500': 500,
          'cambio-out-200': 200,
          'cambio-out-100': 100,
          'cambio-out-50': 50,
          'cambio-out-20': 20,
          'cambio-out-m10': 10,
          'cambio-out-m5': 5,
          'cambio-out-m2': 2,
          'cambio-out-m1': 1,
          'cambio-out-m05': 0.5
        };
        Object.keys(idsMap).forEach(id => {
          const denom = idsMap[id];
          const cantOut = parseInt(document.getElementById(id).value) || 0;
          if (cantOut > 0) {
            piecesObj[denom] = (piecesObj[denom] || 0) - cantOut;
          }
        });
        
        let allZero = true;
        Object.keys(piecesObj).forEach(k => {
          if (piecesObj[k] !== 0) allZero = false;
        });
        if (allZero) piecesObj = null;
      } else if (isRedeposito) {
        piecesObj = {};
        const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputs.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          if (cant > 0) {
            if (redepDiff > 0) {
              piecesObj[denom] = cant;
            } else if (redepDiff < 0) {
              piecesObj[denom] = -cant;
            }
          }
        });
        if (Object.keys(piecesObj).length === 0) {
          piecesObj = null;
        }
      } else if (!isManualAmount) {
        piecesObj = {};

        // Si es retiro sugerido, usar las piezas del algoritmo
        if (hasRetiroAsistido && currentModoRetiro === 'sugerido' && currentSugerenciaRetiro) {
          Object.keys(currentSugerenciaRetiro).forEach(denomStr => {
            const denom = parseFloat(denomStr);
            const cant = currentSugerenciaRetiro[denomStr] || 0;
            if (cant > 0) {
              piecesObj[denom] = -cant; // Negativo: salen de caja
            }
          });
        } else {
          // Captura normal (charola manual)
          const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
          inputs.forEach(inp => {
            const denom = parseFloat(inp.getAttribute('data-denom'));
            let cant = parseInt(inp.value) || 0;

            if (hasCambio && currentSugerenciaCambio && currentSugerenciaCambio[denom]) {
              cant -= currentSugerenciaCambio[denom];
            }

            if (cant !== 0) {
              piecesObj[denom] = cant;
            }
          });
        }

        if (Object.keys(piecesObj).length === 0) {
          piecesObj = null;
        }
      }

      let detText = '';
      if (srv === 'banorte') {
        if (isIngreso) {
          detText = commissionText;
        } else {
          const motivo = document.getElementById('op-motivo-capital').value.trim();
          detText = `Retiro. Motivo: ${motivo}. Monto: ${fmt.format(finalAmount)}`;
        }
      } else if (srv === 'transferencia') {
        const concepto = document.getElementById('op-concepto-transferencia').value.trim();
        detText = `Concepto: ${concepto}. Monto: ${fmt.format(finalAmount)}`;
      } else if (srv === 'capital') {
        const motivo = document.getElementById('op-motivo-capital').value.trim();
        detText = `Motivo: ${motivo}. Monto: ${fmt.format(finalAmount)}`;
      } else if (srv === 'caja') {
        const ubicacion = document.getElementById('op-ubicacion-boveda').value.trim();
        if (isIngreso) {
          detText = `Enviado de Caja a Bóveda. Destino: ${ubicacion}. Monto: ${fmt.format(finalAmount)}`;
        } else {
          detText = `Retirado de Bóveda a Caja. Origen: ${ubicacion}. Monto: ${fmt.format(finalAmount)}`;
        }
      } else if (srv === 'meli') {
        const meliModo = document.getElementById('op-modo-meli-val').value;
        if (meliModo === 'tienda') {
          detText = `Tienda Express. Monto: ${fmt.format(finalAmount)}`;
        } else {
          detText = `Venta Negocio (Terminal). Monto: ${fmt.format(finalAmount)}`;
        }
      } else if (srv === 'cambio') {
        let inParts = [];
        let outParts = [];
        
        const inputsLeft = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputsLeft.forEach(inp => {
          const denom = parseFloat(inp.getAttribute('data-denom'));
          const cant = parseInt(inp.value) || 0;
          if (cant > 0) {
            inParts.push(`${cant}x${denom === 0.5 ? '50¢' : '$' + denom}`);
          }
        });

        const idsMap = {
          'cambio-out-1000': 1000,
          'cambio-out-500': 500,
          'cambio-out-200': 200,
          'cambio-out-100': 100,
          'cambio-out-50': 50,
          'cambio-out-20': 20,
          'cambio-out-m10': 10,
          'cambio-out-m5': 5,
          'cambio-out-m2': 2,
          'cambio-out-m1': 1,
          'cambio-out-m05': 0.5
        };
        Object.keys(idsMap).forEach(id => {
          const denom = idsMap[id];
          const cantOut = parseInt(document.getElementById(id).value) || 0;
          if (cantOut > 0) {
            outParts.push(`${cantOut}x${denom === 0.5 ? '50¢' : '$' + denom}`);
          }
        });
        
        detText = `Cambio de efectivo. Recibido: ${inParts.join(', ')} | Entregado: ${outParts.join(', ')}`;
      } else if (hasCambio && currentSugerenciaCambio) {
        let changeTextParts = [];
        Object.keys(currentSugerenciaCambio).forEach(d => {
          const cant = currentSugerenciaCambio[d] || 0;
          if (cant > 0) {
            const label = parseFloat(d) === 0.5 ? '50¢' : '$' + d;
            changeTextParts.push(`${cant}x${label}`);
          }
        });
        const opLabelText = isRecarga ? 'Recarga' : 'Depósito';
        const partsFormatted = changeTextParts.length > 0 ? ` (${changeTextParts.join(', ')})` : '';
        detText = `${opLabelText} de ${fmt.format(finalAmount)}. Recibido: ${fmt.format(totalSum)}. Cambio: ${fmt.format(totalSum - finalAmount)}${partsFormatted}.`;
      } else if (isRecarga) {
        const recargaMetodo = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
        const metodoLabel = recargaMetodo === 'efectivo' ? 'Efectivo' : 'Pago a Terminal';
        detText = `Recarga Telefónica. Método: ${metodoLabel}. Monto: ${fmt.format(finalAmount)}`;
      } else {
        detText = `Monto de operación: ${fmt.format(finalAmount)}`;
      }
      
      if (srv === 'tconecta') {
        if (currentOpType === 'ingreso') {
          const isRecargaTConectaTerminal = (document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
          if (isRecargaTConectaTerminal) {
            detText = `Recarga T-Conecta con Tarjeta. Monto: ${fmt.format(finalAmount)}. Destino: Cuenta Banamex`;
          } else {
            detText = `Recarga T-Conecta en Efectivo. Monto: ${fmt.format(finalAmount)}`;
          }
        } else if (currentOpType === 'salida') {
          detText = `Retiro T-Conecta con Tarjeta. Monto: ${fmt.format(finalAmount)}. Destino: Cuenta Banamex`;
        }
      }
      
      const recargaMetodo = document.getElementById('op-metodo-recarga-val') ? document.getElementById('op-metodo-recarga-val').value : 'efectivo';
      let logAmount = srv === 'cambio' ? 0 : (isRecarga ? (recargaMetodo === 'efectivo' ? finalAmount : 0) : finalAmount * multiplier);
      let logCategory = srv === 'cambio' ? 'Cambio' : (isRecarga ? 'YASTAS_RECARGA' : srv.toUpperCase());
      
      if (srv === 'tconecta') {
        if (currentOpType === 'ingreso') {
          const isRecargaTConectaTerminal = (document.getElementById('op-metodo-recarga-val') && document.getElementById('op-metodo-recarga-val').value === 'terminal');
          logCategory = isRecargaTConectaTerminal ? 'TCONECTA_RECARGA_TARJETA' : 'TCONECTA_RECARGA_EFECTIVO';
        } else {
          logCategory = 'TCONECTA_RETIRO';
        }
      }

      if (srv === 'capital') {
        logCategory = 'CAPITAL_RETIRO';
      }
      
      let opText = currentOpType.toUpperCase();
      if (srv === 'yastas') {
        opText = currentOpType === 'ingreso' ? 'DEPÓSITO' : (currentOpType === 'recarga' ? 'RECARGA' : 'RETIRO');
      } else if (srv === 'tconecta') {
        opText = currentOpType === 'ingreso' ? 'RECARGA' : 'RETIRO';
      } else if (srv === 'capital') {
        opText = 'RETIRO';
      }
      let logDetails = srv === 'cambio' ? detText : `Op: ${opText}. ${detText}`;

      let redepExtraData = null;
      if (isRedeposito) {
        logAmount = redepDiff;
        logCategory = "RE-DEPÓSITO";
        
        const retirosStr = redepositoRetiros.map(r => fmt.format(r)).join(' + ');
        logDetails = `Operación Combinada Yastas. Retiros virtuales: ${retirosStr} (Total Retiros: ${fmt.format(totalRetiros)}) | Depósito total: ${fmt.format(totalDeposito)} | Neto en charola: ${redepDiff >= 0 ? '+' : '-'}${fmt.format(Math.abs(redepDiff))}`;
        
        redepExtraData = {
          retiros: [...redepositoRetiros],
          deposito: totalDeposito
        };
        
        // Resetear estado de redeposito
        redepositoRetiros = [];
        renderListaRetiros();
        calcularDiferenciaRedeposito();
      }
      
      registrarMovimientoBitacora(opName, logCategory, logAmount, logDetails, piecesObj, redepExtraData);

      mostrarToast("Transacción registrada y autorizada con éxito.", "success");
      cargarSaldosDigitales();
      cargarBitacora();
      limpiarDesglose();
    }

    // === EDICIÓN MANUAL DE MONTOS (Siempre activo para Meli y Banorte, incluso con turno cerrado) ===
    function solicitarEdicionMonto(account) {
      if (account !== 'meli' && account !== 'banorte') {
        mostrarToast("Solo se permite editar los valores de Meli y Banorte.", "error");
        return;
      }
      const balances = DB.get('balances', {});
      const actualVal = balances[account] || 0;

      window.edicionBaseMonto = actualVal;

      document.getElementById('edicion-cuenta-nombre').value = account;
      document.getElementById('edicion-monto-input').value = actualVal;
      document.getElementById('edicion-modal-desc').innerText = `Ajuste manual del saldo de ${account.toUpperCase()}. Valor actual: ${fmt.format(actualVal)}.`;
      
      const meliBaseContainer = document.getElementById('edicion-meli-base-container');
      if (meliBaseContainer) {
        if (account === 'meli') {
          meliBaseContainer.classList.remove('hidden');
          document.getElementById('edicion-meli-base-input').value = balances.meliBase || 0;
        } else {
          meliBaseContainer.classList.add('hidden');
        }
      }

      const transferContainer = document.getElementById('edicion-transfer-container');
      const transferInput = document.getElementById('edicion-transfer-input');
      if (transferContainer && transferInput) {
        transferInput.value = '';
        if (account === 'meli') {
          transferContainer.classList.remove('hidden');
        } else {
          transferContainer.classList.add('hidden');
        }
      }
      
      document.getElementById('modal-edicion').classList.remove('hidden');
    }

    function cerrarModalEdicion() {
      document.getElementById('modal-edicion').classList.add('hidden');
    }

    function actualizarMontoDesdeTransferencia() {
      const base = window.edicionBaseMonto || 0;
      const transferInput = document.getElementById('edicion-transfer-input');
      const transferVal = parseFloat(transferInput.value) || 0;
      document.getElementById('edicion-monto-input').value = (base + transferVal).toFixed(2);
    }

    function guardarEdicionMonto() {
      const account = document.getElementById('edicion-cuenta-nombre').value;
      const newVal = parseFloat(document.getElementById('edicion-monto-input').value);

      if (isNaN(newVal) || newVal < 0) {
        mostrarToast("Ingrese un monto numérico válido.", "error");
        return;
      }

      let newBaseVal = 0;
      if (account === 'meli') {
        newBaseVal = parseFloat(document.getElementById('edicion-meli-base-input').value);
        if (isNaN(newBaseVal) || newBaseVal < 0) {
          mostrarToast("Ingrese un monto base de referencia válido.", "error");
          return;
        }
      }

      cerrarModalEdicion();

      abrirPINModal(`Ajuste de Saldo: ${account.toUpperCase()}`, (opName) => {
        const balances = DB.get('balances', {});
        const oldVal = balances[account] || 0;
        balances[account] = newVal;
        if (account === 'meli') {
          balances.meliBase = newBaseVal;
        }
        DB.set('balances', balances);

        const transferVal = (account === 'meli') ? (parseFloat(document.getElementById('edicion-transfer-input').value) || 0) : 0;
        
        let category = `AJUSTE_${account.toUpperCase()}`;
        let detMsg = `Ajuste manual. Anterior: ${fmt.format(oldVal)} -> Nuevo: ${fmt.format(newVal)}`;
        
        if (account === 'meli') {
          if (transferVal > 0) {
            category = `FONDEO_${account.toUpperCase()}`;
            detMsg = `Reposición por transferencia. Monto transferido: ${fmt.format(transferVal)} | Saldo anterior: ${fmt.format(oldVal)} -> Nuevo: ${fmt.format(newVal)}`;
          }
          detMsg += ` | Base: ${fmt.format(newBaseVal)}`;
        }

        registrarMovimientoBitacora(opName, category, newVal - oldVal, detMsg);

        mostrarToast("Saldo modificado con éxito.", "success");
        cargarSaldosDigitales();
        cargarBitacora();
      });
    }

    // === BORRADO / REINICIO DE MONTOS (Siempre activo para Meli y Banorte, incluso con turno cerrado) ===
    function solicitarBorradoMonto(account) {
      if (account !== 'meli' && account !== 'banorte') {
        mostrarToast("Operación inválida.", "error");
        return;
      }
      const balances = DB.get('balances', {});
      const actualVal = balances[account] || 0;

      abrirPINModal(`Borrar Saldo: ${account.toUpperCase()}`, (opName) => {
        const balances = DB.get('balances', {});
        const oldVal = balances[account] || 0;
        balances[account] = 0;
        DB.set('balances', balances);

        registrarMovimientoBitacora(opName, `BORRADO_${account.toUpperCase()}`, -oldVal, `Saldo borrado a $0.00. Anterior: ${fmt.format(oldVal)}`);
        mostrarToast(`Saldo de ${account.toUpperCase()} restablecido a $0.00.`, "info");
        cargarSaldosDigitales();
      });
    }

    // === RETIROS BBVA DEL DÍA ===
    function abrirRetirosBBVA() {
      const modal = document.getElementById('modal-retiros-bbva');
      const lista = document.getElementById('bbva-retiros-lista');
      const vacio = document.getElementById('bbva-retiros-vacio');
      const totalEl = document.getElementById('bbva-retiros-total');
      if (!modal || !lista) return;

      // Obtener fecha de hoy
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      // Filtrar logs de la sesión activa que sean de BBVA (salidas/retiros)
      const sessionLogs = DB.get('logs', []) || [];
      const bbvaLogs = sessionLogs.filter(log => {
        if (!log || !log.category) return false;
        const cat = log.category.toUpperCase();
        return cat === 'BBVA' && (log.amount || 0) < 0;
      });

      lista.innerHTML = '';

      if (bbvaLogs.length === 0) {
        lista.classList.add('hidden');
        vacio.classList.remove('hidden');
        totalEl.textContent = '$0.00';
      } else {
        lista.classList.remove('hidden');
        vacio.classList.add('hidden');

        let totalRetirado = 0;

        bbvaLogs.forEach(log => {
          const monto = log.amount || 0;
          totalRetirado += monto; // monto ya es negativo

          // Formatear hora
          const timePart = log.time && typeof log.time === 'string' ? log.time.split(' ')[0] : '--:--';

          const row = document.createElement('div');
          row.className = 'flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 gap-3 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition duration-150';
          row.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center flex-shrink-0">
                <i data-lucide="arrow-up-right" class="w-4 h-4 text-rose-600 dark:text-rose-400"></i>
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">${log.details || 'Retiro BBVA'}</p>
                <p class="text-[10px] text-slate-400 font-mono">${timePart} &nbsp;·&nbsp; ${log.operator || 'Sistema'}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-sm font-black text-rose-600">${fmt.format(Math.abs(monto))}</span>
              <button onclick="solicitarBorradoRetiroBBVA(${log.id}, '${(log.details || 'Retiro BBVA').replace(/'/g, "\\'")}', ${Math.abs(monto)})"
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 transition" title="Borrar este retiro">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `;
          lista.appendChild(row);
        });

        totalEl.textContent = fmt.format(Math.abs(totalRetirado));
      }

      modal.classList.remove('hidden');
      lucide.createIcons();
    }

    function cerrarRetirosBBVA() {
      const modal = document.getElementById('modal-retiros-bbva');
      if (modal) modal.classList.add('hidden');
    }

    function solicitarBorradoRetiroBBVA(logId, descripcion, monto) {
      const desc = document.getElementById('bbva-borrar-desc');
      const idInput = document.getElementById('bbva-borrar-log-id');
      if (!desc || !idInput) return;

      desc.textContent = `¿Deseas borrar el retiro "${descripcion}" por ${fmt.format(monto)}? Esta acción requiere autorización y no se puede deshacer.`;
      idInput.value = logId;

      document.getElementById('modal-confirmar-borrar-bbva').classList.remove('hidden');
    }

    function cerrarConfirmarBorrarBBVA() {
      document.getElementById('modal-confirmar-borrar-bbva').classList.add('hidden');
    }

    function ejecutarBorradoRetiroBBVA() {
      const logId = parseInt(document.getElementById('bbva-borrar-log-id').value);

      // 1. Cerrar confirmación
      cerrarConfirmarBorrarBBVA();
      // 2. Cerrar también el modal de retiros para que el PIN quede al frente
      cerrarRetirosBBVA();

      abrirPINModal('Autorizar Borrado de Retiro BBVA', (opName) => {
        // Obtener fecha de hoy
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

        // Buscar el log completo (necesitamos el campo pieces para revertir piezas físicas)
        const historical = DB.get('historical_logs_by_date', {}) || {};
        let montoRecuperado = 0;
        let piezasRecuperadas = null;
        let encontrado = false;

        if (Array.isArray(historical[todayStr])) {
          const idx = historical[todayStr].findIndex(l => l && l.id === logId);
          if (idx !== -1) {
            const logEntry = historical[todayStr][idx];
            montoRecuperado = logEntry.amount || 0;
            piezasRecuperadas = logEntry.pieces || null;
            historical[todayStr].splice(idx, 1);
            encontrado = true;
          }
        }

        if (!encontrado) {
          mostrarToast('No se encontró el registro. Puede que ya fue borrado.', 'warning');
          abrirRetirosBBVA(); // Reabrir el modal aunque no se encontró
          return;
        }

        DB.set('historical_logs_by_date', historical);

        // También eliminar del log de sesión activa
        const logs = DB.get('logs', []);
        const filteredLogs = logs.filter(l => l && l.id !== logId);
        DB.set('logs', filteredLogs);

        // ✅ Revertir piezas físicas al inventario de la caja
        if (piezasRecuperadas && typeof piezasRecuperadas === 'object') {
          const inventory = DB.get('inventory', {});
          Object.keys(piezasRecuperadas).forEach(denom => {
            const cantidad = piezasRecuperadas[denom];
            if (cantidad && cantidad !== 0) {
              inventory[denom] = (inventory[denom] || 0) + Math.abs(cantidad);
            }
          });
          DB.set('inventory', inventory);
        }

        // Revertir el saldo de BBVA, Yastas Terminal y Yastas Efectivo
        const balances = DB.get('balances', {});
        balances['bbva'] = (balances['bbva'] || 0) - Math.abs(montoRecuperado); // Resta del saldo acumulado de BBVA
        balances['yastasTerminal'] = (balances['yastasTerminal'] || 0) - Math.abs(montoRecuperado); // Resta del saldo recuperado de Yastas
        balances['yastasEfectivo'] = (balances['yastasEfectivo'] || 0) + Math.abs(montoRecuperado); // Devuelve el efectivo a la caja
        DB.set('balances', balances);

        // Registrar en bitácora
        const piezasStr = piezasRecuperadas
          ? Object.keys(piezasRecuperadas).map(d => `${piezasRecuperadas[d]}x$${d}`).join(', ')
          : 'sin desglose';
        registrarMovimientoBitacora(opName, 'BORRADO_BBVA', -montoRecuperado,
          `Retiro BBVA eliminado. Monto revertido: ${fmt.format(Math.abs(montoRecuperado))}. Piezas devueltas a caja: ${piezasStr}`);

        mostrarToast('Retiro BBVA eliminado. Piezas y saldo devueltos a caja.', 'success');
        cargarSaldosDigitales();

        // 3. Reabrir el modal de retiros con la lista actualizada
        abrirRetirosBBVA();
      });
    }


    // === ANEXAR CAPITAL ===
    let modoAnexarCapital = 'terminal'; // 'terminal' | 'efectivo'

    function abrirAnexarCapital() {
      // Reset
      modoAnexarCapital = 'terminal';
      const inputTerminal = document.getElementById('cap-monto-terminal');
      if (inputTerminal) inputTerminal.value = '';

      // Limpiar la charola principal de la izquierda
      const inputsLeft = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputsLeft.forEach(inp => { inp.value = ''; });
      calcularTotalLocal(); // Recalcular subtotales de la charola

      calcularTotalAnexarCapital();
      setModoAnexarCapital('terminal');
    }

    function cerrarAnexarCapital() {
      // El formulario ahora es inline, no modal
    }

    function construirGridsAnexarCapital() {
      // Eliminado por uso de charola global
    }

    function setModoAnexarCapital(modo) {
      modoAnexarCapital = modo;
      const btnT = document.getElementById('btn-cap-main-terminal');
      const btnE = document.getElementById('btn-cap-main-efectivo');
      const panelT = document.getElementById('cap-main-panel-terminal');
      
      const fisicaSeccion = document.getElementById('dash-charola-physica-seccion') || document.getElementById('dash-charola-fisica-seccion');
      const placeholderSeccion = document.getElementById('dash-charola-placeholder');
      const limpiarBtn = document.getElementById('dash-charola-limpiar-btn');

      if (!btnT || !btnE || !panelT) return;

      if (modo === 'terminal') {
        btnT.className = 'flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-teal-500 text-teal-600 bg-teal-50 transition';
        btnE.className = 'flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-transparent text-slate-400 bg-slate-50 hover:bg-slate-100 transition';
        panelT.classList.remove('hidden');

        // Mostrar charola desactivada (opaca)
        if (fisicaSeccion) {
          fisicaSeccion.classList.remove('hidden');
          fisicaSeccion.classList.add('opacity-40', 'pointer-events-none');
        }
        if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
        if (limpiarBtn) limpiarBtn.classList.add('hidden');
      } else {
        btnE.className = 'flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-teal-500 text-teal-600 bg-teal-50 transition';
        btnT.className = 'flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-transparent text-slate-400 bg-slate-50 hover:bg-slate-100 transition';
        panelT.classList.add('hidden');

        // Mostrar charola activa
        if (fisicaSeccion) {
          fisicaSeccion.classList.remove('hidden', 'opacity-40', 'pointer-events-none');
        }
        if (placeholderSeccion) placeholderSeccion.classList.add('hidden');
        if (limpiarBtn) limpiarBtn.classList.remove('hidden');

        toggleCharolaInputs(false); // Asegurar que no esté bloqueada
      }
      calcularTotalAnexarCapital();
    }

    function calcularTotalAnexarCapital() {
      const totalEl = document.getElementById('cap-total-display');
      let total = 0;

      if (modoAnexarCapital === 'terminal') {
        const inputTerminal = document.getElementById('cap-monto-terminal');
        total = inputTerminal ? (parseFloat(inputTerminal.value) || 0) : 0;
      } else {
        total = getCharolaFisicaTotalSum();
      }

      if (totalEl) totalEl.textContent = fmt.format(total);
      return total;
    }

    function procesarAnexarCapital() {
      const total = calcularTotalAnexarCapital();
      if (total <= 0) {
        mostrarToast('Ingresa un monto o piezas para anexar.', 'error');
        return;
      }

      const motivoInput = document.getElementById('cap-motivo');
      const motivo = motivoInput ? motivoInput.value.trim() : '';
      const motivoStr = motivo ? `Motivo: ${motivo}` : 'Sin motivo especificado';

      const modoLabel = modoAnexarCapital === 'terminal' ? 'Terminal Yastas' : 'Efectivo';

      abrirPINModal(`Autorizar Anexo de Capital — ${modoLabel}`, (opName) => {
        const balances = DB.get('balances', {});

        if (modoAnexarCapital === 'terminal') {
          // Suma al saldo Terminal de Yastas
          balances.yastasTerminal = (balances.yastasTerminal || 0) + total;
          balances.capitalTerminal = (balances.capitalTerminal || 0) + total;
          balances.capital = (balances.capitalTerminal || 0) + (balances.capitalEfectivo || 0);
          DB.set('balances', balances);

          registrarMovimientoBitacora(opName, 'CAPITAL_TERMINAL', total,
            `Anexo de capital a Terminal Yastas: ${fmt.format(total)}. ${motivoStr}`);

        } else {
          // Suma al saldo Efectivo de Yastas + actualiza inventario físico por denominación
          const inventory = DB.get('inventory', {});
          const piezasObj = {};

          // Leer las piezas directamente de la charola global de la izquierda
          const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
          inputs.forEach(inp => {
            const denom = parseFloat(inp.getAttribute('data-denom'));
            const cant = parseInt(inp.value) || 0;
            if (cant > 0) {
              inventory[denom] = (inventory[denom] || 0) + cant;
              piezasObj[denom] = cant;
            }
          });

          DB.set('inventory', inventory);

          balances.yastasEfectivo = (balances.yastasEfectivo || 0) + total;
          balances.capitalEfectivo = (balances.capitalEfectivo || 0) + total;
          balances.capital = (balances.capitalTerminal || 0) + (balances.capitalEfectivo || 0);
          DB.set('balances', balances);

          const piezasStr = Object.keys(piezasObj).map(d => `${piezasObj[d]}x$${d}`).join(', ');
          registrarMovimientoBitacora(opName, 'CAPITAL_EFECTIVO', total,
            `Anexo de capital en Efectivo Yastas: ${fmt.format(total)}. Piezas: ${piezasStr}. ${motivoStr}`, piezasObj);
        }

        mostrarToast(`Capital anexado: ${fmt.format(total)} → ${modoLabel}`, 'success');
        cargarSaldosDigitales();

        // Limpiar inputs
        const inputTerminal = document.getElementById('cap-monto-terminal');
        if (inputTerminal) inputTerminal.value = '';
        
        // Limpiar la charola principal de la izquierda
        const inputsLeft = document.querySelectorAll('.denom-input-field[id^="dash-"]');
        inputsLeft.forEach(inp => { inp.value = ''; });
        calcularTotalLocal(); // Recalcular subtotales de la charola

        if (motivoInput) motivoInput.value = '';
        calcularTotalAnexarCapital();

        // Recargar lista de anexos
        cargarAnexosCapitalDia();
      });
    }


    function abrirMovimientosCapital() {
      const modal = document.getElementById('modal-movimientos-capital');
      const container = document.getElementById('capital-movs-lista-modal');
      const vacio = document.getElementById('capital-movs-vacio-modal');
      const totalDisplay = document.getElementById('capital-movs-total-modal');
      if (!modal || !container) return;

      const sessionLogs = DB.get('logs', []) || [];

      // Filtrar los que pertenecen a CAPITAL_TERMINAL, CAPITAL_EFECTIVO o CAPITAL_RETIRO
      const capitalLogs = sessionLogs.filter(log => log && (log.category === 'CAPITAL_TERMINAL' || log.category === 'CAPITAL_EFECTIVO' || log.category === 'CAPITAL_RETIRO'));

      container.innerHTML = '';
      let sumTotal = 0;

      if (capitalLogs.length === 0) {
        container.classList.add('hidden');
        if (vacio) vacio.classList.remove('hidden');
        if (totalDisplay) totalDisplay.innerText = fmt.format(0);
      } else {
        container.classList.remove('hidden');
        if (vacio) vacio.classList.add('hidden');

        capitalLogs.forEach(log => {
          const time = log.id ? new Date(log.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
          const op = log.operator || 'Operador';
          sumTotal += log.amount || 0;

          // Extraer motivo si viene en la descripción o detalles
          let desc = log.details || log.description || '';
          let motivo = '';
          if (desc.includes('Motivo: ')) {
            motivo = desc.split('Motivo: ')[1];
          }

          const isRet = log.category === 'CAPITAL_RETIRO';
          const labelText = log.category === 'CAPITAL_TERMINAL' ? '📱 Terminal' : (isRet ? '🔻 Retiro' : '💵 Efectivo');

          const div = document.createElement('div');
          div.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between shadow-sm gap-3 hover:border-teal-300 transition duration-150';
          div.innerHTML = `
            <div class="flex-grow min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-wide">
                  ${labelText}
                </span>
                <span class="text-[8px] text-slate-400 font-semibold">${time} · ${op}</span>
              </div>
              <p class="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate ${motivo ? '' : 'italic'}">
                ${motivo ? motivo : 'Sin motivo especificado'}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-black ${log.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-700 dark:text-teal-400'}">${fmt.format(log.amount || 0)}</span>
              <button onclick="solicitarBorradoCapital(${log.id}, '${esc(motivo || 'Movimiento')}', ${log.amount})" 
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 hover:scale-105 active:scale-95 transition"
                title="Borrar movimiento">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `;
          container.appendChild(div);
        });

        if (totalDisplay) totalDisplay.innerText = fmt.format(sumTotal);
      }

      modal.classList.remove('hidden');
      lucide.createIcons();
    }

    function cerrarMovimientosCapital() {
      const modal = document.getElementById('modal-movimientos-capital');
      if (modal) modal.classList.add('hidden');
    }

    function cargarAnexosCapitalDia() {
      // Los movimientos de capital se manejan en el modal de historial
    }

    // Helper para escapar strings en onclick de templates
    function esc(str) {
      return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    function solicitarBorradoCapital(logId, desc, amount) {
      document.getElementById('cap-borrar-log-id').value = logId;
      const descEl = document.getElementById('cap-borrar-desc');
      if (descEl) {
        descEl.innerText = `¿Deseas borrar el anexo de capital por ${fmt.format(amount)} ("${desc}")? Esta acción requiere autorización y no se puede deshacer.`;
      }
      document.getElementById('modal-confirmar-borrar-capital').classList.remove('hidden');
    }

    function cerrarConfirmarBorrarCapital() {
      document.getElementById('modal-confirmar-borrar-capital').classList.add('hidden');
    }

    function ejecutarBorradoCapital() {
      const logId = parseInt(document.getElementById('cap-borrar-log-id').value);
      
      cerrarConfirmarBorrarCapital();
      cerrarMovimientosCapital();

      abrirPINModal('Autorizar Borrado de Anexo de Capital', (opName) => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

        const historical = DB.get('historical_logs_by_date', {}) || {};
        let montoRecuperado = 0;
        let category = '';
        let piezasRecuperadas = null;
        let encontrado = false;

        if (Array.isArray(historical[todayStr])) {
          const idx = historical[todayStr].findIndex(l => l && l.id === logId);
          if (idx !== -1) {
            const logEntry = historical[todayStr][idx];
            montoRecuperado = logEntry.amount || 0;
            category = logEntry.category;
            piezasRecuperadas = logEntry.pieces || null;
            historical[todayStr].splice(idx, 1);
            encontrado = true;
          }
        }

        if (!encontrado) {
          mostrarToast('No se encontró el registro.', 'warning');
          return;
        }

        DB.set('historical_logs_by_date', historical);

        // Eliminar de log activo
        const logs = DB.get('logs', []);
        const filteredLogs = logs.filter(l => l && l.id !== logId);
        DB.set('logs', filteredLogs);

        // Descontar saldo y revertir inventario si era Efectivo
        const balances = DB.get('balances', {});
        
        if (category === 'CAPITAL_TERMINAL') {
          balances.yastasTerminal = (balances.yastasTerminal || 0) - montoRecuperado;
          balances.capitalTerminal = Math.max(0, (balances.capitalTerminal || 0) - montoRecuperado);
          balances.capital = (balances.capitalTerminal || 0) + (balances.capitalEfectivo || 0);
        } else {
          // CAPITAL_EFECTIVO o CAPITAL_RETIRO: revertir saldo Yastas Efectivo y capital en efectivo
          balances.yastasEfectivo = (balances.yastasEfectivo || 0) - montoRecuperado;
          balances.capitalEfectivo = Math.max(0, (balances.capitalEfectivo || 0) - montoRecuperado);
          balances.capital = (balances.capitalTerminal || 0) + (balances.capitalEfectivo || 0);

          if (piezasRecuperadas && typeof piezasRecuperadas === 'object') {
            const inventory = DB.get('inventory', {});
            Object.keys(piezasRecuperadas).forEach(denom => {
              const cantidad = piezasRecuperadas[denom];
              if (cantidad && cantidad !== 0) {
                // Si cantidad > 0 (anexo), al borrar se resta. Si cantidad < 0 (retiro), se suma de vuelta.
                inventory[denom] = Math.max(0, (inventory[denom] || 0) - cantidad);
              }
            });
            DB.set('inventory', inventory);
          }
        }

        DB.set('balances', balances);

        // Registrar en bitácora
        registrarMovimientoBitacora(opName, 'BORRADO_CAPITAL', -montoRecuperado,
          `Anexo de Capital borrado. Monto descontado: ${fmt.format(montoRecuperado)}.`);

        mostrarToast('Anexo de Capital eliminado con éxito.', 'success');
        cargarSaldosDigitales();
        abrirMovimientosCapital();
      });
    }

    // === GESTIÓN DE SALDOS T-CONECTA Y BANAMEX ===
    function abrirAjusteSaldoTConecta() {
      abrirPINModal("Ajustar Saldos T-Conecta (Clave Admin)", (opName) => {
        const modal = document.getElementById('modal-ajuste-tconecta');
        const termInput = document.getElementById('input-ajuste-tconecta-terminal');
        const banamexInput = document.getElementById('input-ajuste-tconecta-banamex');
        if (!modal || !termInput || !banamexInput) return;

        const balances = DB.get('balances', {});
        termInput.value = balances.tconectaTerminal || 0;
        banamexInput.value = balances.banamex || 0;

        modal.classList.remove('hidden');
        lucide.createIcons();
      });
    }

    function cerrarAjusteSaldoTConecta() {
      const modal = document.getElementById('modal-ajuste-tconecta');
      if (modal) modal.classList.add('hidden');
    }

    function guardarAjusteSaldoTConecta() {
      const termInput = document.getElementById('input-ajuste-tconecta-terminal');
      const banamexInput = document.getElementById('input-ajuste-tconecta-banamex');
      if (!termInput || !banamexInput) return;

      const newTerm = parseFloat(termInput.value) || 0;
      const newBanamex = parseFloat(banamexInput.value) || 0;

      const balances = DB.get('balances', {});
      const oldTerm = balances.tconectaTerminal || 0;
      const oldBanamex = balances.banamex || 0;

      balances.tconectaTerminal = newTerm;
      balances.banamex = newBanamex;
      DB.set('balances', balances);

      registrarMovimientoBitacora('Admin', 'AJUSTE_TCONECTA', 0,
        `Saldos ajustados manualmente. Terminal T-Conecta: ${fmt.format(oldTerm)} -> ${fmt.format(newTerm)}. Banamex: ${fmt.format(oldBanamex)} -> ${fmt.format(newBanamex)}.`);

      cerrarAjusteSaldoTConecta();
      mostrarToast("Saldos de T-Conecta y Banamex actualizados con éxito.", "success");
      refrescarPantallas();
    }

    // === GESTIÓN DE PIN MODAL ===
    function abrirPINModal(title, callback) {
      const titleEl = document.getElementById('pin-modal-titulo');
      const descEl = document.getElementById('pin-modal-desc');
      const inputEl = document.getElementById('pin-input');
      
      if (titleEl) titleEl.innerText = title;
      
      if (inputEl) {
        inputEl.value = '';
        const is3D = title.includes("3 dígitos") || title.includes("Administración") || title.includes("072") || title.includes(ADMIN_SETTINGS_PIN);
        if (is3D) {
          inputEl.setAttribute('maxlength', '3');
          inputEl.setAttribute('placeholder', '•••');
          if (descEl) descEl.innerText = "Escriba el PIN de Administración (3 dígitos) para validar.";
        } else {
          inputEl.setAttribute('maxlength', '2');
          inputEl.setAttribute('placeholder', '••');
          if (descEl) descEl.innerText = "Escriba su PIN de Cajero (2 dígitos) para validar la operación.";
        }
      }
      
      document.getElementById('modal-pin').classList.remove('hidden');
      setTimeout(() => { if (inputEl) inputEl.focus(); }, 120);
      pinCallback = callback;
    }

    // Cerrar PIN
    function cerrarModalPIN() {
      document.getElementById('modal-pin').classList.add('hidden');
      pinCallback = null;
    }

    function validarPIN() {
      const pin = document.getElementById('pin-input').value;
      
      // Permitir el PIN de 3 dígitos de administración
      if (pin === ADMIN_SETTINGS_PIN) {
        const callback = pinCallback;
        cerrarModalPIN();
        if (callback) callback("Administrador", pin);
        return;
      }
      
      const name = Operators[pin];
      if (name) {
        const callback = pinCallback;
        cerrarModalPIN();
        if (callback) callback(name, pin);
      } else {
        mostrarToast("Código PIN no válido.", "error");
      }
    }

    // === MODAL: VER PIEZAS EN CAJA ===
    function abrirModalPiezas() {
      if (!sessionActive) return;
      const inventory = DB.get('inventory', {});
      const tbody = document.getElementById('conteo-caja-tbody');
      tbody.innerHTML = '';

      let totalVal = 0;
      const listDenoms = [...Denominations.billetes, ...Denominations.monedas];

      listDenoms.forEach(d => {
        const pieces = inventory[d] || 0;
        const sub = d * pieces;
        totalVal += sub;

        const isBillete = Denominations.billetes.includes(d);
        const tag = isBillete 
          ? '<span class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold">Billete</span>' 
          : '<span class="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">Moneda</span>';

        const denomLabel = d === 0.5 ? '50¢' : `$${d}`;
        const isLow = false;
        const lowBadge = '';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition duration-150";
        tr.innerHTML = `
          <td class="py-2.5 px-4 flex items-center gap-2">
            <span class="w-10 font-bold text-slate-700 dark:text-slate-200">${denomLabel}</span>
            ${tag}
            ${lowBadge}
          </td>
          <td class="py-2.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">${pieces} pzs</td>
          <td class="py-2.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-300">${fmt.format(sub)}</td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById('conteo-total-caja').innerText = fmt.format(totalVal);
      document.getElementById('modal-piezas').classList.remove('hidden');
      lucide.createIcons();
    }

    function cerrarModalPiezas() {
      document.getElementById('modal-piezas').classList.add('hidden');
    }

    function abrirModalAjustarAlertas() {
      document.getElementById('modal-piezas').classList.add('hidden');
      
      const thresholds = getLowStockThresholds();
      const containerBilletes = document.getElementById('alertas-billetes-list');
      const containerMonedas = document.getElementById('alertas-monedas-list');
      
      containerBilletes.innerHTML = '';
      containerMonedas.innerHTML = '';
      
      const renderList = (arr, container, type) => {
        arr.forEach(d => {
          const limit = thresholds[d] !== undefined ? thresholds[d] : 0;
          const denomLabel = d === 0.5 ? '50¢' : `$${d}`;
          const badgeBg = type === 'billete' ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
          
          const row = document.createElement('div');
          row.className = 'flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 text-xs';
          row.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="w-8 font-bold">${denomLabel}</span>
              <span class="px-2 py-0.5 rounded text-[9px] font-bold ${badgeBg}">${type === 'billete' ? 'Billete' : 'Moneda'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400 font-bold uppercase">Mínimo:</span>
              <input type="number" 
                     id="al-threshold-${d}" 
                     min="0" 
                     value="${limit}" 
                     class="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1 text-center font-bold text-slate-800 dark:text-white outline-none">
              <span class="text-slate-400 font-semibold">pzs</span>
            </div>
          `;
          container.appendChild(row);
          
          const inputEl = row.querySelector('input');
          inputEl.addEventListener('focus', function() {
            this.select();
          });
        });
      };
      
      renderList(Denominations.billetes, containerBilletes, 'billete');
      renderList(Denominations.monedas, containerMonedas, 'moneda');
      
      document.getElementById('modal-ajustar-alertas').classList.remove('hidden');
      lucide.createIcons();
    }
    
    function cerrarModalAjustarAlertas() {
      document.getElementById('modal-ajustar-alertas').classList.add('hidden');
      abrirModalPiezas();
    }
    
    function guardarAlertasStock() {
      const thresholds = {};
      const listDenoms = [...Denominations.billetes, ...Denominations.monedas];
      
      let hasError = false;
      listDenoms.forEach(d => {
        const val = parseInt(document.getElementById(`al-threshold-${d}`).value);
        if (isNaN(val) || val < 0) {
          hasError = true;
        } else {
          thresholds[d] = val;
        }
      });
      
      if (hasError) {
        mostrarToast("Ingrese valores numéricos válidos (mayores o iguales a 0).", "error");
        return;
      }
      
      saveLowStockThresholds(thresholds);
      mostrarToast("Alertas de stock actualizadas con éxito.", "success");
      
      document.getElementById('modal-ajustar-alertas').classList.add('hidden');
      abrirModalPiezas();
      cargarSaldosDigitales();
    }

    // === BITÁCORA Y LOGS ===
    function registrarMovimientoBitacora(operator, category, amount, details, pieces = null, extraData = null) {
      const logs = DB.get('logs', []);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const newLog = {
        id: Date.now(),
        date: dateStr,
        time: now.toLocaleTimeString(),
        operator,
        category,
        amount,
        details,
        pieces,
        extraData
      };

      // 1. Logs de sesión activa
      logs.unshift(newLog);
      DB.set('logs', logs);

      // 2. Histórico particionado por fecha
      const historical = DB.get('historical_logs_by_date', {});
      if (!historical[dateStr]) {
        historical[dateStr] = [];
      }
      historical[dateStr].unshift(newLog);
      DB.set('historical_logs_by_date', historical);
      
      // Sincronizar el estado activo del turno en la nube
      guardarEstadoActivoNube();
    }

    function setBitacoraTab(tab) {
      bitacoraActiveTab = tab;
      
      const tabSaldos = document.getElementById('tab-bitacora-saldos');
      const tabPiezas = document.getElementById('tab-bitacora-piezas');
      const tabCorte = document.getElementById('tab-bitacora-corte');
      
      const containerSaldos = document.getElementById('container-bitacora-saldos');
      const containerPiezas = document.getElementById('container-bitacora-piezas');
      const containerCorte = document.getElementById('container-bitacora-corte');
      
      // Reset classes
      const activeClass = "flex-1 py-4 text-center font-bold text-xs tracking-wider uppercase transition border-b-2 border-indigo-500 text-indigo-700 bg-indigo-50/20 cursor-pointer";
      const inactiveClass = "flex-1 py-4 text-center font-bold text-xs tracking-wider uppercase transition border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50 cursor-pointer";
      
      if (tabSaldos) tabSaldos.className = inactiveClass;
      if (tabPiezas) tabPiezas.className = inactiveClass;
      if (tabCorte) tabCorte.className = inactiveClass;
      
      if (containerSaldos) containerSaldos.classList.add('hidden');
      if (containerPiezas) containerPiezas.classList.add('hidden');
      if (containerCorte) containerCorte.classList.add('hidden');
      
      if (tab === 'saldos') {
        if (tabSaldos) tabSaldos.className = activeClass;
        if (containerSaldos) containerSaldos.classList.remove('hidden');
      } else if (tab === 'piezas') {
        if (tabPiezas) tabPiezas.className = activeClass;
        if (containerPiezas) containerPiezas.classList.remove('hidden');
      } else if (tab === 'corte') {
        if (tabCorte) tabCorte.className = activeClass;
        if (containerCorte) containerCorte.classList.remove('hidden');
      }
      
      cargarBitacora();
    }

    function cargarBitacora() {
      // 1. Obtener logs históricos y fecha seleccionada
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const selectedDate = document.getElementById('filtro-fecha') ? document.getElementById('filtro-fecha').value : todayStr;
      
      if (bitacoraActiveTab === 'corte') {
        renderizarReporteVisual(selectedDate);
        return;
      }
      
      const historical = DB.get('historical_logs_by_date', {});
      let dateLogs = historical[selectedDate] || [];

      // Recuperar logs desde cierre_reports si historical_logs_by_date estaba vacío
      if (!dateLogs || dateLogs.length === 0) {
        const reports = DB.get('cierre_reports', {});
        const report = reports[selectedDate];
        if (report && (report.bitacora || report.logs)) {
          dateLogs = report.bitacora || report.logs || [];
          historical[selectedDate] = dateLogs;
          DB.set('historical_logs_by_date', historical);
        }
      }

      // Si la fecha seleccionada es hoy o coincide con la fecha de apertura del turno activo
      const stateObj = DB.get('state', {});
      const activeOpenedDate = stateObj.opened_date || todayStr;

      if (selectedDate === todayStr || selectedDate === activeOpenedDate) {
        const activeLogs = DB.get('logs', []) || [];
        const seenIds = new Set(dateLogs.map(l => l.id).filter(Boolean));
        
        activeLogs.forEach(log => {
          if (!seenIds.has(log.id)) {
            dateLogs.push(log);
            seenIds.add(log.id);
          }
        });
      }

      // Ordenar por ID descendente (el más reciente primero)
      dateLogs.sort((a, b) => (b.id || 0) - (a.id || 0));

      // 2. Llenar selector de operadores dinámicamente según la base de datos de esa fecha
      const filtroOperadorSelect = document.getElementById('filtro-operador');
      if (filtroOperadorSelect) {
        const currentSelectedVal = filtroOperadorSelect.value || 'todos';
        // Obtener operadores únicos en los registros de ese día
        const uniqueOperators = [...new Set(dateLogs.map(l => l.operator))].filter(Boolean);
        const currentOptions = Array.from(filtroOperadorSelect.options).map(opt => opt.value);
        const expectedOptions = ['todos', ...uniqueOperators];
        
        const arraysEqual = currentOptions.length === expectedOptions.length && 
                            currentOptions.every((val, index) => val === expectedOptions[index]);
                            
        if (!arraysEqual) {
          filtroOperadorSelect.innerHTML = '<option value="todos">Todos los operadores</option>';
          uniqueOperators.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op;
            opt.innerText = op;
            filtroOperadorSelect.appendChild(opt);
          });
          if (expectedOptions.includes(currentSelectedVal)) {
            filtroOperadorSelect.value = currentSelectedVal;
          } else {
            filtroOperadorSelect.value = 'todos';
          }
        }
      }

      // 3. Aplicar filtros dinámicos (Tipo, Cuenta, Operador)
      const filterTipo = document.getElementById('filtro-tipo') ? document.getElementById('filtro-tipo').value : 'todos';
      const filterCuenta = document.getElementById('filtro-cuenta') ? document.getElementById('filtro-cuenta').value : 'todas';
      const filterOperador = document.getElementById('filtro-operador') ? document.getElementById('filtro-operador').value : 'todos';

      const filteredLogs = dateLogs.filter(log => {
        // Filtrar por Tipo de movimiento
        if (filterTipo === 'ingreso') {
          if (log.amount < 0 || log.category === 'Apertura' || log.category === 'Cierre' || log.category === 'Cambio' || log.category === 'cambio' || log.category.startsWith('AJUSTE_') || log.category.startsWith('BORRADO_') || log.category.startsWith('FONDEO_')) return false;
        } else if (filterTipo === 'egreso') {
          if (log.amount >= 0 || log.category === 'Apertura' || log.category === 'Cierre' || log.category === 'Cambio' || log.category === 'cambio' || log.category.startsWith('AJUSTE_') || log.category.startsWith('BORRADO_') || log.category.startsWith('FONDEO_')) return false;
        } else if (filterTipo === 'apertura') {
          if (log.category !== 'Apertura') return false;
        } else if (filterTipo === 'cierre') {
          if (log.category !== 'Cierre') return false;
        } else if (filterTipo === 'ajuste') {
          if (!log.category.startsWith('AJUSTE_') && !log.category.startsWith('BORRADO_') && !log.category.startsWith('FONDEO_')) return false;
        } else if (filterTipo === 'cambio') {
          if (log.category !== 'Cambio' && log.category !== 'cambio') return false;
        }

        // Filtrar por Cuenta
        if (filterCuenta !== 'todas') {
          const catUpper = log.category.toUpperCase();
          const target = filterCuenta.toUpperCase();
          if (catUpper !== target && !catUpper.endsWith(`_${target}`) && !catUpper.startsWith(`${target}_`)) {
            return false;
          }
        }

        // Filtrar por Operador
        if (filterOperador !== 'todos') {
          if (log.operator !== filterOperador) return false;
        }

        return true;
      });

      const tbodySaldos = document.getElementById('bitacora-tbody');
      const tbodyPiezas = document.getElementById('bitacora-piezas-tbody');
      
      if (tbodySaldos) tbodySaldos.innerHTML = '';
      if (tbodyPiezas) tbodyPiezas.innerHTML = '';

      if (filteredLogs.length === 0) {
        document.getElementById('bitacora-vacia').classList.remove('hidden');
        return;
      }

      document.getElementById('bitacora-vacia').classList.add('hidden');

      if (bitacoraActiveTab === 'saldos') {
        filteredLogs.forEach(log => {
          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition duration-150 border-b border-slate-100";
          
          let typeBadge = '';
          let typeClass = 'text-slate-600 font-bold';
          
          if (log.category === 'Apertura') {
            typeBadge = '<span class="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold px-2 py-0.5 rounded-full">APERTURA</span>';
            typeClass = 'text-blue-600 font-bold';
          } else if (log.category === 'Cierre') {
            typeBadge = '<span class="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-bold px-2 py-0.5 rounded-full">CIERRE</span>';
            typeClass = 'text-slate-500 font-bold';
          } else if (log.category === 'Cambio' || log.category === 'cambio') {
            typeBadge = '<span class="bg-orange-50 text-orange-700 border border-orange-100 text-[9px] font-bold px-2 py-0.5 rounded-full">CAMBIO</span>';
            typeClass = 'text-orange-600 font-bold';
          } else if (log.category.startsWith('AJUSTE_') || log.category.startsWith('BORRADO_')) {
            typeBadge = '<span class="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-2 py-0.5 rounded-full">AJUSTE</span>';
            typeClass = log.amount >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold';
          } else {
            typeClass = log.amount >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold';
            typeBadge = log.amount >= 0 
              ? '<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-full">INGRESO</span>' 
              : '<span class="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-full">EGRESO</span>';
          }

          // Renderizado del botón de desglose físico (Piezas)
          let piecesBtn = '<span class="text-slate-300 text-xs font-semibold">-</span>';
          if (log.pieces && Object.keys(log.pieces).length > 0) {
            piecesBtn = `
              <button onclick="abrirModalDesglose(${log.id})" class="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto border border-indigo-100 cursor-pointer" title="Ver Desglose de Piezas">
                <i data-lucide="banknote" class="w-3.5 h-3.5"></i> Ver pz
              </button>
            `;
          }

          let friendlyCategory = log.category;
          if (log.category === 'RE-DEPÓSITO_YASTAS') friendlyCategory = 'Re-depósito Yastas';
          else if (log.category === 'TCONECTA_RECARGA_EFECTIVO') friendlyCategory = 'T-Conecta (Recarga Efectivo)';
          else if (log.category === 'TCONECTA_RECARGA_TARJETA') friendlyCategory = 'T-Conecta (Recarga Tarjeta)';
          else if (log.category === 'TCONECTA_RETIRO') friendlyCategory = 'T-Conecta (Retiro Tarjeta)';

          tr.innerHTML = `
            <td class="py-3 px-6 font-mono text-slate-400 dark:text-slate-400 text-xs">${log.time}</td>
            <td class="py-3 px-4 font-bold text-slate-700 dark:text-slate-100 text-xs">${log.operator}</td>
            <td class="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-200">${friendlyCategory}</td>
            <td class="py-3 px-4 text-xs">${typeBadge}</td>
            <td class="py-3 px-4 text-right ${typeClass} font-mono text-xs">${fmt.format(log.amount)}</td>
            <td class="py-3 px-4 text-center">${piecesBtn}</td>
            <td class="py-3 px-6 text-xs text-slate-500 dark:text-slate-300 font-medium">${log.details}</td>
          `;
          if (tbodySaldos) tbodySaldos.appendChild(tr);
        });
      } else {
        filteredLogs.forEach(log => {
          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition duration-150 border-b border-slate-100 dark:border-slate-800 text-center";
          
          const denoms = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
          let piecesCellsHtml = '';
          
          denoms.forEach(d => {
            let val = '';
            if (log.pieces && log.pieces[d] !== undefined && log.pieces[d] !== 0) {
              const qty = log.pieces[d];
              val = qty > 0 ? `+${qty}` : `${qty}`;
            }
            piecesCellsHtml += `<td class="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">${val}</td>`;
          });

          tr.innerHTML = `
            <td class="py-2.5 px-4 text-left font-mono text-slate-400 dark:text-slate-400 text-xs">${log.time}</td>
            ${piecesCellsHtml}
            <td class="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-100 text-xs">${log.operator}</td>
            <td class="py-2.5 px-4 text-left text-xs text-slate-500 dark:text-slate-300 font-medium max-w-xs truncate" title="${log.details || ''}">${log.details || ''}</td>
          `;
          if (tbodyPiezas) tbodyPiezas.appendChild(tr);
        });
      }
      lucide.createIcons();
    }

    function exportarBitacora() {
      const selectedDate = document.getElementById('filtro-fecha') ? document.getElementById('filtro-fecha').value : new Date().toLocaleDateString('sv');
      const historical = DB.get('historical_logs_by_date', {});
      const dateLogs = historical[selectedDate] || [];

      if (dateLogs.length === 0) {
        mostrarToast(`No hay registros que exportar para la fecha ${selectedDate}.`, "info");
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dateLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Bitacora_${selectedDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      mostrarToast("Historial exportado.", "success");
    }

    // === MODAL: VER DETALLE DE PIEZAS POR TRANSACCIÓN ===
    function abrirModalDesglose(logId) {
      const logs = DB.get('logs', []);
      const historical = DB.get('historical_logs_by_date', {});
      
      // Buscar en logs de sesión, o en el histórico de cualquier fecha
      let log = logs.find(l => l.id === logId);
      if (!log) {
        for (const date in historical) {
          const found = historical[date].find(l => l.id === logId);
          if (found) {
            log = found;
            break;
          }
        }
      }

      if (!log) {
        mostrarToast("No se encontró el registro de esta transacción.", "error");
        return;
      }

      let friendlyCategory = log.category;
      if (log.category === 'RE-DEPÓSITO_YASTAS') friendlyCategory = 'Re-depósito Yastas';
      else if (log.category === 'TCONECTA_RECARGA_EFECTIVO') friendlyCategory = 'T-Conecta (Recarga Efectivo)';
      else if (log.category === 'TCONECTA_RECARGA_TARJETA') friendlyCategory = 'T-Conecta (Recarga Tarjeta)';
      else if (log.category === 'TCONECTA_RETIRO') friendlyCategory = 'T-Conecta (Retiro Tarjeta)';

      document.getElementById('modal-desglose-titulo').innerText = `Detalle: ${friendlyCategory}`;
      document.getElementById('modal-desglose-op').innerText = log.operator;
      document.getElementById('modal-desglose-hora').innerText = `${log.date || ''} ${log.time}`;
      document.getElementById('modal-desglose-monto').innerText = fmt.format(log.amount);
      document.getElementById('modal-desglose-desc').innerText = log.details || '';

      const tbody = document.getElementById('desglose-mov-tbody');
      tbody.innerHTML = '';

      const pieces = log.pieces;
      if (!pieces || Object.keys(pieces).length === 0) {
        document.getElementById('desglose-vacio').classList.remove('hidden');
        document.getElementById('desglose-tabla-container').classList.add('hidden');
      } else {
        document.getElementById('desglose-vacio').classList.add('hidden');
        document.getElementById('desglose-tabla-container').classList.remove('hidden');

        // Ordenar denominaciones descendiente
        const denoms = Object.keys(pieces).map(Number).sort((a, b) => b - a);
        denoms.forEach(d => {
          const qty = pieces[d] || 0;
          if (qty !== 0) {
            const sub = d * qty;
            const isBillete = Denominations.billetes.includes(d);
            const tag = isBillete 
              ? '<span class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold">Billete</span>' 
              : '<span class="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">Moneda</span>';

            const denomLabel = d === 0.5 ? '50¢' : `$${d}`;
            const qtyText = qty > 0 ? `Recibido: +${qty} pzs` : `Entregado: ${qty} pzs`;
            const textClass = qty > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold";

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition duration-150 border-b border-slate-100 dark:border-slate-800";
            tr.innerHTML = `
              <td class="py-2.5 px-4 flex items-center gap-2">
                <span class="w-10 font-bold text-slate-700 dark:text-slate-200">${denomLabel}</span>
                ${tag}
              </td>
              <td class="py-2.5 px-4 text-center ${textClass}">${qtyText}</td>
              <td class="py-2.5 px-4 text-right font-mono font-bold ${textClass}">${fmt.format(sub)}</td>
            `;
            tbody.appendChild(tr);
          }
        });
      }

      document.getElementById('modal-desglose-piezas').classList.remove('hidden');
      lucide.createIcons();
    }

    function cerrarModalDesglose() {
      document.getElementById('modal-desglose-piezas').classList.add('hidden');
    }

    // === TOASTS ===
    function mostrarToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      
      let borderCol = 'border-emerald-200 bg-emerald-50 text-emerald-800';
      let icon = 'check-circle';
      if (type === 'error') {
        borderCol = 'border-rose-200 bg-rose-50 text-rose-800';
        icon = 'alert-circle';
      } else if (type === 'info') {
        borderCol = 'border-indigo-200 bg-indigo-50 text-indigo-800';
        icon = 'info';
      }

      toast.className = `flex items-center gap-2 border px-4 py-3 rounded-2xl shadow-lg text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${borderCol}`;
      toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${message}</span>
      `;
      
      container.appendChild(toast);
      lucide.createIcons();

      setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      }, 50);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-1');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3500);
    }

    function mostrarAlertaError(titulo, descripcion) {
      const existing = document.getElementById('error-alert-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'error-alert-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all duration-300';
      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 dark:border-rose-950/30 flex flex-col items-center text-center space-y-4 transform scale-95 opacity-0 transition-all duration-300">
          <div class="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-full flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="space-y-1.5 w-full">
            <h3 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">${titulo}</h3>
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">${descripcion}</p>
          </div>
          <button id="error-alert-close-btn" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md shadow-rose-950/20 uppercase tracking-wider">
            Entendido
          </button>
        </div>
      `;

      document.body.appendChild(modal);

      setTimeout(() => {
        const card = modal.querySelector('div');
        if (card) {
          card.classList.remove('scale-95', 'opacity-0');
          card.classList.add('scale-100', 'opacity-100');
        }
      }, 50);

      const closeBtn = modal.querySelector('#error-alert-close-btn');
      const closeModal = () => {
        const card = modal.querySelector('div');
        if (card) {
          card.classList.remove('scale-100', 'opacity-100');
          card.classList.add('scale-95', 'opacity-0');
        }
        setTimeout(() => {
          modal.remove();
        }, 200);
      };

      closeBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // ==========================================
    // LÓGICA DE LA CALCULADORA
    // ==========================================
    let calcInput = '0';
    let calcPendingOp = null;
    let calcVal1 = null;
    let calcResetOnNextKey = false;
    let calcHistoryList = [];
    let calcIsLarge = false;

    function abrirModalIvaComision() {
      document.getElementById('modal-iva-comision').classList.remove('hidden');
      const input = document.getElementById('calc-base-val');
      input.value = '';
      document.getElementById('calc-iva-exact').innerText = '$0.00 exacto';
      document.getElementById('calc-iva-rounded').innerText = '$0';
      document.getElementById('calc-com-exact').innerText = '$0.00 exacto';
      document.getElementById('calc-com-rounded').innerText = '$0';
      lucide.createIcons(); // Recargar iconos del modal
      setTimeout(() => input.focus(), 50);
    }

    function cerrarModalIvaComision() {
      document.getElementById('modal-iva-comision').classList.add('hidden');
    }

    function calcularIvaComision() {
      const baseVal = parseFloat(document.getElementById('calc-base-val').value);
      
      const ivaExactEl = document.getElementById('calc-iva-exact');
      const ivaRoundEl = document.getElementById('calc-iva-rounded');
      const comExactEl = document.getElementById('calc-com-exact');
      const comRoundEl = document.getElementById('calc-com-rounded');

      if (isNaN(baseVal) || baseVal <= 0) {
        ivaExactEl.innerText = '$0.00 exacto';
        ivaRoundEl.innerText = '$0';
        comExactEl.innerText = '$0.00 exacto';
        comRoundEl.innerText = '$0';
        return;
      }

      // 1. Con IVA (16%)
      const ivaExact = baseVal * 1.16;
      const ivaRounded = Math.round(ivaExact);

      // 2. Con IVA + Comisión Terminal (2.32%)
      // Para recibir neto (ivaExact) tras comisión terminal: neto / (1 - 0.0232)
      const comExact = ivaExact / (1 - 0.0232);
      const comRounded = Math.round(comExact);

      ivaExactEl.innerText = `${fmt.format(ivaExact)} exacto`;
      ivaRoundEl.innerText = `${fmt.format(ivaRounded).split('.')[0]}`; // sin decimales

      comExactEl.innerText = `${fmt.format(comExact)} exacto`;
      comRoundEl.innerText = `${fmt.format(comRounded).split('.')[0]}`; // sin decimales
    }

    function calcularCambioEfectivo() {
      const modo = document.getElementById('op-cambio-salida-modo-val')?.value || 'sugerido';
      if (modo === 'sugerido' && !isCalculatingSugerido) {
        sugerirCambioEfectivo();
        return;
      }

      // 1. Obtener suma de la entrada (lo que entra a la charola, ingresado en la charola izquierda)
      let totalEntrada = 0;
      const prefix = 'dash';
      const leftInputs = document.querySelectorAll(`.denom-input-field[id^="${prefix}-"]`);
      leftInputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        totalEntrada += denom * cant;
      });

      // 2. Obtener suma de la salida (lo que le entregamos al cliente, ingresado en el panel derecho)
      let totalSalida = 0;
      const idsMap = {
        'cambio-out-1000': 1000,
        'cambio-out-500': 500,
        'cambio-out-200': 200,
        'cambio-out-100': 100,
        'cambio-out-50': 50,
        'cambio-out-20': 20,
        'cambio-out-m10': 10,
        'cambio-out-m5': 5,
        'cambio-out-m2': 2,
        'cambio-out-m1': 1,
        'cambio-out-m05': 0.5
      };

      Object.keys(idsMap).forEach(id => {
        const val = parseInt(document.getElementById(id).value) || 0;
        totalSalida += val * idsMap[id];
      });

      // 3. Actualizar textos de totales si existen
      const totEntradaEl = document.getElementById('cambio-total-entrada');
      const totSalidaEl = document.getElementById('cambio-total-salida');
      if (totEntradaEl) totEntradaEl.innerText = fmt.format(totalEntrada);
      if (totSalidaEl) totSalidaEl.innerText = fmt.format(totalSalida);

      // 4. Comparar y actualizar badge + botón
      const badge = document.getElementById('cambio-status-badge');
      const btnProcesar = document.getElementById('btn-procesar-operacion');

      if (totalEntrada === 0 && totalSalida === 0) {
        if (badge) {
          badge.className = "mt-1.5 p-2.5 rounded-xl text-center text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700";
          badge.innerText = "📌 Ingrese piezas a cambiar en la charola izquierda";
        }
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Cambio`;
        }
      } else if (Math.abs(totalEntrada - totalSalida) < 0.01) {
        if (badge) {
          badge.className = "mt-1.5 p-2.5 rounded-xl text-center text-xs font-black bg-emerald-600 text-white shadow-md border border-emerald-700";
          badge.innerText = `✅ CAMBIO CUADRADO EXACTO (${fmt.format(totalEntrada)})`;
        }
        if (btnProcesar) {
          btnProcesar.disabled = false;
          btnProcesar.classList.remove('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Cambio de ${fmt.format(totalEntrada)}`;
        }
      } else if (totalSalida < totalEntrada) {
        const diff = totalEntrada - totalSalida;
        if (badge) {
          badge.className = "mt-1.5 p-2.5 rounded-xl text-center text-xs font-black bg-amber-500 text-white shadow-md border border-amber-600";
          badge.innerText = `⚠️ FALTA ${fmt.format(diff)} PARA CUADRAR EL CAMBIO`;
        }
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="alert-triangle" class="w-4.5 h-4.5 mr-1 inline"></i> Falta ${fmt.format(diff)} para Cuadrar`;
        }
      } else {
        const diff = totalSalida - totalEntrada;
        if (badge) {
          badge.className = "mt-1.5 p-2.5 rounded-xl text-center text-xs font-black bg-rose-600 text-white shadow-md border border-rose-700";
          badge.innerText = `❌ EXCEDE POR ${fmt.format(diff)} (REDUZCA PIEZAS)`;
        }
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="x-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Excede por ${fmt.format(diff)}`;
        }
      }
      lucide.createIcons();
    }

    // ==========================================
    // LÓGICA DE RE-DEPÓSITO (OPERACIÓN COMBINADA)
    // ==========================================
    let redepositoRetiros = [];

    function agregarRetiroVirtual() {
      const input = document.getElementById('redep-monto-retiro');
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) {
        mostrarToast("Ingrese un monto de retiro válido mayor a 0.", "error");
        return;
      }
      redepositoRetiros.push(val);
      input.value = '';
      renderListaRetiros();
      calcularDiferenciaRedeposito();
      mostrarToast(`Retiro de ${fmt.format(val)} agregado.`, "success");
    }

    function renderListaRetiros() {
      const container = document.getElementById('redep-lista-retiros');
      const totalLabel = document.getElementById('redep-total-retiros');
      
      if (redepositoRetiros.length === 0) {
        container.innerHTML = `<div class="text-[10px] text-slate-400 italic">No hay retiros agregados</div>`;
        totalLabel.innerText = fmt.format(0);
        return;
      }

      let total = 0;
      let html = '';
      redepositoRetiros.forEach((monto, idx) => {
        total += monto;
        html += `
          <div class="flex justify-between items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-2xs">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">${fmt.format(monto)}</span>
            <button type="button" onclick="eliminarRetiroVirtual(${idx})" class="text-rose-500 hover:text-rose-700 transition flex items-center justify-center p-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      });
      container.innerHTML = html;
      totalLabel.innerText = fmt.format(total);
      lucide.createIcons();
    }

    function eliminarRetiroVirtual(idx) {
      const val = redepositoRetiros[idx];
      redepositoRetiros.splice(idx, 1);
      renderListaRetiros();
      calcularDiferenciaRedeposito();
      mostrarToast(`Retiro de ${fmt.format(val)} eliminado.`, "info");
    }

    function calcularDiferenciaRedeposito() {
      const totalRetiros = redepositoRetiros.reduce((sum, val) => sum + val, 0);
      const charolaSum = getCharolaFisicaTotalSum();
      
      const totalDeposito = totalRetiros + charolaSum;
      
      const inputDeposito = document.getElementById('redep-monto-deposito');
      if (inputDeposito) {
        inputDeposito.value = totalDeposito;
      }
      const displayDeposito = document.getElementById('redep-monto-deposito-display');
      if (displayDeposito) {
        displayDeposito.innerText = fmt.format(totalDeposito);
      }
      
      const container = document.getElementById('redep-diferencia-container');
      const valorEl = document.getElementById('redep-diferencia-valor');
      const mensajeEl = document.getElementById('redep-diferencia-mensaje');
      const statusBadge = document.getElementById('redep-status-badge');
      const btnProcesar = document.getElementById('btn-procesar-operacion');

      valorEl.innerText = fmt.format(charolaSum);

      // Reset classes
      container.className = "p-3 rounded-xl border flex flex-col gap-1 items-center justify-center text-center transition duration-150";

      if (totalDeposito === 0 && totalRetiros === 0) {
        container.classList.add("bg-slate-100", "border-slate-200", "text-slate-600");
        mensajeEl.innerText = "Configure los montos";
        statusBadge.innerText = "❌ Ingrese montos";
        statusBadge.className = "p-2 rounded-lg text-center text-xs font-bold bg-rose-50 border border-rose-100 text-rose-600";
        
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Re-depósito`;
        }
        return;
      }

      let isValid = true;
      const balances = DB.get('balances', {});
      const saldoTerminal = balances.yastasTerminal || 0;

      if (totalRetiros === 0) {
        isValid = false;
        statusBadge.innerText = "❌ Ingrese al menos un retiro";
        statusBadge.className = "p-2 rounded-lg text-center text-xs font-bold bg-rose-50 border border-rose-100 text-rose-600";
      } else if (totalDeposito > saldoTerminal) {
        isValid = false;
        statusBadge.innerText = "❌ Saldo insuficiente en terminal";
        statusBadge.className = "p-2 rounded-lg text-center text-xs font-bold bg-rose-50 border border-rose-100 text-rose-600 animate-pulse";
      }

      if (isValid) {
        if (charolaSum > 0) {
          container.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-800");
          mensajeEl.innerHTML = `<span class="flex items-center gap-0.5"><i data-lucide="arrow-down-left" class="w-3.5 h-3.5 text-emerald-500"></i> Recibir del cliente</span>`;
          statusBadge.innerText = "✅ Listo para autorizar (Efectivo capturado)";
          statusBadge.className = "p-2 rounded-lg text-center text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600";
        } else {
          container.classList.add("bg-indigo-50", "border-indigo-200", "text-indigo-800");
          mensajeEl.innerText = "Sin flujo de efectivo físico";
          statusBadge.innerText = "✅ Listo para autorizar (Sin efectivo físico)";
          statusBadge.className = "p-2 rounded-lg text-center text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600";
        }
      }

      if (btnProcesar) {
        if (isValid) {
          btnProcesar.disabled = false;
          btnProcesar.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
        }
        btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Re-depósito`;
      }
      lucide.createIcons();
    }

    function getCharolaFisicaTotalSum() {
      let sum = 0;
      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        sum += denom * cant;
      });
      return sum;
    }

    let currentSugerenciaCambio = null;
    let currentModoCambio = 'sugerido';
    let currentManualCambioPieces = {};
    let currentModoRetiro = 'sugerido';
    let currentSugerenciaRetiro = null;

    function setCambioModo(modo) {
      currentModoCambio = modo;
      const valInput = document.getElementById('op-cambio-modo-val');
      if (valInput) valInput.value = modo;

      const btnSugerido = document.getElementById('btn-cambio-sugerido');
      const btnManual = document.getElementById('btn-cambio-manual');

      if (btnSugerido && btnManual) {
        if (modo === 'sugerido') {
          btnSugerido.className = 'py-1.5 text-[10px] font-black rounded-lg transition-all shadow-xs bg-amber-600 text-white border border-amber-500';
          btnManual.className = 'py-1.5 text-[10px] font-black rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 bg-transparent border border-transparent';
        } else {
          btnManual.className = 'py-1.5 text-[10px] font-black rounded-lg transition-all shadow-xs bg-amber-600 text-white border border-amber-500';
          btnSugerido.className = 'py-1.5 text-[10px] font-black rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 bg-transparent border border-transparent';
        }
      }
      calcularCambioOperacion();
    }

    function calcularCambioOperacion() {
      const srv = document.getElementById('op-service').value;
      const isIngreso = currentOpType === 'ingreso';
      const isRecarga = currentOpType === 'recarga';
      
      let isPhysical = false;
      if (srv === 'yastas') {
        if (isIngreso) isPhysical = true;
        if (isRecarga) {
          const metodo = document.getElementById('op-metodo-recarga-val')?.value || 'efectivo';
          if (metodo === 'efectivo') isPhysical = true;
        }
      } else if (srv === 'tconecta') {
        if (isIngreso) {
          const metodo = document.getElementById('op-metodo-recarga-val')?.value || 'efectivo';
          if (metodo === 'efectivo') isPhysical = true;
        }
      } else if (srv === 'meli') {
        const modo = document.getElementById('op-modo-meli-val')?.value || 'tienda';
        if (isIngreso && modo === 'tienda') isPhysical = true;
      } else if (srv === 'capital') {
        if (isIngreso && modoAnexarCapital === 'efectivo') isPhysical = true;
      }
      
      const panel = document.getElementById('panel-calculadora-cambio');
      const panelOrigen = document.getElementById('panel-origen-efectivo');
      const btn = document.getElementById('btn-procesar-operacion');
      if (!panel) return;

      if (!sessionActive || (!isIngreso && !isRecarga) || !isPhysical) {
        panel.classList.add('hidden');
        currentSugerenciaCambio = null;
        const modoContainer = document.getElementById('op-cambio-modo-container');
        if (modoContainer) modoContainer.classList.add('hidden');
        if (panelOrigen) {
          if (isPhysical && sessionActive) {
            panelOrigen.classList.add('hidden'); 
          } else if (sessionActive && srv === 'caja') {
            panelOrigen.classList.remove('hidden'); 
          } else {
            panelOrigen.classList.add('hidden');
          }
        }
        return;
      }

      panel.classList.remove('hidden');
      if (panelOrigen) panelOrigen.classList.add('hidden');

      const hideCalculatorAmountInput = isRecarga || (srv === 'tconecta' && isIngreso);

      // Mover dinámicamente el panel dentro de la tarjeta de recarga o al contenedor original
      if (hideCalculatorAmountInput) {
        const targetParent = document.getElementById('panel-yastas-recarga');
        if (targetParent && panel.parentElement !== targetParent) {
          targetParent.appendChild(panel);
        }
        panel.className = "space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2";
      } else {
        const originalParent = document.getElementById('op-formulario-contenedor');
        const sibling = document.getElementById('panel-yastas-recarga');
        if (originalParent && sibling && panel.parentElement !== originalParent) {
          originalParent.insertBefore(panel, sibling);
        }
        panel.className = "bg-amber-50/40 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-5 space-y-4";
      }

      const tituloSpan = document.getElementById('op-cambio-titulo');
      if (tituloSpan) {
        tituloSpan.innerText = isRecarga ? 'Calculadora de Cambio (Recargas)' : 'Calculadora de Cambio (Depósitos)';
      }

      const montoInputContainer = document.getElementById('op-cambio-monto-input-container');
      const inputsGrid = document.getElementById('op-cambio-inputs-grid');

      if (montoInputContainer && inputsGrid) {
        if (hideCalculatorAmountInput) {
          montoInputContainer.classList.add('hidden');
          inputsGrid.classList.remove('grid-cols-2');
          inputsGrid.classList.add('grid-cols-1');
        } else {
          montoInputContainer.classList.remove('hidden');
          inputsGrid.classList.remove('grid-cols-1');
          inputsGrid.classList.add('grid-cols-2');
        }
      }

      // Calcular Efectivo Recibido (suma de la charola)
      let sumRecibido = 0;
      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        sumRecibido += denom * cant;
      });

      document.getElementById('op-cambio-recibido-label').innerText = fmt.format(sumRecibido);

      // Leer Monto del Depósito/Recarga
      let montoDep = 0;
      if (isRecarga || (srv === 'tconecta' && isIngreso)) {
        const inputRec = document.getElementById('op-recarga-monto');
        montoDep = inputRec ? (parseFloat(inputRec.value) || 0) : 0;
      } else {
        const inputDep = document.getElementById('op-cambio-deposito');
        montoDep = inputDep ? (parseFloat(inputDep.value) || 0) : 0;
      }

      const resultadoWrapper = document.getElementById('op-cambio-resultado-wrapper');
      const modoContainer = document.getElementById('op-cambio-modo-container');

      if (modoContainer) {
        if (montoDep > 0 && sumRecibido > montoDep) {
          modoContainer.classList.remove('hidden');
        } else {
          modoContainer.classList.add('hidden');
        }
      }
      
      if (montoDep > 0) {
        resultadoWrapper.classList.remove('hidden');

        // CASO A: Falta dinero por ingresar
        if (sumRecibido < montoDep) {
          currentSugerenciaCambio = null;
          const falta = parseFloat((montoDep - sumRecibido).toFixed(2));
          
          resultadoWrapper.innerHTML = `
            <div class="text-center py-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs">
              <span class="text-[10px] font-black text-rose-500 uppercase tracking-wider block mb-1">Falta por ingresar en charola</span>
              <span class="text-3xl font-black text-rose-600">${fmt.format(falta)}</span>
            </div>
            <div class="space-y-2 mt-3">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Billetes y monedas a entregar (Sugerido):</span>
              <div id="op-cambio-sugerencia-piezas" class="grid grid-cols-2 gap-2">
                <div class="col-span-2 text-center py-3 text-slate-400 font-bold text-xs">
                  Esperando que ingrese el resto de billetes/monedas...
                </div>
              </div>
            </div>
          `;
          
          if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Falta Efectivo (${fmt.format(falta)})`;
          }
        }
        // CASO B: Efectivo cuadrado exacto
        else if (Math.abs(sumRecibido - montoDep) < 0.01) {
          currentSugerenciaCambio = null;
          
          resultadoWrapper.innerHTML = `
            <div class="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
              <span class="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Efectivo Cuadrado Exacto</span>
              <span class="text-3xl font-black text-emerald-600">${fmt.format(sumRecibido)}</span>
            </div>
            <div class="space-y-2 mt-3">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Billetes y monedas a entregar (Sugerido):</span>
              <div id="op-cambio-sugerencia-piezas" class="grid grid-cols-2 gap-2">
                <div class="col-span-2 text-center py-3 text-emerald-600 font-black text-xs bg-emerald-50/40 rounded-xl border border-emerald-100">
                  ¡Monto exacto! No se requiere dar cambio.
                </div>
              </div>
            </div>
          `;
          
          if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar ${fmt.format(montoDep)}`;
          }
        }
        // CASO C: Se requiere dar cambio al cliente
        else {
          const cambio = parseFloat((sumRecibido - montoDep).toFixed(2));
          
          if (currentModoCambio === 'manual') {
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-amber-600 rounded-2xl shadow-sm border border-amber-700 flex flex-col gap-0.5">
                <span class="text-[10px] font-black text-amber-100 uppercase tracking-wider block">CAMBIO A DEVOLVER AL CLIENTE (MANUAL)</span>
                <span class="text-3xl font-black text-white">${fmt.format(cambio)}</span>
              </div>
              <div id="op-cambio-manual-status" class="mt-3">
                <!-- Cargado dinámicamente -->
              </div>
              <div class="space-y-2 mt-3">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Billetes y monedas devueltos (Desglose Manual):</span>
                <div id="op-cambio-sugerencia-piezas" class="grid grid-cols-2 gap-2">
                  <!-- Inputs manuales cargados abajo -->
                </div>
              </div>
            `;

            const denoms = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
            let inputsHTML = [];
            denoms.forEach(d => {
              const label = d === 0.5 ? '50¢' : `$${d}`;
              const val = currentManualCambioPieces[d] || 0;
              
              let colorClass = "";
              if (d >= 20) colorClass = "bg-indigo-600 text-white";
              else colorClass = "bg-amber-500 text-slate-900"; // Monedas

              inputsHTML.push(`
                <div class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl shadow-xs focus-within:border-amber-500 transition">
                  <div class="w-14 text-center py-2 rounded-lg text-xs font-black ${colorClass} select-none shadow-xs">${label}</div>
                  <div class="flex flex-col min-w-0 flex-grow">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Cantidad</span>
                    <input type="number" data-denom="${d}" value="${val}" min="0" oninput="actualizarCambioManual()" class="manual-change-input w-full bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none border-b border-transparent focus:border-amber-500 text-center py-0.5">
                  </div>
                </div>
              `);
            });
            document.getElementById('op-cambio-sugerencia-piezas').innerHTML = inputsHTML.join('');
            actualizarCambioManual();
          } else {
            // Modo Sugerido (Auto)
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-orange-600 rounded-2xl shadow-sm border border-orange-700 flex flex-col gap-0.5">
                <span class="text-[10px] font-black text-orange-100 uppercase tracking-wider block">CAMBIO A DEVOLVER AL CLIENTE</span>
                <span class="text-3xl font-black text-white">${fmt.format(cambio)}</span>
              </div>
              <div class="space-y-2 mt-3">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Billetes y monedas a entregar (Sugerido):</span>
                <div id="op-cambio-sugerencia-piezas" class="grid grid-cols-2 gap-2">
                  <!-- Cargado dinámicamente -->
                </div>
              </div>
            `;

            // Sugerir piezas con el inventario disponible
            const inventory = DB.get('inventory', {});
            // Cambiado a ordenamiento por valor descendente para un desglose natural y cómodo (ej. billetes grandes antes que monedas)
            const searchList = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];

            let remaining = cambio;
            const suggested = {};

            for (let d of searchList) {
              if (d > remaining) continue;
              let stock = inventory[d] || 0;
              if (stock > 0) {
                let needed = Math.floor(remaining / d);
                let toGive = Math.min(needed, stock);
                if (toGive > 0) {
                  suggested[d] = toGive;
                  remaining = parseFloat((remaining - toGive * d).toFixed(2));
                }
              }
            }

            if (remaining <= 0.01) {
              // Desglose exitoso
              currentSugerenciaCambio = suggested;
              let badgesHTML = [];
              Object.keys(suggested).forEach(d => {
                const cant = suggested[d];
                const denom = parseFloat(d);
                const label = denom === 0.5 ? '50¢' : `$${denom}`;
                
                let colorClass = "";
                if (denom === 1000) colorClass = "bg-indigo-600 text-white";
                else if (denom === 500) colorClass = "bg-indigo-600 text-white";
                else if (denom === 200) colorClass = "bg-indigo-600 text-white";
                else if (denom === 100) colorClass = "bg-indigo-600 text-white";
                else if (denom === 50) colorClass = "bg-indigo-600 text-white";
                else if (denom === 20) colorClass = "bg-indigo-600 text-white";
                else colorClass = "bg-amber-500 text-slate-900"; // Monedas

                badgesHTML.push(`
                  <div class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl shadow-xs hover:border-amber-400 transition">
                    <div class="w-14 text-center py-2 rounded-lg text-xs font-black ${colorClass} select-none shadow-xs">${label}</div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Entregar</span>
                      <span class="text-sm font-black text-slate-800 dark:text-white">${cant} pzs</span>
                    </div>
                  </div>
                `);
              });
              document.getElementById('op-cambio-sugerencia-piezas').innerHTML = badgesHTML.join('');
              
              if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar ${fmt.format(montoDep)}`;
              }
            } else {
              // No alcanza el cambio exacto
              currentSugerenciaCambio = null;
              document.getElementById('op-cambio-sugerencia-piezas').innerHTML = `
                <div class="col-span-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-100 dark:border-rose-900 flex flex-col gap-1 shadow-xs">
                  <span class="font-black flex items-center gap-1"><i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i> No hay cambio exacto en caja</span>
                  <span class="text-[10px] text-slate-600 dark:text-slate-400 font-medium">No hay suficientes billetes/monedas en tu inventario para dar el cambio de ${fmt.format(cambio)} de forma exacta.</span>
                </div>
              `;
              
              if (btn) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Falta Cambio en Caja`;
              }
            }
          }
        }
      } else {
        // Caso: No se ha ingresado el monto de depósito (Obligatorio)
        resultadoWrapper.classList.remove('hidden');
        currentSugerenciaCambio = null;

        resultadoWrapper.innerHTML = `
          <div class="col-span-2 text-center py-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-amber-800 font-bold text-xs shadow-sm">
            ⚠️ Por favor, ingrese el monto a depositar en el campo de arriba para iniciar.
          </div>
        `;

        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Ingrese Monto a Depositar`;
        }
      }
      lucide.createIcons();
    }

    function actualizarCambioManual() {
      const srv = document.getElementById('op-service').value;
      const isIngreso = currentOpType === 'ingreso';
      const isRecarga = currentOpType === 'recarga';
      
      let sumRecibido = 0;
      const inputsLeft = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputsLeft.forEach(inp => {
        sumRecibido += parseFloat(inp.getAttribute('data-denom')) * (parseInt(inp.value) || 0);
      });

      let montoDep = 0;
      if (isRecarga || (srv === 'tconecta' && isIngreso)) {
        const inputRec = document.getElementById('op-recarga-monto');
        montoDep = inputRec ? (parseFloat(inputRec.value) || 0) : 0;
      } else {
        const inputDep = document.getElementById('op-cambio-deposito');
        montoDep = inputDep ? (parseFloat(inputDep.value) || 0) : 0;
      }

      const cambioRequerido = parseFloat((sumRecibido - montoDep).toFixed(2));

      let sumManual = 0;
      const localPieces = {};
      const inputsManual = document.querySelectorAll('.manual-change-input');
      
      let errorStock = false;
      let denomError = '';
      const inventory = DB.get('inventory', {});

      inputsManual.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        sumManual += denom * cant;
        localPieces[denom] = cant;
        
        if (cant > (inventory[denom] || 0)) {
          errorStock = true;
          denomError = denom === 0.5 ? '50¢' : `$${denom}`;
        }
      });

      currentManualCambioPieces = localPieces;

      const statusDiv = document.getElementById('op-cambio-manual-status');
      const btn = document.getElementById('btn-procesar-operacion');

      if (errorStock) {
        currentSugerenciaCambio = null;
        if (statusDiv) {
          statusDiv.innerHTML = `
            <div class="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-100 flex flex-col gap-1 shadow-xs">
              <span class="font-black flex items-center gap-1 text-rose-600"><i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i> Stock Insuficiente</span>
              <span class="text-[10px] text-slate-650 font-medium">No cuentas con suficientes piezas de <b>${denomError}</b> en caja para devolver como cambio.</span>
            </div>
          `;
        }
        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Stock Insuficiente`;
        }
      } else if (Math.abs(sumManual - cambioRequerido) < 0.01) {
        currentSugerenciaCambio = localPieces; 
        if (statusDiv) {
          statusDiv.innerHTML = `
            <div class="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-1.5 shadow-xs font-black">
              <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i> Desglose de cambio exacto
            </div>
          `;
        }
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar ${fmt.format(montoDep)}`;
        }
      } else {
        currentSugerenciaCambio = null;
        const diff = parseFloat((cambioRequerido - sumManual).toFixed(2));
        
        let msg = '';
        let btnText = '';
        if (diff > 0) {
          msg = `Faltan <b>${fmt.format(diff)}</b> por desglosar como cambio.`;
          btnText = `Faltan ${fmt.format(diff)}`;
        } else {
          msg = `Exceso de <b>${fmt.format(Math.abs(diff))}</b> en el desglose de cambio.`;
          btnText = `Exceso ${fmt.format(Math.abs(diff))}`;
        }

        if (statusDiv) {
          statusDiv.innerHTML = `
            <div class="text-xs text-slate-700 bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col gap-1 shadow-xs">
              <span class="font-black flex items-center gap-1 text-slate-800"><i data-lucide="info" class="w-4 h-4 text-slate-500"></i> Ajuste requerido</span>
              <span class="text-[10px] text-slate-650 font-medium">${msg}</span>
            </div>
          `;
        }
        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> ${btnText}`;
        }
      }
      lucide.createIcons();
    }

    function toggleCharolaInputs(disabled) {
      const activeSrv = (document.getElementById('op-service') && document.getElementById('op-service').value) || 'yastas';
      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => {
        inp.disabled = disabled;
        inp.value = disabled ? 0 : inp.value; // Reset value when blocking
        if (disabled) {
          inp.classList.add('bg-slate-100', 'text-slate-300', 'cursor-not-allowed');
          inp.classList.remove('focus:border-indigo-500');
        } else {
          inp.classList.remove('bg-slate-100', 'text-slate-300', 'cursor-not-allowed');
          inp.classList.add('focus:border-indigo-500');
        }
      });

      // Overlay visual sobre la sección completa de charola
      const charolaSection = document.getElementById('charola-section');
      if (charolaSection) {
        let overlay = document.getElementById('charola-lock-overlay');
        if (disabled) {
          charolaSection.style.opacity = '0.4';
          charolaSection.style.pointerEvents = 'none';
          charolaSection.style.userSelect = 'none';
          const serviceOverlayColors = {
            'yastas': 'bg-purple-600/90',
            'banorte': 'bg-rose-600/90',
            'meli': 'bg-amber-600/90',
            'bbva': 'bg-blue-700/90',
            'tconecta': 'bg-sky-600/90',
            'capital': 'bg-teal-600/90',
            'caja': 'bg-slate-700/90',
            'cambio': 'bg-amber-600/90'
          };
          const bgClass = serviceOverlayColors[activeSrv] || 'bg-indigo-600/90';

          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'charola-lock-overlay';
            overlay.className = 'absolute inset-0 flex items-center justify-center z-10';
            overlay.innerHTML = `
              <div class="${bgClass} text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 backdrop-blur-sm">
                <i data-lucide="lock" class="w-5 h-5"></i>
                <span class="text-xs font-black uppercase tracking-wider">Modo Sugerido Activo</span>
              </div>
            `;
            charolaSection.style.position = 'relative';
            charolaSection.appendChild(overlay);
            lucide.createIcons();
          } else {
            const badge = overlay.querySelector('div');
            if (badge) badge.className = `${bgClass} text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 backdrop-blur-sm`;
          }
        } else {
          charolaSection.style.opacity = '1';
          charolaSection.style.pointerEvents = 'auto';
          charolaSection.style.userSelect = 'auto';
          if (overlay) overlay.remove();
        }
      }
    }

    function setRetiroModo(modo) {
      currentModoRetiro = modo;
      document.getElementById('op-retiro-modo-val').value = modo;
      
      const btnSugerido = document.getElementById('btn-retiro-sugerido');
      const btnManual = document.getElementById('btn-retiro-manual');
      
      if (!btnSugerido || !btnManual) return;
      
      if (modo === 'sugerido') {
        btnSugerido.className = "py-1.5 text-[10px] font-black rounded-lg transition-all shadow-xs bg-indigo-600 text-white border border-indigo-500";
        btnManual.className = "py-1.5 text-[10px] font-black rounded-lg transition-all text-slate-600 hover:bg-slate-200 bg-transparent";
      } else {
        btnSugerido.className = "py-1.5 text-[10px] font-black rounded-lg transition-all text-slate-600 hover:bg-slate-200 bg-transparent";
        btnManual.className = "py-1.5 text-[10px] font-black rounded-lg transition-all shadow-xs bg-indigo-600 text-white border border-indigo-500";
      }
      
      // Limpiar inputs de la charola pero conservar el monto del retiro
      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => inp.value = '');
      
      calcularTotalLocal();
      calcularRetiroOperacion();
    }

    function calcularRetiroOperacion() {
      const srv = document.getElementById('op-service').value;
      const isRetiro = currentOpType === 'salida';
      const isPhysical = (srv === 'yastas' || srv === 'bbva' || srv === 'capital' || srv === 'tconecta' || (srv === 'meli' && document.getElementById('op-modo-meli-val').value === 'tienda'));
      
      const panel = document.getElementById('panel-calculadora-retiro');
      const panelOrigen = document.getElementById('panel-origen-efectivo');
      const btn = document.getElementById('btn-procesar-operacion');
      if (!panel) return;

      if (!sessionActive || !isRetiro || !isPhysical) {
        panel.classList.add('hidden');
        currentSugerenciaRetiro = null;
        toggleCharolaInputs(false); // Asegurar que quede habilitada para otros servicios
        if (panelOrigen) {
          if (isPhysical && sessionActive) {
            panelOrigen.classList.add('hidden'); // Siempre oculto para Yastas/Meli
          } else if (sessionActive && srv === 'caja') {
            panelOrigen.classList.remove('hidden'); // Mostrar para Bóveda que usa charola directa
          } else {
            panelOrigen.classList.add('hidden');
          }
        }
        return;
      }

      panel.classList.remove('hidden');
      if (panelOrigen) panelOrigen.classList.add('hidden'); // Ocultar siempre el duplicado para Yastas/Meli

      // Bloquear/desbloquear charola según modo activo
      toggleCharolaInputs(currentModoRetiro === 'sugerido');

      // Leer Monto del Retiro
      const inputRet = document.getElementById('op-retiro-monto');
      const montoRet = parseFloat(inputRet.value) || 0;

      const resultadoWrapper = document.getElementById('op-retiro-resultado-wrapper');
      
      if (montoRet > 0) {
        resultadoWrapper.classList.remove('hidden');

        // CASO A: Modo Manual (Charola)
        if (currentModoRetiro === 'manual') {
          toggleCharolaInputs(false);
          currentSugerenciaRetiro = null;

          // Calcular total de la charola
          let sumCharola = 0;
          const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
          inputs.forEach(inp => {
            const denom = parseFloat(inp.getAttribute('data-denom'));
            const cant = parseInt(inp.value) || 0;
            sumCharola += denom * cant;
          });

          if (sumCharola < montoRet) {
            const falta = parseFloat((montoRet - sumCharola).toFixed(2));
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs">
                <span class="text-[10px] font-black text-rose-500 uppercase tracking-wider block mb-1">Falta por capturar en charola</span>
                <span class="text-3xl font-black text-rose-600">${fmt.format(falta)}</span>
              </div>
            `;
            if (btn) {
              btn.disabled = true;
              btn.classList.add('opacity-50', 'cursor-not-allowed');
              btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Falta Efectivo (${fmt.format(falta)})`;
            }
          } else if (Math.abs(sumCharola - montoRet) < 0.01) {
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                <span class="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Efectivo Cuadrado Correctamente</span>
                <span class="text-3xl font-black text-emerald-600">${fmt.format(sumCharola)}</span>
              </div>
            `;
            if (btn) {
              btn.disabled = false;
              btn.classList.remove('opacity-50', 'cursor-not-allowed');
              btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Retiro de ${fmt.format(montoRet)}`;
            }
          } else {
            const exceso = parseFloat((sumCharola - montoRet).toFixed(2));
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs">
                <span class="text-[10px] font-black text-rose-500 uppercase tracking-wider block mb-1">Exceso detectado en charola</span>
                <span class="text-3xl font-black text-rose-600">${fmt.format(exceso)}</span>
              </div>
            `;
            if (btn) {
              btn.disabled = true;
              btn.classList.add('opacity-50', 'cursor-not-allowed');
              btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Exceso de Efectivo (${fmt.format(exceso)})`;
            }
          }
        }
        // CASO B: Modo Sugerido (Auto)
        else {
          toggleCharolaInputs(true);

          // Algoritmo de sugerencia de retiro (prioriza billetes altos: 1000, 500)
          const inventory = DB.get('inventory', {});
          
          const highDenoms = [1000, 500];
          const midDenoms = [200, 100, 50, 20];
          const coinDenoms = [10, 5, 2, 1, 0.5];

          const baseSafety = {
            1000: 1,
            500: 2,
            200: 3,
            100: 4,
            50: 6,
            20: 8,
            10: 15,
            5: 15,
            2: 15,
            1: 15,
            0.5: 10
          };

          // Ordenar dinámicamente cada grupo por cantidad en stock (descendente)
          highDenoms.sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
          midDenoms.sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));
          coinDenoms.sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0));

          // Retiro prioriza billetes altos primero
          const searchList = [
            ...highDenoms,
            ...midDenoms,
            ...coinDenoms
          ];

          let success = false;
          let suggested = {};
          const safetyFactors = [1.0, 0.6, 0.2, 0.0];

          for (let factor of safetyFactors) {
            success = tryMakeWithdrawalWithSafetyFactor(searchList, factor);
            if (success) break;
          }

          function tryMakeWithdrawalWithSafetyFactor(list, factor) {
            let tempRemaining = montoRet;
            const tempSuggested = {};
            
            for (let d of list) {
              if (d > tempRemaining) continue;
              let stock = inventory[d] || 0;
              if (stock > 0) {
                const base = baseSafety[d] || 0;
                let safetyCount = Math.round(base * factor);
                let safeAvailable = Math.max(0, stock - safetyCount);
                
                let needed = Math.floor(tempRemaining / d);
                let toGive = Math.min(needed, safeAvailable);
                if (toGive > 0) {
                  tempSuggested[d] = toGive;
                  tempRemaining = parseFloat((tempRemaining - toGive * d).toFixed(2));
                }
              }
            }
            if (Math.abs(tempRemaining) < 0.01) {
              suggested = tempSuggested;
              return true;
            }
            return false;
          }

          if (success) {
            // Desglose exitoso
            currentSugerenciaRetiro = suggested;
            let badgesHTML = [];
            Object.keys(suggested).forEach(d => {
              const cant = suggested[d];
              const denom = parseFloat(d);
              const label = denom === 0.5 ? '50¢' : `$${denom}`;
              
              let colorClass = "";
              if (denom === 1000) colorClass = "bg-indigo-600 text-white";
              else if (denom === 500) colorClass = "bg-indigo-600 text-white";
              else if (denom === 200) colorClass = "bg-indigo-600 text-white";
              else if (denom === 100) colorClass = "bg-indigo-600 text-white";
              else if (denom === 50) colorClass = "bg-indigo-600 text-white";
              else if (denom === 20) colorClass = "bg-indigo-600 text-white";
              else colorClass = "bg-amber-500 text-slate-900"; // Monedas

              badgesHTML.push(`
                <div class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl shadow-xs hover:border-indigo-400 transition">
                  <div class="w-14 text-center py-2 rounded-lg text-xs font-black ${colorClass} select-none shadow-xs">${label}</div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Entregar</span>
                    <span class="text-sm font-black text-slate-800 dark:text-white">${cant} pzs</span>
                  </div>
                </div>
              `);
            });

            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-indigo-600 rounded-2xl shadow-sm border border-indigo-700 flex flex-col gap-0.5">
                <span class="text-[10px] font-black text-indigo-100 uppercase tracking-wider block">EFECTIVO TOTAL A ENTREGAR</span>
                <span class="text-3xl font-black text-white">${fmt.format(montoRet)}</span>
              </div>
              <div class="space-y-2 mt-3">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Billetes y monedas a entregar (Sugerido):</span>
                <div id="op-retiro-sugerencia-piezas" class="grid grid-cols-2 gap-2">
                  ${badgesHTML.join('')}
                </div>
              </div>
            `;

            if (btn) {
              btn.disabled = false;
              btn.classList.remove('opacity-50', 'cursor-not-allowed');
              btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Retiro de ${fmt.format(montoRet)}`;
            }
          } else {
            // No alcanzan los fondos físicos
            currentSugerenciaRetiro = null;
            resultadoWrapper.innerHTML = `
              <div class="text-center py-4 bg-rose-600 rounded-2xl shadow-sm border border-rose-700 flex flex-col gap-0.5">
                <span class="text-[10px] font-black text-rose-100 uppercase tracking-wider block">FONDOS INSUFICIENTES EN CAJA</span>
                <span class="text-3xl font-black text-white">${fmt.format(montoRet)}</span>
              </div>
              <div class="col-span-2 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-100 flex flex-col gap-1 shadow-xs mt-3">
                <span class="font-black flex items-center gap-1"><i data-lucide="alert-circle" class="w-4 h-4 text-rose-500"></i> No se puede completar el desglose</span>
                <span class="text-[10px] text-slate-600 font-medium">No cuentas con suficientes billetes o monedas físicas en caja para realizar el retiro de ${fmt.format(montoRet)}.</span>
              </div>
            `;
            if (btn) {
              btn.disabled = true;
              btn.classList.add('opacity-50', 'cursor-not-allowed');
              btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Fondos Insuficientes`;
            }
          }
        }
        lucide.createIcons();
      } else {
        // Caso: No se ha ingresado el monto de retiro (Obligatorio)
        resultadoWrapper.classList.remove('hidden');
        currentSugerenciaRetiro = null;

        resultadoWrapper.innerHTML = `
          <div class="col-span-2 text-center py-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-800 font-bold text-xs shadow-sm">
            ⚠️ Por favor, ingrese el monto a retirar en el campo de arriba para iniciar.
          </div>
        `;

        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Ingrese Monto a Retirar`;
        }
        lucide.createIcons();
      }
    }

    let isCalculatingSugerido = false;

    function sugerirCambioEfectivo() {
      if (isCalculatingSugerido) return;
      isCalculatingSugerido = true;
      let totalEntrada = 0;
      const prefix = 'dash';
      const leftInputs = document.querySelectorAll(`.denom-input-field[id^="${prefix}-"]`);
      let maxReceivedDenom = 0;
      let receivedCount = 0;

      leftInputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        if (cant > 0) {
          totalEntrada += denom * cant;
          receivedCount += cant;
          if (denom > maxReceivedDenom) maxReceivedDenom = denom;
        }
      });

      if (totalEntrada <= 0) {
        const piezasContainer = document.getElementById('cambio-salida-sugerido-piezas');
        const totalBanner = document.getElementById('cambio-salida-sugerido-total');
        if (totalBanner) totalBanner.innerText = "$0.00";
        if (piezasContainer) piezasContainer.innerHTML = "";
        
        const btnProcesar = document.getElementById('btn-procesar-operacion');
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Cambio`;
        }
        isCalculatingSugerido = false;
        return;
      }

      const inventory = DB.get('inventory', {});
      
      let maxAllowedDenom = 1000;
      if (maxReceivedDenom > 0) {
        maxAllowedDenom = maxReceivedDenom - 0.01;
      }

      const denoms = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
      
      const suggested = {
        1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0,
        m10: 0, m5: 0, m2: 0, m1: 0, m05: 0
      };

      const baseSafety = {
        1000: 1,
        500: 2,
        200: 3,
        100: 4,
        50: 6,
        20: 8,
        10: 15,
        5: 15,
        2: 15,
        1: 15,
        0.5: 10
      };

      const searchList = denoms.filter(d => d <= maxAllowedDenom);
      
      let success = false;
      const safetyFactors = [1.0, 0.6, 0.2, 0.0];
      
      for (let factor of safetyFactors) {
        success = tryMakeChangeWithSafetyFactor(searchList, factor);
        if (success) break;
      }
      
      if (!success) {
        for (let factor of safetyFactors) {
          success = tryMakeChangeWithSafetyFactor(denoms, factor);
          if (success) break;
        }
      }

      if (success) {
        document.getElementById('cambio-out-1000').value = suggested[1000];
        document.getElementById('cambio-out-500').value = suggested[500];
        document.getElementById('cambio-out-200').value = suggested[200];
        document.getElementById('cambio-out-100').value = suggested[100];
        document.getElementById('cambio-out-50').value = suggested[50];
        document.getElementById('cambio-out-20').value = suggested[20];
        document.getElementById('cambio-out-m10').value = suggested['m10'];
        document.getElementById('cambio-out-m5').value = suggested['m5'];
        document.getElementById('cambio-out-m2').value = suggested['m2'];
        document.getElementById('cambio-out-m1').value = suggested['m1'];
        document.getElementById('cambio-out-m05').value = suggested['m05'];

        // Renderizado dinámico de la vista de tarjetas sugeridas
        const piezasContainer = document.getElementById('cambio-salida-sugerido-piezas');
        const totalBanner = document.getElementById('cambio-salida-sugerido-total');
        if (totalBanner) totalBanner.innerText = fmt.format(totalEntrada);

        if (piezasContainer) {
          const cardsHTML = [];
          const labelsMap = {
            1000: '$1000', 500: '$500', 200: '$200', 100: '$100', 50: '$50', 20: '$20',
            m10: '$10', m5: '$5', m2: '$2', m1: '$1', m05: '50¢'
          };
          const denomsOrder = [1000, 500, 200, 100, 50, 20, 'm10', 'm5', 'm2', 'm1', 'm05'];
          
          denomsOrder.forEach(key => {
            const count = suggested[key] || 0;
            if (count > 0) {
              const label = labelsMap[key];
              cardsHTML.push(`
                <div class="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xs">
                  <div class="w-14 text-center py-2 rounded-xl text-sm font-black bg-indigo-600 text-white select-none">${label}</div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">ENTREGAR</span>
                    <span class="text-sm font-black text-slate-800 dark:text-white">${count} pzs</span>
                  </div>
                </div>
              `);
            }
          });
          piezasContainer.innerHTML = cardsHTML.join('');
        }

        const btnProcesar = document.getElementById('btn-procesar-operacion');
        if (btnProcesar) {
          btnProcesar.disabled = false;
          btnProcesar.classList.remove('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Registrar Cambio de ${fmt.format(totalEntrada)}`;
        }

        isCalculatingSugerido = false;
        lucide.createIcons();
      } else {
        const idsList = [
          'cambio-out-1000', 'cambio-out-500', 'cambio-out-200', 'cambio-out-100', 'cambio-out-50', 'cambio-out-20',
          'cambio-out-m10', 'cambio-out-m5', 'cambio-out-m2', 'cambio-out-m1', 'cambio-out-m05'
        ];
        idsList.forEach(id => {
          const inp = document.getElementById(id);
          if (inp) inp.value = 0;
        });
        
        const piezasContainer = document.getElementById('cambio-salida-sugerido-piezas');
        const totalBanner = document.getElementById('cambio-salida-sugerido-total');
        if (totalBanner) totalBanner.innerText = fmt.format(totalEntrada);
        if (piezasContainer) {
          piezasContainer.innerHTML = `
            <div class="col-span-2 p-4 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-bold">
              ⚠️ No hay suficientes piezas en caja para sugerir un desglose exacto. Por favor, utilice el modo Manual.
            </div>
          `;
        }

        const btnProcesar = document.getElementById('btn-procesar-operacion');
        if (btnProcesar) {
          btnProcesar.disabled = true;
          btnProcesar.classList.add('opacity-50', 'cursor-not-allowed');
          btnProcesar.innerHTML = `<i data-lucide="alert-triangle" class="w-4.5 h-4.5 mr-1 inline"></i> Sin stock para sugerido (Use Manual)`;
        }

        isCalculatingSugerido = false;
        lucide.createIcons();
      }

      function tryMakeChangeWithSafetyFactor(list, factor) {
        const tempAvailable = { ...inventory };
        let tempRemaining = totalEntrada;
        
        // Reset suggested
        Object.keys(suggested).forEach(k => suggested[k] = 0);

        for (let d of list) {
          let availablePieces = tempAvailable[d] || 0;
          const base = baseSafety[d] || 0;
          let safetyCount = Math.round(base * factor);
          
          let safeAvailable = Math.max(0, availablePieces - safetyCount);
          let needed = Math.floor(tempRemaining / d);
          let toGive = Math.min(needed, safeAvailable);

          if (toGive > 0) {
            tempRemaining = parseFloat((tempRemaining - toGive * d).toFixed(2));
            tempAvailable[d] -= toGive;
            
            if (d === 1000) suggested[1000] = toGive;
            else if (d === 500) suggested[500] = toGive;
            else if (d === 200) suggested[200] = toGive;
            else if (d === 100) suggested[100] = toGive;
            else if (d === 50) suggested[50] = toGive;
            else if (d === 20) suggested[20] = toGive;
            else if (d === 10) suggested['m10'] = toGive;
            else if (d === 5) suggested['m5'] = toGive;
            else if (d === 2) suggested['m2'] = toGive;
            else if (d === 1) suggested['m1'] = toGive;
            else if (d === 0.5) suggested['m05'] = toGive;
          }
        }
        return Math.abs(tempRemaining) < 0.01;
      }
    }

    function setCambioSalidaModo(modo) {
      const valInput = document.getElementById('op-cambio-salida-modo-val');
      if (!valInput) return;
      valInput.value = modo;

      const btnSugerido = document.getElementById('btn-cambio-salida-sugerido');
      const btnManual = document.getElementById('btn-cambio-salida-manual');
      const panelSugerido = document.getElementById('panel-cambio-salida-sugerido');
      const panelManualGrid = document.getElementById('panel-cambio-salida-manual-grid');
      const panelComparador = document.getElementById('cambio-comparador-totales');
      const inputsOut = document.querySelectorAll('input[id^="cambio-out-"]');

      if (modo === 'sugerido') {
        if (btnSugerido) {
          btnSugerido.className = 'py-2 px-3 rounded-xl text-xs font-black transition-all shadow-md bg-orange-600 text-white border-2 border-orange-700';
        }
        if (btnManual) {
          btnManual.className = 'py-2 px-3 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
        }

        if (panelSugerido) panelSugerido.classList.remove('hidden');
        if (panelManualGrid) panelManualGrid.classList.add('hidden');
        if (panelComparador) panelComparador.classList.add('hidden');

        inputsOut.forEach(inp => {
          inp.readOnly = true;
        });

        sugerirCambioEfectivo();
      } else {
        if (btnManual) {
          btnManual.className = 'py-2 px-3 rounded-xl text-xs font-black transition-all shadow-md bg-orange-600 text-white border-2 border-orange-700';
        }
        if (btnSugerido) {
          btnSugerido.className = 'py-2 px-3 rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
        }

        if (panelSugerido) panelSugerido.classList.add('hidden');
        if (panelManualGrid) panelManualGrid.classList.remove('hidden');
        if (panelComparador) panelComparador.classList.remove('hidden');

        inputsOut.forEach(inp => {
          inp.readOnly = false;
          inp.value = 0;
        });

        calcularCambioEfectivo();
      }
    }

    function toggleCalculadora() {
      const widget = document.getElementById('calc-widget');
      const isHidden = widget.classList.contains('hidden');
      if (isHidden) {
        widget.classList.remove('hidden');
        widget.style.left = '';
        widget.style.top = '';
        widget.style.bottom = '1.5rem';
        widget.style.right = '1.5rem';
        resetCalculadora();
        renderCalcHistoryList();
        lucide.createIcons(); // Asegura la correcta renderización de todos los iconos Lucide al mostrarse
      } else {
        widget.classList.add('hidden');
      }
    }

    function toggleCalcSize() {
      calcIsLarge = !calcIsLarge;
      const widget = document.getElementById('calc-widget');
      const body = widget.querySelector('.flex-row');
      const leftCol = body.querySelector('div:first-child');
      const sizeIcon = document.getElementById('calc-size-icon');
      const displayVal = document.getElementById('calc-display');
      const displayContainer = document.getElementById('calc-display-container');
      const btnContainer = leftCol.querySelector('.grid');
      
      if (calcIsLarge) {
        // Large layout
        widget.classList.replace('max-w-[580px]', 'max-w-[800px]');
        body.classList.replace('h-[460px]', 'h-[620px]');
        leftCol.classList.replace('w-[320px]', 'w-[460px]');
        displayVal.classList.replace('text-2xl', 'text-4xl');
        displayContainer.classList.replace('h-20', 'h-28');
        btnContainer.classList.replace('text-xs', 'text-lg');
        
        // Update icon to minimize
        sizeIcon.setAttribute('data-lucide', 'minimize-2');
      } else {
        // Standard layout
        widget.classList.replace('max-w-[800px]', 'max-w-[580px]');
        body.classList.replace('h-[620px]', 'h-[460px]');
        leftCol.classList.replace('w-[460px]', 'w-[320px]');
        displayVal.classList.replace('text-4xl', 'text-2xl');
        displayContainer.classList.replace('h-28', 'h-20');
        btnContainer.classList.replace('text-lg', 'text-xs');
        
        // Update icon to maximize
        sizeIcon.setAttribute('data-lucide', 'maximize-2');
      }
      lucide.createIcons();
    }

    function resetCalculadora() {
      calcInput = '0';
      calcPendingOp = null;
      calcVal1 = null;
      calcResetOnNextKey = false;
      updateCalcDisplay();
    }

    function updateCalcDisplay() {
      document.getElementById('calc-display').innerText = calcInput;
      
      let histText = '';
      if (calcVal1 !== null) {
        histText = calcVal1 + ' ' + (calcPendingOp || '');
      }
      document.getElementById('calc-history').innerText = histText;
    }

    function pressCalc(key) {
      if (key >= '0' && key <= '9') {
        if (calcInput === '0' || calcResetOnNextKey) {
          calcInput = key;
          calcResetOnNextKey = false;
        } else {
          calcInput += key;
        }
      } else if (key === '.') {
        if (calcResetOnNextKey) {
          calcInput = '0.';
          calcResetOnNextKey = false;
        } else if (!calcInput.includes('.')) {
          calcInput += '.';
        }
      } else if (key === '+/-') {
        if (calcInput !== '0') {
          if (calcInput.startsWith('-')) {
            calcInput = calcInput.slice(1);
          } else {
            calcInput = '-' + calcInput;
          }
        }
      } else if (key === 'C') {
        resetCalculadora();
      } else if (key === 'CE') {
        calcInput = '0';
      } else if (key === 'Backspace') {
        if (calcInput.length > 1) {
          calcInput = calcInput.slice(0, -1);
          if (calcInput === '-') calcInput = '0';
        } else {
          calcInput = '0';
        }
      } else if (['+', '-', '*', '/'].includes(key)) {
        if (calcVal1 === null) {
          calcVal1 = parseFloat(calcInput);
        } else if (calcPendingOp) {
          const res = runCalcOperation(calcVal1, parseFloat(calcInput), calcPendingOp);
          calcVal1 = res;
          calcInput = String(res);
        }
        calcPendingOp = key;
        calcResetOnNextKey = true;
      } else if (key === '=') {
        if (calcVal1 !== null && calcPendingOp) {
          const v2 = parseFloat(calcInput);
          const res = runCalcOperation(calcVal1, v2, calcPendingOp);
          
          const exprText = `${calcVal1} ${calcPendingOp} ${v2} =`;
          calcHistoryList.unshift({ expr: exprText, result: res });
          renderCalcHistoryList();

          calcInput = String(res);
          calcVal1 = null;
          calcPendingOp = null;
          calcResetOnNextKey = true;
        }
      }
      updateCalcDisplay();
    }

    function runCalcOperation(v1, v2, op) {
      switch(op) {
        case '+': return v1 + v2;
        case '-': return v1 - v2;
        case '*': return v1 * v2;
        case '/': return v2 !== 0 ? parseFloat((v1 / v2).toFixed(8)) : 'Error';
        default: return v2;
      }
    }

    function limpiarHistorialCalculadora() {
      calcHistoryList = [];
      renderCalcHistoryList();
      mostrarToast("Historial de operaciones limpio", "info");
    }

    function renderCalcHistoryList() {
      const container = document.getElementById('calc-history-list');
      container.innerHTML = '';

      if (calcHistoryList.length === 0) {
        container.innerHTML = `<div class="text-slate-600 text-center py-16 text-[10px] font-sans">Sin operaciones</div>`;
        return;
      }

      calcHistoryList.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "p-2 bg-slate-950/30 hover:bg-slate-950/60 border border-slate-800/60 rounded-lg cursor-pointer transition text-slate-300 hover:text-white mb-1.5 text-right";
        div.innerHTML = `
          <div class="text-[9px] text-slate-500">${item.expr}</div>
          <div class="text-xs font-bold text-indigo-400 mt-0.5">${item.result}</div>
        `;
        div.onclick = () => {
          calcInput = String(item.result);
          calcVal1 = null;
          calcPendingOp = null;
          calcResetOnNextKey = true;
          updateCalcDisplay();
        };
        container.appendChild(div);
      });
      lucide.createIcons();
    }

    function initCalcDragging() {
      const widget = document.getElementById('calc-widget');
      const dragHandle = document.getElementById('calc-drag-handle');
      
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;

      dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = widget.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        widget.style.position = 'fixed';
        widget.style.left = initialLeft + 'px';
        widget.style.top = initialTop + 'px';
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
        
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        widget.style.left = (initialLeft + dx) + 'px';
        widget.style.top = (initialTop + dy) + 'px';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
      
      dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        
        const rect = widget.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        widget.style.position = 'fixed';
        widget.style.left = initialLeft + 'px';
        widget.style.top = initialTop + 'px';
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
      });
      
      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        
        widget.style.left = (initialLeft + dx) + 'px';
        widget.style.top = (initialTop + dy) + 'px';
      });
      
      document.addEventListener('touchend', () => {
        isDragging = false;
      });
    }

    // === GESTIÓN DE USUARIOS (Solo Admin) ===
    function cargarDropdownOperadores() {
      const select = document.getElementById('apertura-operator');
      if (!select) return;
      
      const ops = getOperators();
      const currentVal = select.value;
      
      select.innerHTML = '<option value="" disabled selected>Seleccione Cajero</option>';
      Object.keys(ops).forEach(pin => {
        const opt = document.createElement('option');
        opt.value = pin;
        opt.innerText = `${ops[pin]} (${pin})`;
        select.appendChild(opt);
      });
      
      if (currentVal && ops[currentVal]) {
        select.value = currentVal;
      }
    }

    function solicitarAccesoAdmin() {
      abrirPINModal("PIN de Administración (3 dígitos)", (opName, pin) => {
        if (pin === ADMIN_SETTINGS_PIN) {
          document.getElementById('modal-usuarios').classList.remove('hidden');
          
          // Limpiar campos de configuración al abrir modal
          const inputClave = document.getElementById('nueva-contrasenia-global');
          const confirmClave = document.getElementById('confirmar-contrasenia-global');
          const inputPin = document.getElementById('nuevo-pin-admin');
          const confirmPin = document.getElementById('confirmar-pin-admin');
          
          if (inputClave) inputClave.value = '';
          if (confirmClave) confirmClave.value = '';
          if (inputPin) inputPin.value = '';
          if (confirmPin) confirmPin.value = '';
          
          renderizarListaUsuarios();
        } else {
          mostrarToast("Acceso denegado. Código de administración incorrecto.", "error");
        }
      });
    }

    function cerrarModalUsuarios() {
      document.getElementById('modal-usuarios').classList.add('hidden');
    }

    function renderizarListaUsuarios() {
      const container = document.getElementById('lista-usuarios');
      if (!container) return;
      
      const ops = getOperators();
      container.innerHTML = '';
      
      Object.keys(ops).forEach(pin => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3";
        
        const deleteBtn = pin === ADMIN_PIN 
          ? '<span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">Administrador</span>'
          : `<button onclick="eliminarUsuario('${pin}')" class="p-2 text-rose-500 hover:text-rose-750 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer" title="Eliminar Usuario"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
          
        div.innerHTML = `
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
              ${pin}
            </div>
            <span class="text-xs font-bold text-slate-800">${ops[pin]}</span>
          </div>
          <div>
            ${deleteBtn}
          </div>
        `;
        container.appendChild(div);
      });
      lucide.createIcons();
    }

    function agregarUsuario() {
      const nombreInput = document.getElementById('nuevo-usuario-nombre');
      const pinInput = document.getElementById('nuevo-usuario-pin');
      
      const nombre = nombreInput.value.trim();
      const pin = pinInput.value.trim();
      
      if (!nombre) {
        mostrarToast("Ingrese el nombre del usuario.", "error");
        return;
      }
      
      if (!pin || pin.length !== 2 || isNaN(pin)) {
        mostrarToast("El PIN debe ser exactamente de 2 dígitos numéricos.", "error");
        return;
      }
      
      const ops = getOperators();
      if (ops[pin]) {
        mostrarToast(`El PIN ${pin} ya está registrado para el usuario ${ops[pin]}.`, "error");
        return;
      }
      
      ops[pin] = nombre;
      saveOperators(ops);
      Operators = ops;
      
      cargarDropdownOperadores();
      renderizarListaUsuarios();
      
      nombreInput.value = '';
      pinInput.value = '';
      mostrarToast(`Usuario ${nombre} agregado con éxito.`, "success");
    }

    function eliminarUsuario(pin) {
      if (pin === ADMIN_PIN) {
        mostrarToast("No se puede eliminar al administrador principal.", "error");
        return;
      }
      
      const ops = getOperators();
      if (!ops[pin]) {
        mostrarToast("Usuario no encontrado.", "error");
        return;
      }
      
      const nombre = ops[pin];
      delete ops[pin];
      saveOperators(ops);
      Operators = ops;
      
      cargarDropdownOperadores();
      renderizarListaUsuarios();
      
      mostrarToast(`Usuario ${nombre} eliminado.`, "info");
    }

    function mostrarModalDiferenciaFecha(openedDate) {
      const existing = document.getElementById('date-diff-modal');
      if (existing) existing.remove();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Asegurar día registrado
      localStorage.setItem('caja_cierre_ultimo_dia_intento', todayStr);

      let attempts = parseInt(localStorage.getItem('caja_cierre_intentos')) || 0;
      attempts++;
      localStorage.setItem('caja_cierre_intentos', attempts);

      const isThirdAttempt = attempts >= 3;
      const continueBtnText = isThirdAttempt ? "Silenciar Alertas por Hoy" : "Posponer (30 min)";

      const modal = document.createElement('div');
      modal.id = 'date-diff-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all duration-300';
      modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center space-y-4 transform scale-95 opacity-0 transition-all duration-300">
          <div class="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="space-y-1.5 w-full">
            <h3 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">⚠️ Turno del Día Anterior</h3>
            <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
              Hay un turno que se quedó abierto desde el <b>${openedDate}</b>.<br><br>
              ¿Deseas continuar operando con el mismo balance de caja o prefieres cerrar el turno de ayer para iniciar un nuevo día con caja limpia?
            </p>
            ${isThirdAttempt 
              ? `<p class="text-[10px] text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 py-1.5 px-3 rounded-lg mt-2">Esta es la tercera alerta. Al hacer clic abajo, se desactivarán los avisos por el día de hoy.</p>` 
              : `<p class="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/20 py-1.5 px-3 rounded-lg mt-2">Recordatorio constante. Intento ${attempts} de 3.</p>`
            }
          </div>
          <div class="w-full flex flex-col gap-2 pt-2">
            <button id="date-diff-close-btn" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md shadow-rose-950/20 uppercase tracking-wider">
              Cerrar Turno Anterior
            </button>
            <button id="date-diff-continue-btn" class="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 px-4 rounded-xl text-xs transition uppercase tracking-wider">
              ${continueBtnText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      setTimeout(() => {
        const card = modal.querySelector('div');
        if (card) {
          card.classList.remove('scale-95', 'opacity-0');
          card.classList.add('scale-100', 'opacity-100');
        }
      }, 50);

      const closeBtn = modal.querySelector('#date-diff-close-btn');
      const continueBtn = modal.querySelector('#date-diff-continue-btn');

      closeBtn.addEventListener('click', () => {
        modal.remove();
        cerrarTurno();
      });

      continueBtn.addEventListener('click', () => {
        if (isThirdAttempt) {
          // Aceptar definitivamente la fecha de ayer / Silenciar alertas
          const state = DB.get('state', {});
          state.opened_date = todayStr;
          DB.set('state', state);
          localStorage.setItem('caja_cierre_mutada_dia', todayStr);
          localStorage.setItem('caja_cierre_intentos', '0');
          modal.remove();
          mostrarToast("Alertas de cierre silenciadas por hoy. Continuando con el balance.", "success");
        } else {
          // Posponer decisión por 30 minutos
          localStorage.setItem('caja_cierre_proximo_reminder', String(Date.now() + 30 * 60 * 1000));
          modal.remove();
          mostrarToast("Alerta pospuesta por 30 minutos.", "info");
          
          // Programar siguiente disparo
          setTimeout(() => {
            mostrarModalDiferenciaFecha(openedDate);
          }, 30 * 60 * 1000);
        }
      });
    }

    function actualizarUltimosMovimientos() {
      const activeSrv = (document.getElementById('op-service') && document.getElementById('op-service').value) || 'yastas';
      const container = document.getElementById('dash-ultimos-movimientos-container');
      if (!container) return;

      const sessionLogs = DB.get('logs', []) || [];

      const filtered = sessionLogs.filter(log => {
        if (!log || !log.category) return false;
        const cat = log.category.toUpperCase();
        const target = activeSrv.toUpperCase();
        if (target === 'YASTAS') {
          return cat === 'YASTAS' || cat === 'RE-DEPÓSITO' || cat.startsWith('YASTAS_') || cat.endsWith('_YASTAS');
        }
        if (target === 'CAJA') {
          return cat === 'BOVEDA' || cat === 'CAJA' || cat.startsWith('AJUSTE_BOVEDA') || cat.startsWith('BORRADO_BOVEDA');
        }
        return cat === target || cat.startsWith(`${target}_`) || cat.endsWith(`_${target}`);
      });

      // Tomar los últimos 5
      const recent = filtered.slice(0, 5);

      if (recent.length === 0) {
        container.innerHTML = `
          <div class="text-[10px] text-slate-400 dark:text-slate-300 italic py-3 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
            Sin movimientos registrados para este servicio
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      recent.forEach(log => {
        if (!log) return;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-100/40 dark:hover:bg-slate-700/30 transition duration-150 gap-2';

        const isApertura = log.category === 'Apertura';
        const isCierre = log.category === 'Cierre';
        const isCambio = log.category === 'Cambio' || log.category === 'cambio';
        const isIngreso = (log.amount || 0) > 0 || isApertura;
        
        let typeBadge = '';
        if (isApertura) {
          typeBadge = `<span class="bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">APERTURA</span>`;
        } else if (isCierre) {
          typeBadge = `<span class="bg-slate-100 text-slate-700 border border-slate-200 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">CIERRE</span>`;
        } else if (isCambio) {
          typeBadge = `<span class="bg-orange-50 text-orange-700 border border-orange-100 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">CAMBIO</span>`;
        } else {
          typeBadge = isIngreso
            ? `<span class="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">INGRESO</span>`
            : `<span class="bg-rose-50 text-rose-700 border border-rose-100 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">EGRESO</span>`;
        }

        // Formatear el monto
        let amountText = fmt.format(Math.abs(log.amount || 0));
        let amountClass = 'text-slate-600 font-bold';
        if (!isApertura && !isCierre && !isCambio) {
          amountClass = isIngreso ? 'text-emerald-600 font-black' : 'text-rose-500 font-black';
          amountText = (isIngreso ? '+' : '-') + amountText;
        } else if (isCambio) {
          amountText = '🔄';
        }

        // Formatear Fecha y Hora (DD/MM/AA HH:MM:SS)
        let datePart = '';
        if (log.date && typeof log.date === 'string') {
          const parts = log.date.split('-');
          if (parts.length === 3) {
            datePart = `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`; // DD/MM/AA
          }
        }
        const timePart = log.time && typeof log.time === 'string' ? log.time.split(' ')[0] : '';
        const fullDateTime = datePart ? `${datePart} ${timePart}` : timePart;

        const opName = log.operator || 'Sistema';

        row.innerHTML = `
          <div class="flex items-center gap-2 overflow-hidden min-w-0">
            <span class="text-[9px] text-slate-400 font-mono flex-shrink-0">${fullDateTime}</span>
            ${typeBadge}
            <span class="text-[10px] text-slate-500 font-semibold truncate" title="${log.details || ''}">
              ${log.details || ''}
            </span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-[9px] text-slate-400 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded">${opName}</span>
            <span class="${amountClass} text-[11px]">${amountText}</span>
          </div>
        `;

        container.appendChild(row);
      });
    }

    // === FUNCIONES ADICIONALES PARA EL CORTE DE CAJA Y REPORTES ===

    function cerrarCierreCajaModal() {
      const modal = document.getElementById('modal-cierre-caja');
      if (modal) modal.classList.add('hidden');
    }

    function calcularTotalCierre() {
      const denoms = [
        { id: '1000', val: 1000 },
        { id: '500', val: 500 },
        { id: '200', val: 200 },
        { id: '100', val: 100 },
        { id: '50', val: 50 },
        { id: '20', val: 20 },
        { id: '10', val: 10 },
        { id: '5', val: 5 },
        { id: '2', val: 2 },
        { id: '1', val: 1 },
        { id: '05', val: 0.5 }
      ];

      let totalContado = 0;
      const countedInventory = {};

      // Obtener inventario esperado (cajón + bóveda combinados)
      const expectedInvCajon = DB.get('inventory', {});
      const expectedInvBoveda = DB.get('inventoryBoveda', {});

      denoms.forEach(d => {
        const input = document.getElementById(`cierre-pz-${d.id}`);
        const pz = input ? parseInt(input.value) || 0 : 0;
        countedInventory[d.id] = pz;
        if (d.id === '05') countedInventory['0.5'] = pz;
        totalContado += pz * d.val;

        // Calcular piezas esperadas (cajón + bóveda)
        const invKey = (d.id === '05' || d.id === '0.5') ? '0.5' : d.id;
        const espCajon = (expectedInvCajon[invKey] !== undefined) ? expectedInvCajon[invKey] : (expectedInvCajon[d.id] || 0);
        const espBoveda = (expectedInvBoveda[invKey] !== undefined) ? expectedInvBoveda[invKey] : (expectedInvBoveda[d.id] || 0);
        const esperadas = espCajon + espBoveda;
        const diff = pz - esperadas;

        // Actualizar columna Esperadas
        const espEl = document.getElementById(`cierre-cmp-${d.id}-esp`);
        if (espEl) espEl.innerText = String(esperadas);

        // Actualizar columna Diferencia con color
        const difEl = document.getElementById(`cierre-cmp-${d.id}-dif`);
        if (difEl) {
          if (diff === 0) {
            difEl.innerText = '0';
            difEl.className = 'text-xs font-black text-right font-mono text-emerald-500';
          } else if (diff > 0) {
            difEl.innerText = `+${diff}`;
            difEl.className = 'text-xs font-black text-right font-mono text-amber-500';
          } else {
            difEl.innerText = `${diff}`;
            difEl.className = 'text-xs font-black text-right font-mono text-rose-500';
          }
        }
      });

      // Obtener balances esperados
      const balances = DB.get('balances', {});
      const expectedCajon = balances.yastasEfectivo || 0;
      const expectedBoveda = balances.boveda || 0;
      const expectedTotal = expectedCajon + expectedBoveda;
      const diffTotal = totalContado - expectedTotal;

      const totalDigital = (balances.yastasTerminal || 0) + (balances.capitalTerminal || 0) + (balances.tconecta || 0) + (balances.banamex || 0);
      const granTotal = expectedCajon + totalDigital;

      // Actualizar KPIs superiores
      const kpiEfectivoVal = document.getElementById('cierre-kpi-efectivo');
      if (kpiEfectivoVal) kpiEfectivoVal.innerText = fmt.format(totalContado);

      const kpiDiffVal = document.getElementById('cierre-kpi-efectivo-diff');
      if (kpiDiffVal) {
        if (diffTotal === 0) {
          kpiDiffVal.innerText = "Caja cuadrada";
          kpiDiffVal.className = "text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1";
        } else if (diffTotal > 0) {
          kpiDiffVal.innerText = `Sobrante: +${fmt.format(diffTotal)}`;
          kpiDiffVal.className = "text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1";
        } else {
          kpiDiffVal.innerText = `Faltante: -${fmt.format(Math.abs(diffTotal))}`;
          kpiDiffVal.className = "text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1";
        }
      }

      const kpiDigitalVal = document.getElementById('cierre-kpi-digital');
      if (kpiDigitalVal) kpiDigitalVal.innerText = fmt.format(totalDigital);

      const kpiTotalVal = document.getElementById('cierre-kpi-total');
      if (kpiTotalVal) kpiTotalVal.innerText = fmt.format(granTotal);

      const kpiOperadorVal = document.getElementById('cierre-kpi-operador');
      if (kpiOperadorVal) kpiOperadorVal.innerText = activeOperator || 'Administrador';

      // Actualizar sección 2: Desglose Físico
      const resCajon = document.getElementById('cierre-resumen-cajon-val');
      if (resCajon) resCajon.innerText = fmt.format(expectedCajon);

      const resBoveda = document.getElementById('cierre-resumen-boveda-val');
      if (resBoveda) resBoveda.innerText = fmt.format(expectedBoveda);

      const resTotal = document.getElementById('cierre-resumen-total-val');
      if (resTotal) resTotal.innerText = fmt.format(expectedTotal);

      const resReal = document.getElementById('cierre-resumen-real-val');
      if (resReal) resReal.innerText = fmt.format(totalContado);

      const resDiff = document.getElementById('cierre-resumen-diff-val');
      if (resDiff) {
        if (diffTotal === 0) {
          resDiff.innerText = "Caja cuadrada";
          resDiff.className = "font-black text-emerald-600 dark:text-emerald-400 font-mono";
        } else if (diffTotal > 0) {
          resDiff.innerText = `Sobrante: +${fmt.format(diffTotal)}`;
          resDiff.className = "font-black text-amber-600 dark:text-amber-400 font-mono";
        } else {
          resDiff.innerText = `Faltante: -${fmt.format(Math.abs(diffTotal))}`;
          resDiff.className = "font-black text-rose-600 dark:text-rose-400 font-mono";
        }
      }

      // Actualizar sección 3: Bóveda
      const resBovedaRecoger = document.getElementById('cierre-boveda-recoger-val');
      if (resBovedaRecoger) resBovedaRecoger.innerText = fmt.format(expectedBoveda);

      // Actualizar sección 4: Gráfica Donut Live
      const donutTotalLabel = document.getElementById('cierre-donut-total-live');
      if (donutTotalLabel) donutTotalLabel.innerText = fmt.format(totalDigital);

      const segmentsContainer = document.getElementById('cierre-donut-segments-live');
      const legendsContainer = document.getElementById('cierre-donut-legends-live');

      if (segmentsContainer && legendsContainer) {
        segmentsContainer.innerHTML = '';
        legendsContainer.innerHTML = '';

        if (totalDigital === 0) {
          segmentsContainer.innerHTML = `
            <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#475569" stroke-width="4.5"></circle>
          `;
          legendsContainer.innerHTML = `
            <div class="flex items-center justify-between text-slate-400">
              <span>Sin saldos activos</span>
              <span>$0.00</span>
            </div>
          `;
        } else {
          const channels = [
            { name: 'Yastas', val: balances.yastasTerminal || 0, color: '#a855f7' },
            { name: 'Mercado Libre', val: balances.capitalTerminal || 0, color: '#eab308' },
            { name: 'T-Conecta', val: balances.tconecta || 0, color: '#06b6d4' },
            { name: 'Banamex', val: balances.banamex || 0, color: '#1e40af' }
          ];

          let accumulatedPercentage = 0;
          channels.forEach(ch => {
            const percentage = (ch.val / totalDigital) * 100;
            if (percentage > 0) {
              const dashArray = `${percentage} ${100 - percentage}`;
              const dashOffset = 100 - accumulatedPercentage + 25;
              
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("class", "donut-segment");
              circle.setAttribute("cx", "21");
              circle.setAttribute("cy", "21");
              circle.setAttribute("r", "15.91549430918954");
              circle.setAttribute("fill", "transparent");
              circle.setAttribute("stroke", ch.color);
              circle.setAttribute("stroke-width", "4.5");
              circle.setAttribute("stroke-dasharray", dashArray);
              circle.setAttribute("stroke-dashoffset", String(dashOffset));
              segmentsContainer.appendChild(circle);

              accumulatedPercentage += percentage;
            }

            // Legend con colores adaptativos a tema
            const pctText = percentage > 0 ? `${percentage.toFixed(0)}%` : '0%';
            const leg = document.createElement('div');
            leg.className = "flex items-center justify-between";
            leg.innerHTML = `
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${ch.color}"></span>
                <span class="text-slate-700 dark:text-slate-300 font-semibold">${ch.name}</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold">(${pctText})</span>
              </div>
              <span class="text-slate-900 dark:text-white font-mono font-bold">${fmt.format(ch.val)}</span>
            `;
            legendsContainer.appendChild(leg);
          });
        }
      }

      // Actualizar bancos informativos
      const bbvaLive = document.getElementById('cierre-banco-bbva-live');
      if (bbvaLive) bbvaLive.innerText = fmt.format(balances.bbva || 0);

      const banorteLive = document.getElementById('cierre-banco-banorte-live');
      if (banorteLive) banorteLive.innerText = fmt.format(balances.banorte || 0);

      const banamexLive = document.getElementById('cierre-banco-banamex-live');
      if (banamexLive) banamexLive.innerText = fmt.format(balances.banamex || 0);

      // Calcular reconciliación T-Conecta / Banamex / Yastas
      let recEfectivo = 0;
      let recTarjeta = 0;
      let recRetiro = 0;

      const currentLogs = DB.get('logs', []) || [];
      currentLogs.forEach(log => {
        if (!log || !log.category) return;
        const cat = log.category.toUpperCase();
        if (cat === 'TCONECTA_RECARGA_EFECTIVO') recEfectivo += log.amount;
        else if (cat === 'TCONECTA_RECARGA_TARJETA') recTarjeta += log.amount;
        else if (cat === 'TCONECTA_RETIRO') recRetiro += Math.abs(log.amount);
      });

      const recEfectivoEl = document.getElementById('cierre-rec-efectivo-val');
      if (recEfectivoEl) recEfectivoEl.innerText = fmt.format(recEfectivo);

      const recTarjetaEl = document.getElementById('cierre-rec-tarjeta-val');
      if (recTarjetaEl) recTarjetaEl.innerText = fmt.format(recTarjeta);

      const recRetiroEl = document.getElementById('cierre-rec-retiro-val');
      if (recRetiroEl) recRetiroEl.innerText = fmt.format(recRetiro);

      // Calcular y refrescar la calculadora de suma rápida
      actualizarSumaRapidaCierre();
    }

    function firmarYCerrarTurno() {
      abrirPINModal("Firmar Corte de Caja", (opName) => {
        const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
        const countedInventory = {};
        let totalContado = 0;
        
        denoms.forEach(id => {
          const input = document.getElementById(`cierre-pz-${id}`);
          const pz = input ? parseInt(input.value) || 0 : 0;
          countedInventory[id] = pz;
          const val = id === '05' ? 0.5 : parseInt(id);
          totalContado += pz * val;
        });

        const balances = DB.get('balances', {});
        const expectedCajon = balances.yastasEfectivo || 0;
        const expectedBoveda = balances.boveda || 0;
        const expectedTotal = expectedCajon + expectedBoveda;
        const diffTotal = totalContado - expectedTotal;

        // Calcular movimientos de Bóveda
        const logs = DB.get('logs', []);
        let bovedaIn = 0;
        let bovedaOut = 0;
        logs.forEach(l => {
          if (l.category === 'BOVEDA' || l.category === 'CAJA') {
            if (l.amount > 0) bovedaIn += l.amount;
            else bovedaOut += Math.abs(l.amount);
          }
        });

        // Generar JSON del reporte
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        const pad = n => String(n).padStart(2, '0');
        const folioId = `CR-${year}${month}${day}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

        const report = {
          folio: folioId,
          date: dateKey,
          time: now.toLocaleTimeString(),
          operator: opName,
          apertura_date: DB.get('state', {}).opened_date || dateKey,
          apertura_time: DB.get('state', {}).opened_time || '08:00:00',
          expectedCajon: expectedCajon,
          expectedBoveda: expectedBoveda,
          totalContado: totalContado,
          diffTotal: diffTotal,
          bovedaIn: bovedaIn,
          bovedaOut: bovedaOut,
          balances: JSON.parse(JSON.stringify(balances)),
          countedInventory: countedInventory,
          combinedExpectedInventory: obtenerExpectedCombinedInventory()
        };

        // Guardar reporte
        const reports = DB.get('cierre_reports', {});
        reports[dateKey] = report;
        DB.set('cierre_reports', reports);

        // Guardar en la bitácora histórica de movimientos
        const currentInventory = DB.get('inventory', {});
        registrarMovimientoBitacora(opName, "Cierre", 0, `Turno cerrado y firmado [${folioId}]. Total Contado: ${fmt.format(totalContado)}. Diferencia: ${fmt.format(diffTotal)}`, currentInventory);

        // --- PREPARAR PAYLOAD PARA GOOGLE SHEETS ---
        const payloadNube = {
          action: "cierre",
          token: typeof SECURITY_TOKEN !== 'undefined' ? SECURITY_TOKEN : "",
          folio: folioId,
          fecha: dateKey,
          hora: now.toLocaleTimeString(),
          operador: opName,
          efectivo_esperado: expectedCajon,
          efectivo_real: totalContado,
          diferencia: diffTotal,
          boveda: expectedBoveda,
          yastas_terminal: balances.yastasTerminal || 0,
          meli_terminal: balances.capitalTerminal || 0,
          tconecta_efectivo: balances.tconecta || 0,
          banamex_terminal: balances.banamex || 0,
          bbva: balances.bbva || 0,
          banorte: balances.banorte || 0,
          banamex_banco: balances.banamex || 0,
          bitacora: logs,
          report: report
        };

        // Enviar asíncronamente a Google Sheets con fallback local en cola
        guardarCierreEnNube(payloadNube).then(exito => {
          if (exito) {
            mostrarToast("Reporte guardado en Google Sheets con éxito.", "success");
          } else {
            encolarCierrePendiente(payloadNube);
            mostrarToast("Sin conexión a Google Sheets. Guardado localmente en cola de espera.", "warning");
          }
        });

        // RESETEAR SALDOS DE CONTEO DIARIO
        balances.yastasTerminal = 0;
        balances.yastasEfectivo = 0;
        balances.tconecta = 0;
        balances.transferencia = 0;
        balances.bbva = 0;
        balances.capital = 0;
        balances.capitalTerminal = 0;
        balances.capitalEfectivo = 0;
        balances.boveda = 0; // Se recoge de bóveda
        // NOTA: balances.tconectaTerminal y balances.banamex NO SE RESETEAN (Se conservan acumulativamente entre turnos)
        DB.set('inventoryBoveda', {}); // Bóveda vacía
        DB.set('balances', balances);
        DB.set('logs', []);

        // Guardar estado de sesión cerrada
        DB.set('state', { session_active: false, operator: null });
        sessionActive = false;
        activeOperator = null;
        guardarEstadoActivoNube();

        // Ocultar modal y mostrar éxito
        cerrarCierreCajaModal();
        mostrarToast("Corte de Caja guardado y firmado con éxito.", "success");
        refrescarPantallas();
      });
    }

    // === VISOR DE REPORTES HISTÓRICOS DE CIERRE ===
    let viendoHistoricoCierre = false;

    function mapearFilaANubeReporte(row, fallbackDate) {
      if (!row || typeof row !== 'object') return null;
      if (row.fecha === 'Fecha' || row.hora === 'Hora Cierre') return null;

      const bitacoraArr = Array.isArray(row.bitacora) ? row.bitacora : [];
      let fechaClean = fallbackDate;
      if (row.fecha && typeof row.fecha === 'string') {
        fechaClean = row.fecha.includes('T') ? row.fecha.split('T')[0] : row.fecha;
      }

      return {
        date: fechaClean,
        time: row.hora || '',
        operator: row.operador || 'Operador',
        totalContado: parseFloat(row.efectivo_real) || 0,
        expectedCajon: parseFloat(row.efectivo_esperado) || 0,
        expectedBoveda: parseFloat(row.boveda) || 0,
        diffTotal: parseFloat(row.diferencia) || 0,
        balances: {
          yastasTerminal: parseFloat(row.yastas_terminal) || 0,
          capitalTerminal: parseFloat(row.meli_terminal) || 0,
          tconecta: parseFloat(row.tconecta_efectivo) || 0,
          banamex: parseFloat(row.banamex_terminal) || parseFloat(row.banamex_banco) || 0,
          bbva: parseFloat(row.bbva) || 0,
          banorte: parseFloat(row.banorte) || 0
        },
        bitacora: bitacoraArr,
        countedInventory: row.countedInventory || row.inventory || {},
        combinedExpectedInventory: row.combinedExpectedInventory || {}
      };
    }

    async function alCambiarFechaFiltro() {
      const filtroFecha = document.getElementById('filtro-fecha');
      if (!filtroFecha) return;
      const selectedDate = filtroFecha.value;
      if (!selectedDate) return;

      // Obtener el día de hoy en formato YYYY-MM-DD
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      let reports = DB.get('cierre_reports', {});
      let report = reports[selectedDate];

      if (!report && GOOGLE_WEB_APP_URL && !GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) {
        try {
          const res = await fetch(`${GOOGLE_WEB_APP_URL}?action=get_historical_data&date=${selectedDate}`);
          const cloudHist = await res.json();
          let rawList = [];
          if (Array.isArray(cloudHist)) {
            rawList = cloudHist;
          } else if (cloudHist && cloudHist.data && Array.isArray(cloudHist.data)) {
            rawList = cloudHist.data;
          } else if (cloudHist && cloudHist.report) {
            rawList = [cloudHist.report];
          }

          if (rawList.length > 0) {
            const historical = DB.get('historical_logs_by_date', {});
            const allDayLogs = [];

            rawList.forEach(item => {
              if (item.report && typeof item.report === 'object') {
                reports[selectedDate] = item.report;
                report = item.report;
                if (item.report.bitacora && Array.isArray(item.report.bitacora)) {
                  allDayLogs.push(...item.report.bitacora);
                }
              } else {
                const rep = mapearFilaANubeReporte(item, selectedDate);
                if (rep && (rep.totalContado > 0 || rep.expectedCajon > 0 || rep.operator !== 'Operador')) {
                  reports[selectedDate] = rep;
                  report = rep;
                  if (rep.bitacora && Array.isArray(rep.bitacora)) {
                    allDayLogs.push(...rep.bitacora);
                  }
                }
              }
            });

            if (Object.keys(reports).length > 0) {
              DB.set('cierre_reports', reports);
            }

            if (allDayLogs.length > 0) {
              const existingLogs = historical[selectedDate] || [];
              const seenIds = new Set(existingLogs.map(l => l ? l.id : null).filter(Boolean));
              allDayLogs.forEach(l => {
                if (l && l.id && !seenIds.has(l.id)) {
                  existingLogs.push(l);
                  seenIds.add(l.id);
                }
              });
              historical[selectedDate] = existingLogs;
              DB.set('historical_logs_by_date', historical);
            }
          }
        } catch (e) {
          console.error("Error recuperando datos históricos:", e);
        }
      }

      cargarBitacora();

      const mainView = document.getElementById('dash-main-view');
      const bitacoraView = document.getElementById('dash-bitacora-view');
      const cierreView = document.getElementById('dash-cierre-view');

      if (report) {
        // Mostrar visor del reporte de cierre histórico
        viendoHistoricoCierre = true;
        mostrarReporteCierreHistorico(report);
        
        // Conservar la vista actual donde está parado el usuario.
        // Solo forzar la vista de cierre si no estaba en tablero ni en bitácora.
        const wasMainView = mainView && !mainView.classList.contains('hidden');
        const wasBitacoraView = bitacoraView && !bitacoraView.classList.contains('hidden');
        
        if (!wasMainView && !wasBitacoraView) {
          if (mainView) mainView.classList.add('hidden');
          if (bitacoraView) bitacoraView.classList.add('hidden');
          if (cierreView) cierreView.classList.remove('hidden');
        }
      } else {
        // Si no hay reporte histórico, regresar a la subvista activa de hoy
        viendoHistoricoCierre = false;
        restaurarCierreModoInteractivo();

        const wasCierreView = cierreView && !cierreView.classList.contains('hidden');
        if (wasCierreView) {
          if (cierreView) cierreView.classList.add('hidden');
          if (sessionActive) {
            // Restaurar tablero o bitácora según corresponda
            const btnBitacora = document.getElementById('btn-abrir-bitacora');
            const lookingAtBitacora = btnBitacora && btnBitacora.getAttribute('onclick').includes('tablero');
            if (lookingAtBitacora) {
              if (bitacoraView) bitacoraView.classList.remove('hidden');
            } else {
              if (mainView) mainView.classList.remove('hidden');
            }
          } else {
            refrescarPantallas();
          }
        }
      }
    }

    function mostrarReporteCierreHistorico(report) {
      // 1. Mostrar banner y ocultar botones interactivos de firma/cancelación
      const banner = document.getElementById('cierre-historico-banner');
      const infoText = document.getElementById('cierre-historico-info');
      if (banner) banner.classList.remove('hidden');
      if (infoText) {
        infoText.innerHTML = `Este reporte fue firmado digitalmente el <b>${report.date}</b> a las <b>${report.time}</b> por el operador <b>${report.operator}</b>.`;
      }

      const btnCancelar = document.getElementById('btn-cancelar-cierre');
      if (btnCancelar) btnCancelar.classList.add('hidden');

      const btnFirmar = document.querySelector('button[onclick="firmarYCerrarTurno()"]');
      if (btnFirmar) btnFirmar.classList.add('hidden');

      // Cambiar encabezados
      const headerTitle = document.getElementById('cierre-header-titulo');
      const headerSub = document.getElementById('cierre-header-subtitulo');
      if (headerTitle) headerTitle.innerText = `Reporte de Cierre Histórico (${report.date})`;
      if (headerSub) headerSub.innerText = "Detalle general de balances, piezas de arqueo y saldos registrados.";

      // 2. Rellenar KPIs del reporte histórico
      const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
      const totalContado = report.totalContado || 0;
      const expectedTotal = (report.expectedCajon || 0) + (report.expectedBoveda || 0);
      const diffTotal = report.diffTotal || 0;

      const balances = report.balances || {};
      const totalDigital = (balances.yastasTerminal || 0) + (balances.capitalTerminal || 0) + (balances.tconecta || 0) + (balances.banamex || 0);
      const granTotal = (report.expectedCajon || 0) + totalDigital;

      const kpiEfectivoVal = document.getElementById('cierre-kpi-efectivo');
      if (kpiEfectivoVal) kpiEfectivoVal.innerText = fmt.format(totalContado);

      const kpiDiffVal = document.getElementById('cierre-kpi-efectivo-diff');
      if (kpiDiffVal) {
        if (diffTotal === 0) {
          kpiDiffVal.innerText = "Caja cuadrada";
          kpiDiffVal.className = "text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1";
        } else if (diffTotal > 0) {
          kpiDiffVal.innerText = `Sobrante: +${fmt.format(diffTotal)}`;
          kpiDiffVal.className = "text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1";
        } else {
          kpiDiffVal.innerText = `Faltante: -${fmt.format(Math.abs(diffTotal))}`;
          kpiDiffVal.className = "text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1";
        }
      }

      const kpiDigitalVal = document.getElementById('cierre-kpi-digital');
      if (kpiDigitalVal) kpiDigitalVal.innerText = fmt.format(totalDigital);

      const kpiTotalVal = document.getElementById('cierre-kpi-total');
      if (kpiTotalVal) kpiTotalVal.innerText = fmt.format(granTotal);

      const kpiOperadorVal = document.getElementById('cierre-kpi-operador');
      if (kpiOperadorVal) kpiOperadorVal.innerText = report.operator || 'Desconocido';

      // 3. Rellenar Tabla Comparadora de Piezas (Bloqueada)
      const countedInventory = report.countedInventory || {};
      const expectedInv = report.combinedExpectedInventory || {};

      denoms.forEach(id => {
        const input = document.getElementById(`cierre-pz-${id}`);
        const cntKey = (id === '05' || id === '0.5') ? '0.5' : id;
        const cnt = (countedInventory[id] !== undefined) ? countedInventory[id] : (countedInventory[cntKey] || 0);
        if (input) {
          input.value = cnt;
          input.disabled = true;
          input.classList.add('bg-slate-100/60', 'dark:bg-slate-900/60', 'cursor-not-allowed');
        }

        const espKey = (id === '05' || id === '0.5') ? '0.5' : id;
        const esp = (expectedInv[id] !== undefined) ? expectedInv[id] : (expectedInv[espKey] || 0);
        const espEl = document.getElementById(`cierre-cmp-${id}-esp`);
        if (espEl) espEl.innerText = String(esp);

        const diff = cnt - esp;
        const difEl = document.getElementById(`cierre-cmp-${id}-dif`);
        if (difEl) {
          if (diff === 0) {
            difEl.innerText = '0';
            difEl.className = 'text-xs font-black text-right font-mono text-emerald-500';
          } else if (diff > 0) {
            difEl.innerText = `+${diff}`;
            difEl.className = 'text-xs font-black text-right font-mono text-amber-500';
          } else {
            difEl.innerText = `${diff}`;
            difEl.className = 'text-xs font-black text-right font-mono text-rose-500';
          }
        }
      });

      // 4. Totales de Efectivo Físico
      const resCajon = document.getElementById('cierre-resumen-cajon-val');
      if (resCajon) resCajon.innerText = fmt.format(report.expectedCajon || 0);

      const resBoveda = document.getElementById('cierre-resumen-boveda-val');
      if (resBoveda) resBoveda.innerText = fmt.format(report.expectedBoveda || 0);

      const resTotal = document.getElementById('cierre-resumen-total-val');
      if (resTotal) resTotal.innerText = fmt.format(expectedTotal);

      const resReal = document.getElementById('cierre-resumen-real-val');
      if (resReal) resReal.innerText = fmt.format(totalContado);

      const resDiff = document.getElementById('cierre-resumen-diff-val');
      if (resDiff) {
        if (diffTotal === 0) {
          resDiff.innerText = "Caja cuadrada";
          resDiff.className = "font-black text-emerald-600 dark:text-emerald-400 font-mono";
        } else if (diffTotal > 0) {
          resDiff.innerText = `Sobrante: +${fmt.format(diffTotal)}`;
          resDiff.className = "font-black text-amber-600 dark:text-amber-400 font-mono";
        } else {
          resDiff.innerText = `Faltante: -${fmt.format(Math.abs(diffTotal))}`;
          resDiff.className = "font-black text-rose-600 dark:text-rose-400 font-mono";
        }
      }

      // 5. Gráfica Donut Live
      const donutTotalLabel = document.getElementById('cierre-donut-total-live');
      if (donutTotalLabel) donutTotalLabel.innerText = fmt.format(totalDigital);

      const segmentsContainer = document.getElementById('cierre-donut-segments-live');
      const legendsContainer = document.getElementById('cierre-donut-legends-live');

      if (segmentsContainer && legendsContainer) {
        segmentsContainer.innerHTML = '';
        legendsContainer.innerHTML = '';

        if (totalDigital === 0) {
          segmentsContainer.innerHTML = `
            <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#475569" stroke-width="4.5"></circle>
          `;
          legendsContainer.innerHTML = `
            <div class="flex items-center justify-between text-slate-400">
              <span>Sin saldos activos</span>
              <span>$0.00</span>
            </div>
          `;
        } else {
          const channels = [
            { name: 'Yestas', val: balances.yastasTerminal || 0, color: '#a855f7' },
            { name: 'Mercado Libre', val: balances.capitalTerminal || 0, color: '#eab308' },
            { name: 'T-Conecta', val: balances.tconecta || 0, color: '#06b6d4' },
            { name: 'Banamex', val: balances.banamex || 0, color: '#1e40af' }
          ];

          let accumulatedPercentage = 0;
          channels.forEach(ch => {
            const percentage = (ch.val / totalDigital) * 100;
            if (percentage > 0) {
              const dashArray = `${percentage} ${100 - percentage}`;
              const dashOffset = 100 - accumulatedPercentage + 25;
              
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("class", "donut-segment");
              circle.setAttribute("cx", "21");
              circle.setAttribute("cy", "21");
              circle.setAttribute("r", "15.91549430918954");
              circle.setAttribute("fill", "transparent");
              circle.setAttribute("stroke", ch.color);
              circle.setAttribute("stroke-width", "4.5");
              circle.setAttribute("stroke-dasharray", dashArray);
              circle.setAttribute("stroke-dashoffset", String(dashOffset));
              segmentsContainer.appendChild(circle);

              accumulatedPercentage += percentage;
            }

            const pctText = percentage > 0 ? `${percentage.toFixed(0)}%` : '0%';
            const leg = document.createElement('div');
            leg.className = "flex items-center justify-between";
            leg.innerHTML = `
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${ch.color}"></span>
                <span class="text-slate-700 dark:text-slate-300 font-semibold">${ch.name}</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold">(${pctText})</span>
              </div>
              <span class="text-slate-900 dark:text-white font-mono font-bold">${fmt.format(ch.val)}</span>
            `;
            legendsContainer.appendChild(leg);
          });
        }
      }

      // 6. Depósitos Bancarios Informativos Históricos
      const bbvaLive = document.getElementById('cierre-banco-bbva-live');
      if (bbvaLive) bbvaLive.innerText = fmt.format(balances.bbva || 0);

      const banorteLive = document.getElementById('cierre-banco-banorte-live');
      if (banorteLive) banorteLive.innerText = fmt.format(balances.banorte || 0);

      const banamexLive = document.getElementById('cierre-banco-banamex-live');
      if (banamexLive) banamexLive.innerText = fmt.format(balances.banamex || 0);

      lucide.createIcons();
    }

    function restaurarCierreModoInteractivo() {
      const banner = document.getElementById('cierre-historico-banner');
      if (banner) banner.classList.add('hidden');

      const btnCancelar = document.getElementById('btn-cancelar-cierre');
      if (btnCancelar) btnCancelar.classList.remove('hidden');

      const btnFirmar = document.querySelector('button[onclick="firmarYCerrarTurno()"]');
      if (btnFirmar) btnFirmar.classList.remove('hidden');

      // Restaurar encabezados
      const headerTitle = document.getElementById('cierre-header-titulo');
      const headerSub = document.getElementById('cierre-header-subtitulo');
      if (headerTitle) headerTitle.innerText = "Corte de Caja de Turno Activo";
      if (headerSub) headerSub.innerText = "Capture el conteo de efectivo y verifique los balances antes de firmar.";

      // Habilitar de nuevo inputs y quitar estilos
      const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
      denoms.forEach(id => {
        const input = document.getElementById(`cierre-pz-${id}`);
        if (input) {
          input.disabled = false;
          input.classList.remove('bg-slate-100/60', 'dark:bg-slate-900/60', 'cursor-not-allowed');
        }
      });
    }

    function regresarAlTurnoActivoDespuesDeVerHistorico() {
      const filtroFecha = document.getElementById('filtro-fecha');
      if (!filtroFecha) return;

      const state = DB.get('state', {});
      let targetDate = '';
      if (sessionActive && state.apertura_date) {
        targetDate = state.apertura_date;
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        targetDate = `${year}-${month}-${day}`;
      }

      filtroFecha.value = targetDate;
      
      // Forzar salida del modo histórico de cierre y restaurar pantallas
      viendoHistoricoCierre = false;
      restaurarCierreModoInteractivo();

      const cierreView = document.getElementById('dash-cierre-view');
      if (cierreView) cierreView.classList.add('hidden');

      if (sessionActive) {
        mostrarSubvista('bitacora');
        mostrarToast("Visualizando el turno activo", "info");
      } else {
        refrescarPantallas();
        mostrarToast("Turno activo cerrado. Visualizando inicio de turno.", "info");
      }
      
      cargarBitacora();
    }

    function obtenerExpectedCombinedInventory() {
      const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
      const expectedInventory = DB.get('inventory', {});
      const expectedBovedaInventory = DB.get('inventoryBoveda', {});
      const combined = {};
      denoms.forEach(d => {
        const invKey = (d === '05' || d === '0.5') ? '0.5' : d;
        const cajonPz = (expectedInventory[invKey] !== undefined) ? expectedInventory[invKey] : (expectedInventory[d] || 0);
        const bovedaPz = (expectedBovedaInventory[invKey] !== undefined) ? expectedBovedaInventory[invKey] : (expectedBovedaInventory[d] || 0);
        const totalPz = cajonPz + bovedaPz;
        combined[d] = totalPz;
        combined[invKey] = totalPz;
      });
      return combined;
    }

    function cargarBilletesAyer() {
      const reports = DB.get('cierre_reports', {});
      const dates = Object.keys(reports).sort();
      if (dates.length === 0) {
        mostrarToast("No hay reportes de cierre anteriores registrados.", "warning");
        return;
      }
      
      const lastDate = dates[dates.length - 1];
      const lastReport = reports[lastDate];
      if (!lastReport || !lastReport.countedInventory) {
        mostrarToast("No se encontraron piezas registradas en el último corte.", "warning");
        return;
      }

      const denoms = ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1', '05'];
      let loadedSum = 0;
      
      denoms.forEach(id => {
        const input = document.getElementById(`apertura-${id}`);
        const pz = lastReport.countedInventory[id] || 0;
        if (input) {
          input.value = pz > 0 ? pz : '';
        }
        const val = id === '05' ? 0.5 : parseInt(id);
        loadedSum += pz * val;
      });

      // Actualizar total en la UI de apertura
      const totalLabel = document.getElementById('apertura-total-caja');
      if (totalLabel) {
        totalLabel.innerText = fmt.format(loadedSum);
      }
      
      // Cargar el saldo final de la terminal Yastas de ayer como saldo inicial de hoy
      const yastasTerminalInput = document.getElementById('apertura-yastas');
      if (yastasTerminalInput) {
        const yastasTerminalYesterday = lastReport.balances && typeof lastReport.balances.yastasTerminal !== 'undefined'
          ? lastReport.balances.yastasTerminal
          : 0;
        yastasTerminalInput.value = yastasTerminalYesterday > 0 ? yastasTerminalYesterday.toFixed(2) : '0.00';
      }
      
      calcularTotalLocal();
      mostrarToast(`Billetes cargados del corte del ${lastDate}. Total: ${fmt.format(loadedSum)}`, "success");
    }

    function renderizarReporteVisual(fecha) {
      const reports = DB.get('cierre_reports', {});
      const report = reports[fecha];

      const noReportMsg = document.getElementById('corte-no-report-msg');
      const dashboard = document.getElementById('corte-report-dashboard');

      if (!report) {
        if (noReportMsg) noReportMsg.classList.remove('hidden');
        if (dashboard) dashboard.classList.add('hidden');
        return;
      }

      if (noReportMsg) noReportMsg.classList.add('hidden');
      if (dashboard) {
        dashboard.classList.remove('hidden');
        lucide.createIcons();
      }

      // Rango de Horarios de Apertura y Cierre
      const openTimeEl = document.getElementById('corte-report-apertura-time');
      const closeTimeEl = document.getElementById('corte-report-cierre-time');
      if (openTimeEl) {
        openTimeEl.innerText = report.apertura_date 
          ? `${report.apertura_date} a las ${report.apertura_time}`
          : report.apertura_time || '--:--:--';
      }
      if (closeTimeEl) {
        closeTimeEl.innerText = `${report.date} a las ${report.time}`;
      }

      // KPIs
      document.getElementById('kpi-corte-efectivo').innerText = fmt.format(report.totalContado);
      
      const diffEl = document.getElementById('kpi-corte-efectivo-diff');
      if (diffEl) {
        if (report.diffTotal === 0) {
          diffEl.innerText = "Caja cuadrada";
          diffEl.className = "text-[10px] font-bold text-emerald-400 mt-1";
        } else if (report.diffTotal > 0) {
          diffEl.innerText = `Sobrante: +${fmt.format(report.diffTotal)}`;
          diffEl.className = "text-[10px] font-bold text-amber-400 mt-1";
        } else {
          diffEl.innerText = `Faltante: -${fmt.format(Math.abs(report.diffTotal))}`;
          diffEl.className = "text-[10px] font-bold text-rose-450 mt-1";
        }
      }

      const totalDigital = (report.balances.yastasTerminal || 0) + (report.balances.capitalTerminal || 0) + (report.balances.tconecta || 0) + (report.balances.banamex || 0);
      document.getElementById('kpi-corte-digital').innerText = fmt.format(totalDigital);
      
      const totalGlobal = report.expectedCajon + totalDigital;
      document.getElementById('kpi-corte-total').innerText = fmt.format(totalGlobal);
      
      document.getElementById('kpi-corte-firma').innerText = report.operator || 'Miguel Angel';

      // Comparativa de Piezas
      const denoms = [
        { id: '1000', val: 1000 },
        { id: '500', val: 500 },
        { id: '200', val: 200 },
        { id: '100', val: 100 },
        { id: '50', val: 50 },
        { id: '20', val: 20 },
        { id: '10', val: 10 },
        { id: '5', val: 5 },
        { id: '2', val: 2 },
        { id: '1', val: 1 },
        { id: '05', val: 0.5 }
      ];

      const tbody = document.getElementById('corte-comparativa-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        denoms.forEach(d => {
          const exp = report.combinedExpectedInventory[d.id] || 0;
          const cnt = report.countedInventory[d.id] || 0;
          const diff = cnt - exp;
          
          const tr = document.createElement('tr');
          tr.className = "border-b border-slate-700/30 text-slate-300";
          
          let diffClass = 'text-slate-400';
          let diffText = '0';
          if (diff > 0) {
            diffClass = 'text-emerald-400';
            diffText = `+${diff}`;
          } else if (diff < 0) {
            diffClass = 'text-rose-400';
            diffText = `${diff}`;
          }

          tr.innerHTML = `
            <td class="py-1.5 font-bold text-white">${d.val >= 1 ? `$${d.val}` : `${d.val * 100}¢`}</td>
            <td class="py-1.5 text-center text-slate-400">${exp} pz</td>
            <td class="py-1.5 text-center text-slate-200">${cnt} pz</td>
            <td class="py-1.5 text-center ${diffClass}">${diffText}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Sección 2: Desglose Físico Identificado
      document.getElementById('corte-resumen-cajon-esperado').innerText = fmt.format(report.expectedCajon);
      document.getElementById('corte-resumen-boveda-esperado').innerText = fmt.format(report.expectedBoveda);
      const expectedTotal = report.expectedCajon + report.expectedBoveda;
      document.getElementById('corte-resumen-total-esperado').innerText = fmt.format(expectedTotal);
      document.getElementById('corte-resumen-total-contado').innerText = fmt.format(report.totalContado);
      
      const diffRes = document.getElementById('corte-resumen-diferencia');
      if (diffRes) {
        if (report.diffTotal === 0) {
          diffRes.innerText = "Caja cuadrada";
          diffRes.className = "font-black text-emerald-400 font-mono";
        } else if (report.diffTotal > 0) {
          diffRes.innerText = `Sobrante: +${fmt.format(report.diffTotal)}`;
          diffRes.className = "font-black text-amber-400 font-mono";
        } else {
          diffRes.innerText = `Faltante: -${fmt.format(Math.abs(report.diffTotal))}`;
          diffRes.className = "font-black text-rose-450 font-mono";
        }
      }

      // Sección 3: Bóveda
      document.getElementById('corte-boveda-in').innerText = fmt.format(report.bovedaIn || 0);
      document.getElementById('corte-boveda-out').innerText = fmt.format(report.bovedaOut || 0);
      document.getElementById('corte-boveda-recoger').innerText = fmt.format(report.expectedBoveda);

      // Sección 4: Gráfica Donut y Leyendas
      const yastas = report.balances.yastasTerminal || 0;
      const meli = report.balances.capitalTerminal || 0;
      const tconecta = report.balances.tconecta || 0;
      const banamex = report.balances.banamex || 0;
      const totalSaldos = yastas + meli + tconecta + banamex;

      document.getElementById('corte-donut-total-label').innerText = fmt.format(totalSaldos);

      const segmentsContainer = document.getElementById('corte-donut-segments');
      const legendsContainer = document.getElementById('corte-donut-legends');
      
      if (segmentsContainer && legendsContainer) {
        segmentsContainer.innerHTML = '';
        legendsContainer.innerHTML = '';

        if (totalSaldos === 0) {
          // Si todo está en cero, dibujar anillo gris
          segmentsContainer.innerHTML = `
            <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#475569" stroke-width="4.5"></circle>
          `;
          legendsContainer.innerHTML = `
            <div class="flex items-center justify-between text-slate-400">
              <span>Sin saldos activos</span>
              <span>$0.00</span>
            </div>
          `;
        } else {
          const channels = [
            { name: 'Yastas', val: yastas, color: '#a855f7', stroke: '#a855f7' },
            { name: 'Mercado Libre', val: meli, color: '#eab308', stroke: '#eab308' },
            { name: 'T-Conecta', val: tconecta, color: '#06b6d4', stroke: '#06b6d4' },
            { name: 'Banamex', val: banamex, color: '#1e40af', stroke: '#1e40af' }
          ];

          let accumulatedPercentage = 0;
          channels.forEach(ch => {
            const percentage = (ch.val / totalSaldos) * 100;
            if (percentage > 0) {
              const dashArray = `${percentage} ${100 - percentage}`;
              const dashOffset = 100 - accumulatedPercentage + 25; // Iniciar arriba (12 en punto)
              
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("class", "donut-segment");
              circle.setAttribute("cx", "21");
              circle.setAttribute("cy", "21");
              circle.setAttribute("r", "15.91549430918954");
              circle.setAttribute("fill", "transparent");
              circle.setAttribute("stroke", ch.color);
              circle.setAttribute("stroke-width", "4.5");
              circle.setAttribute("stroke-dasharray", dashArray);
              circle.setAttribute("stroke-dashoffset", String(dashOffset));
              segmentsContainer.appendChild(circle);

              accumulatedPercentage += percentage;
            }

            // Legend
            const pctText = percentage > 0 ? `${percentage.toFixed(0)}%` : '0%';
            const leg = document.createElement('div');
            leg.className = "flex items-center justify-between";
            leg.innerHTML = `
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${ch.color}"></span>
                <span class="text-slate-300 font-semibold">${ch.name}</span>
                <span class="text-[10px] text-slate-500 font-bold">(${pctText})</span>
              </div>
              <span class="text-white font-mono font-bold">${fmt.format(ch.val)}</span>
            `;
            legendsContainer.appendChild(leg);
          });
        }
      }

      // Sección 6: Control de Bancos
      document.getElementById('corte-banco-bbva').innerText = fmt.format(report.balances.bbva || 0);
      document.getElementById('corte-banco-banorte').innerText = fmt.format(report.balances.banorte || 0);
      document.getElementById('corte-banco-banamex').innerText = fmt.format(report.balances.banamex || 0);
    }

    function cargarSimulacion() {
      if (!sessionActive) {
        mostrarToast("Inicie sesión/turno primero antes de cargar la simulación.", "warning");
        return;
      }

      // 1. Rellenar saldos de terminales
      const balances = DB.get('balances', {});
      balances.yastasEfectivo = 10000;
      balances.yastasTerminal = 8400;
      balances.capitalTerminal = 3500; // Meli Negocio
      balances.tconecta = 100; // Recarga Efectivo
      balances.bbva = 2000;
      balances.banorte = 1200; // Unified Banorte
      balances.transferencia = 0; // Cleared
      balances.banamex = 450; // New Banamex card balance ($150 + $300)
      balances.boveda = 4000;
      DB.set('balances', balances);

      // 2. Rellenar inventario de piezas en el cajón (Suma $10,000)
      const mockInventory = {
        '1000': 2, // $2,000
        '500': 10, // $5,000
        '200': 5,  // $1,000
        '100': 8,  // $800
        '50': 12,  // $600
        '20': 15,  // $300
        '10': 20,  // $200
        '5': 15,   // $75
        '2': 10,   // $20
        '1': 5,    // $5
        '05': 0    // $0
      };
      DB.set('inventory', mockInventory);

      // 3. Rellenar inventario de piezas en la Bóveda (Suma $4,000)
      const mockBovedaInventory = {
        '1000': 2, // $2,000
        '500': 4,  // $2,000
        '200': 0,
        '100': 0,
        '50': 0,
        '20': 0,
        '10': 0,
        '5': 0,
        '2': 0,
        '1': 0,
        '05': 0
      };
      DB.set('inventoryBoveda', mockBovedaInventory);

      // 4. Registrar movimientos ficticios en bitácora
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = now.toLocaleTimeString() + ' PM';

      const mockLogs = [
        { id: 101, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'YASTAS', amount: 1500, details: 'Depósito regular en efectivo Yastas', inventory: mockInventory },
        { id: 102, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'YASTAS', amount: -800, details: 'Retiro regular de cliente Yastas', inventory: mockInventory },
        { id: 103, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'YASTAS_RECARGA', amount: 200, details: 'Recarga telefónica Efectivo Yastas', inventory: mockInventory },
        { id: 104, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'YASTAS_RECARGA', amount: 0, details: 'Recarga telefónica Terminal Yastas', inventory: mockInventory },
        { id: 105, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'BBVA', amount: -2000, details: 'Retiro por Exceso de Efectivo (BBVA)', inventory: mockInventory },
        { id: 106, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'MELI', amount: 3500, details: 'Venta Negocio Meli Terminal', inventory: mockInventory },
        { id: 107, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'BANORTE', amount: 1200, details: 'Pago con tarjeta Banorte Terminal', inventory: mockInventory },
        { id: 108, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'CAJA', amount: -5000, details: 'Envío de Efectivo a Bóveda', inventory: mockInventory },
        { id: 109, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'CAJA', amount: 1000, details: 'Retiro de cambio de Bóveda', inventory: mockInventory },
        { id: 110, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'TCONECTA_RECARGA_EFECTIVO', amount: 100, details: 'Recarga telefónica T-Conecta (Efectivo)', inventory: mockInventory },
        { id: 111, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'TCONECTA_RECARGA_TARJETA', amount: 150, details: 'Recarga telefónica T-Conecta (Tarjeta) - Destino: Cuenta Banamex', inventory: mockInventory },
        { id: 112, operator: activeOperator || 'Administrador', date: dateStr, time: timeStr, category: 'TCONECTA_RETIRO', amount: -300, details: 'Retiro con tarjeta T-Conecta - Destino: Cuenta Banamex', inventory: mockInventory }
      ];

      DB.set('logs', mockLogs);

      // También registrar en bitácora histórica
      const historical = DB.get('historical_logs_by_date', {});
      if (!historical[dateStr]) historical[dateStr] = [];
      mockLogs.forEach(l => {
        historical[dateStr].unshift(l);
      });
      DB.set('historical_logs_by_date', historical);

      mostrarToast("Simulación de Turno cargada con éxito.", "success");
      refrescarPantallas();
    }

    function cancelarCierreTurno() {
      mostrarSubvista('tablero');
    }

    function calcularBovedaOperacion() {
      const srv = document.getElementById('op-service').value;
      if (!sessionActive || srv !== 'caja') {
        const wrapper = document.getElementById('op-boveda-helper-wrapper');
        if (wrapper) wrapper.classList.add('hidden');
        return;
      }

      const inputMonto = document.getElementById('op-monto-boveda');
      const targetMonto = inputMonto ? parseFloat(inputMonto.value) || 0 : 0;
      const wrapper = document.getElementById('op-boveda-helper-wrapper');
      if (!wrapper) return;

      if (targetMonto <= 0) {
        wrapper.classList.add('hidden');
        return;
      }

      wrapper.classList.remove('hidden');

      // Calcular sumCharola (suma de la charola)
      let sumCharola = 0;
      const inputs = document.querySelectorAll('.denom-input-field[id^="dash-"]');
      inputs.forEach(inp => {
        const denom = parseFloat(inp.getAttribute('data-denom'));
        const cant = parseInt(inp.value) || 0;
        sumCharola += denom * cant;
      });

      const btn = document.getElementById('btn-procesar-operacion');

      if (sumCharola < targetMonto) {
        const falta = parseFloat((targetMonto - sumCharola).toFixed(2));
        wrapper.innerHTML = `
          <div class="text-center py-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl shadow-xs">
            <span class="text-[9px] font-black text-rose-500 dark:text-rose-450 uppercase tracking-wider block mb-0.5">Falta por ingresar en charola</span>
            <span class="text-xl font-black text-rose-600 dark:text-rose-400">${fmt.format(falta)}</span>
          </div>
        `;
        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Falta Efectivo (${fmt.format(falta)})`;
          lucide.createIcons();
        }
      } else if (sumCharola > targetMonto) {
        const sobra = parseFloat((sumCharola - targetMonto).toFixed(2));
        wrapper.innerHTML = `
          <div class="text-center py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl shadow-xs">
            <span class="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-wider block mb-0.5">Sobra en charola (Excede)</span>
            <span class="text-xl font-black text-amber-600 dark:text-amber-400">${fmt.format(sobra)}</span>
          </div>
        `;
        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="alert-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Sobra Efectivo (${fmt.format(sobra)})`;
          lucide.createIcons();
        }
      } else {
        wrapper.innerHTML = `
          <div class="text-center py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl shadow-xs">
            <span class="text-[9px] font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-wider block mb-0.5">Monto Cuadrado Exacto</span>
            <span class="text-xl font-black text-emerald-600 dark:text-emerald-400">${fmt.format(sumCharola)}</span>
          </div>
        `;
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-50', 'cursor-not-allowed');
          btn.innerHTML = `<i data-lucide="check-circle" class="w-4.5 h-4.5 mr-1 inline"></i> Autorizar Bóveda`;
          lucide.createIcons();
        }
      }
    }

    let sumaRapidaSeleccionados = [];

    function actualizarSumaRapidaCierre() {
      const container = document.getElementById('cierre-suma-rapida-list');
      if (!container) return;

      const balances = DB.get('balances', {});
      const expectedBoveda = balances.boveda || 0;
      
      let totalContado = 0;
      const denoms = [
        { id: '1000', val: 1000 },
        { id: '500', val: 500 },
        { id: '200', val: 200 },
        { id: '100', val: 100 },
        { id: '50', val: 50 },
        { id: '20', val: 20 },
        { id: '10', val: 10 },
        { id: '5', val: 5 },
        { id: '2', val: 2 },
        { id: '1', val: 1 },
        { id: '05', val: 0.5 }
      ];
      denoms.forEach(d => {
        const input = document.getElementById(`cierre-pz-${d.id}`);
        const pz = input ? parseInt(input.value) || 0 : 0;
        totalContado += pz * d.val;
      });

      const itemsSuma = [
        { key: 'caja', name: 'Efectivo Contado (Caja)', val: totalContado },
        { key: 'boveda', name: 'Efectivo Bóveda (Esperado)', val: expectedBoveda },
        { key: 'yastas', name: 'Yastas Terminal', val: balances.yastasTerminal || 0 },
        { key: 'meli', name: 'Mercado Libre (Terminal)', val: balances.capitalTerminal || 0 },
        { key: 'tconecta', name: 'T-Conecta (Efectivo)', val: balances.tconecta || 0 },
        { key: 'bbva', name: 'BBVA (Fondeo)', val: balances.bbva || 0 },
        { key: 'banorte', name: 'Cuenta Banorte', val: balances.banorte || 0 },
        { key: 'banamex', name: 'Cuenta Banamex', val: balances.banamex || 0 }
      ];

      let totalAcumulado = 0;
      let html = '';

      itemsSuma.forEach(item => {
        const isActive = sumaRapidaSeleccionados.includes(item.key);
        if (isActive) {
          totalAcumulado += item.val;
        }

        html += `
          <div onclick="toggleSumaRapidaItem('${item.key}')" class="flex justify-between items-center p-2.5 rounded-xl border transition duration-150 cursor-pointer select-none ${
            isActive 
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800' 
              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
          }">
            <div class="flex items-center gap-2 text-xs">
              <div class="w-5 h-5 rounded-md flex items-center justify-center ${
                isActive 
                  ? 'bg-indigo-650 text-white' 
                  : 'bg-slate-150 dark:bg-slate-800 text-slate-450 dark:text-slate-500'
              }">
                <i data-lucide="${isActive ? 'check' : 'plus'}" class="w-3.5 h-3.5"></i>
              </div>
              <span class="font-extrabold ${isActive ? 'text-indigo-950 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}">${item.name}</span>
            </div>
            <span class="font-black font-mono text-xs ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-450'}">${fmt.format(item.val)}</span>
          </div>
        `;
      });

      container.innerHTML = html;
      document.getElementById('cierre-suma-rapida-total').innerText = fmt.format(totalAcumulado);
      lucide.createIcons();
    }

    function toggleSumaRapidaItem(key) {
      const index = sumaRapidaSeleccionados.indexOf(key);
      if (index > -1) {
        sumaRapidaSeleccionados.splice(index, 1);
      } else {
        sumaRapidaSeleccionados.push(key);
      }
      actualizarSumaRapidaCierre();
    }

    // === INTEGRACIÓN CON GOOGLE SHEETS ===
    async function guardarCierreEnNube(payload, silent = false) {
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) {
        console.warn("URL de Google Sheets no configurada.");
        return false;
      }
      
      try {
        if (!silent) mostrarToast("Guardando reporte en Google Sheets...", "info");
        const response = await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8' // Evita CORS preflight OPTIONS en Google Apps Script
          }
        });
        const resJson = await response.json();
        return (resJson && resJson.status === "success");
      } catch (e) {
        console.error("Error al conectar con Google Sheets:", e);
        return false;
      }
    }

    function encolarCierrePendiente(payload) {
      const pending = DB.get('caja_pending_closures', []);
      pending.push(payload);
      DB.set('caja_pending_closures', pending);
    }

    async function intentarSubirCierresPendientes() {
      const pending = DB.get('caja_pending_closures', []);
      if (!pending || pending.length === 0) return;
      
      const remaining = [];
      let subidosCount = 0;
      
      for (let i = 0; i < pending.length; i++) {
        const payload = pending[i];
        if (payload.action === 'save_closure') payload.action = 'cierre';
        const success = await guardarCierreEnNube(payload, true); // silent = true para no molestar con toasts
        if (success) {
          subidosCount++;
        } else {
          remaining.push(payload);
        }
      }
      
      DB.set('caja_pending_closures', remaining);
      if (subidosCount > 0) {
        setTimeout(() => {
          mostrarToast(`Se respaldaron ${subidosCount} cierres pendientes en Google Sheets.`, "success");
        }, 1500);
      }
    }

    // === MÉTODOS DE SEGURIDAD GLOBAL Y SINCRONIZACIÓN EN VIVO ===
    function toggleGlobalPasswordVisibility() {
      const passwordInput = document.getElementById('global-lock-password');
      const toggleIcon = document.getElementById('global-password-toggle-icon');
      if (!passwordInput || !toggleIcon) return;
      
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
      } else {
        passwordInput.type = "password";
        toggleIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
    }

    async function desbloquearPlataforma() {
      const passwordInput = document.getElementById('global-lock-password');
      if (!passwordInput) return;
      const pass = passwordInput.value;
      if (!pass) {
        mostrarToast("Por favor escriba la contraseña.", "warning");
        return;
      }
      
      const errorDiv = document.getElementById('global-lock-error');
      if (errorDiv) errorDiv.classList.add('hidden');

      if (pass === "1234") {
        sessionStorage.setItem('caja_app_unlocked', 'true');
        document.getElementById('pantalla-bloqueo-global').classList.add('hidden');
        document.getElementById('app-wrapper').classList.remove('hidden');
        inicializarSistemaDespuesDeDesbloqueo();
        mostrarToast("Desbloqueado con clave local/maestra.", "success");
        return;
      }
      
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) {
        // Fallback local por defecto si no hay URL
        if (pass === "1234") {
          sessionStorage.setItem('caja_app_unlocked', 'true');
          document.getElementById('pantalla-bloqueo-global').classList.add('hidden');
          document.getElementById('app-wrapper').classList.remove('hidden');
          inicializarSistemaDespuesDeDesbloqueo();
        } else {
          if (errorDiv) errorDiv.classList.remove('hidden');
        }
        return;
      }
      
      try {
        const payload = {
          action: "verify_password",
          password: pass,
          token: SECURITY_TOKEN
        };
        
        mostrarToast("Validando contraseña de entrada...", "info");
        const response = await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          }
        });
        const resJson = await response.json();
        
        if (resJson && resJson.status === "success" && resJson.authenticated) {
          sessionStorage.setItem('caja_app_unlocked', 'true');
          document.getElementById('pantalla-bloqueo-global').classList.add('hidden');
          document.getElementById('app-wrapper').classList.remove('hidden');
          inicializarSistemaDespuesDeDesbloqueo();
        } else {
          if (errorDiv) errorDiv.classList.remove('hidden');
          passwordInput.value = '';
          passwordInput.focus();
        }
      } catch (e) {
        console.error("Error al validar contraseña:", e);
        // Fallback en caso de error de red: permitir desbloqueo si coincide con clave básica
        if (pass === "1234") {
          sessionStorage.setItem('caja_app_unlocked', 'true');
          document.getElementById('pantalla-bloqueo-global').classList.add('hidden');
          document.getElementById('app-wrapper').classList.remove('hidden');
          inicializarSistemaDespuesDeDesbloqueo();
          mostrarToast("Ingreso en modo sin conexión (Red offline).", "warning");
        } else {
          mostrarToast("Error de conexión al servidor de seguridad.", "error");
        }
      }
    }

    async function guardarNuevaContraseniaGlobal() {
      const input = document.getElementById('nueva-contrasenia-global');
      const confirmInput = document.getElementById('confirmar-contrasenia-global');
      if (!input || !confirmInput) return;
      
      const newPass = input.value.trim();
      const confirmPass = confirmInput.value.trim();
      
      if (!newPass) {
        mostrarToast("Escriba la nueva contraseña.", "warning");
        return;
      }
      
      if (newPass !== confirmPass) {
        mostrarToast("Las contraseñas no coinciden. Intente de nuevo.", "error");
        return;
      }
      
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) {
        mostrarToast("No se puede cambiar la contraseña: URL de Google Sheets no configurada.", "error");
        return;
      }
      
      const payload = {
        action: "update_password",
        new_password: newPass,
        token: SECURITY_TOKEN
      };
      
      try {
        mostrarToast("Actualizando contraseña en la nube...", "info");
        const response = await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          }
        });
        const resJson = await response.json();
        
        if (resJson && resJson.status === "success") {
          mostrarToast("Contraseña global actualizada con éxito.", "success");
          input.value = '';
          confirmInput.value = '';
          cerrarModalUsuarios();
        } else {
          mostrarToast("Error al guardar la nueva contraseña.", "error");
        }
      } catch (e) {
        console.error("Error al actualizar contraseña:", e);
        mostrarToast("Error de conexión. Intente más tarde.", "error");
      }
    }

    async function guardarEstadoActivoNube() {
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) return;
      
      const stateObj = {
        session_active: sessionActive,
        operator: activeOperator,
        opened_date: DB.get('state', {}).opened_date || null,
        opened_time: DB.get('state', {}).opened_time || null,
        balances: sessionActive ? DB.get('balances', {}) : {},
        inventory: sessionActive ? DB.get('inventory', {}) : {},
        inventoryBoveda: sessionActive ? DB.get('inventoryBoveda', {}) : {},
        logs: sessionActive ? DB.get('logs', []) : []
      };
      
      const payload = {
        action: "save_active_state",
        token: SECURITY_TOKEN,
        state: stateObj
      };
      
      try {
        await fetch(GOOGLE_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          }
        });
      } catch (e) {
        console.error("Error al guardar estado activo en la nube:", e);
      }
    }

    async function sincronizarEstadoActivoInicial() {
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) return;
      
      try {
        mostrarToast("Sincronizando estado con la nube...", "info");
        const response = await fetch(`${GOOGLE_WEB_APP_URL}?action=get_active_state`);
        const cloudState = await response.json();
        
        if (cloudState && cloudState.session_active) {
          // Cargar el estado activo desde la nube
          DB.set('state', {
            session_active: true,
            operator: cloudState.operator,
            opened_date: cloudState.opened_date,
            opened_time: cloudState.opened_time || "08:00:00"
          });
          sessionActive = true;
          activeOperator = cloudState.operator;
          
          if (cloudState.balances) DB.set('balances', cloudState.balances);
          if (cloudState.inventory) DB.set('inventory', cloudState.inventory);
          if (cloudState.inventoryBoveda) DB.set('inventoryBoveda', cloudState.inventoryBoveda);
          if (cloudState.logs) DB.set('logs', cloudState.logs);
          
          mostrarToast("Turno activo sincronizado desde la nube.", "success");
        } else {
          // No hay turno activo en la nube: forzar sesión cerrada localmente
          sessionActive = false;
          activeOperator = null;
          DB.set('state', { session_active: false, operator: null });
        }
        refrescarPantallas();
      } catch (e) {
        console.error("Error al sincronizar estado activo inicial:", e);
        mostrarToast("Error de conexión. Trabajando con datos locales.", "warning");
        refrescarPantallas();
      }
    }

    let prevCloudLogsHash = "";

    async function sincronizarEstadoActivoBackground() {
      if (!GOOGLE_WEB_APP_URL || GOOGLE_WEB_APP_URL.includes("INSERTA_AQUI")) return;
      try {
        const response = await fetch(`${GOOGLE_WEB_APP_URL}?action=get_active_state`);
        const cloudState = await response.json();
        
        if (cloudState && cloudState.session_active) {
          const currentLogs = cloudState.logs && Array.isArray(cloudState.logs) ? cloudState.logs : [];
          const newHash = `${currentLogs.length}_${cloudState.opened_date}_${JSON.stringify(cloudState.balances || {})}`;
          
          const wasActive = sessionActive;
          sessionActive = true;
          activeOperator = cloudState.operator;
          
          DB.set('state', {
            session_active: true,
            operator: cloudState.operator,
            opened_date: cloudState.opened_date,
            opened_time: cloudState.opened_time || "08:00:00"
          });

          if (cloudState.balances) DB.set('balances', cloudState.balances);
          if (cloudState.inventory) DB.set('inventory', cloudState.inventory);
          if (cloudState.inventoryBoveda) DB.set('inventoryBoveda', cloudState.inventoryBoveda);
          
          if (currentLogs.length > 0) {
            DB.set('logs', currentLogs);
            const historical = DB.get('historical_logs_by_date', {});
            currentLogs.forEach(log => {
              const dStr = log.date;
              if (dStr) {
                if (!historical[dStr]) historical[dStr] = [];
                const seen = new Set(historical[dStr].map(l => l ? l.id : null).filter(Boolean));
                if (!seen.has(log.id)) {
                  historical[dStr].unshift(log);
                }
              }
            });
            DB.set('historical_logs_by_date', historical);
          }

          if (newHash !== prevCloudLogsHash || !wasActive) {
            prevCloudLogsHash = newHash;
            refrescarPantallas();
            cargarBitacora();
          }
        } else if (sessionActive) {
          // Si el turno fue cerrado en otro dispositivo mientras este estaba abierto:
          sessionActive = false;
          activeOperator = null;
          DB.set('state', { session_active: false, operator: null });
          refrescarPantallas();
          mostrarToast("El turno fue cerrado desde otro dispositivo.", "warning");
        }
      } catch (e) {
        // Silencioso en fondo para no interrumpir la navegación del usuario
      }
    }

    function guardarNuevoPINAdmin() {
      const input = document.getElementById('nuevo-pin-admin');
      const confirmInput = document.getElementById('confirmar-pin-admin');
      if (!input || !confirmInput) return;
      
      const newPin = input.value.trim();
      const confirmPin = confirmInput.value.trim();
      
      if (!newPin) {
        mostrarToast("Escriba el nuevo PIN.", "warning");
        return;
      }
      
      if (newPin.length !== 3 || isNaN(newPin)) {
        mostrarToast("El PIN de administración debe ser exactamente de 3 números.", "error");
        return;
      }
      
      if (newPin !== confirmPin) {
        mostrarToast("Los PINs no coinciden. Intente de nuevo.", "error");
        return;
      }
      
      localStorage.setItem('caja_admin_settings_pin', newPin);
      ADMIN_SETTINGS_PIN = newPin;
      
      mostrarToast("PIN de administración actualizado con éxito.", "success");
      input.value = '';
      confirmInput.value = '';
      cerrarModalUsuarios();
    }
