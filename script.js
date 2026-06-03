/**
 * CESDE EduAsist - Core System Local Engine con Soporte XLSX & JSON Dual
 */

// ALMACENAMIENTO DE DATOS EN LOCALSTORAGE
let estudiantes = JSON.parse(localStorage.getItem('edu_estudiantes')) || [];
let asistencias = JSON.parse(localStorage.getItem('edu_asistencias')) || [];

// LISTA DE LAS 9 CARRERAS INSTITUCIONALES DEL CESDE
const CARRERAS_CESDE = [
    "Enfermería Técnica",
    "Gestión de Recursos Humanos",
    "Administración de Negocios Bancarios y Financieros",
    "Entrenamiento Deportivo",
    "Gestión administrativa",
    "Administración de Centros de Cómputo",
    "Contabilidad",
    "Asistencia administrativa",
    "Marketing"
];

// PARÁMETROS GLOBALES DE CONTROL EN MEMORIA
let estudiantePage = 1;
const estudianteRowsPerPage = 5;
let estudianteSortColumn = 'apellidos';
let estudianteSortAsc = true;

let asistenciaPage = 1;
const asistenciaRowsPerPage = 5;

let chartAsistenciasInstance = null;
let html5QrcodeScanner = null;

// CENTRALIZACIÓN DE ELEMENTOS SELECCIONADOS DEL DOM
const DOM = {
    menuButtons: document.querySelectorAll('.menu-btn'),
    modules: document.querySelectorAll('.module-view'),
    pageTitle: document.getElementById('page-title'),
    toggleSidebar: document.getElementById('toggle-sidebar'),
    sidebar: document.querySelector('.sidebar'),
    btnQuickQr: document.getElementById('btn-quick-qr'),
    bannerActionStart: document.getElementById('banner-action-start'),
    
    statEstudiantes: document.getElementById('stat-total-estudiantes'),
    statAsistencias: document.getElementById('stat-total-asistencias'),
    statTardanzas: document.getElementById('stat-total-tardanzas'),
    statFaltas: document.getElementById('stat-total-faltas'),
    metricPercentage: document.getElementById('metric-percentage'),
    metricProgress: document.getElementById('metric-progress'),
    
    btnNuevoEstudiante: document.getElementById('btn-nuevo-estudiante'),
    searchEstudiante: document.getElementById('search-estudiante'),
    tbodyEstudiantes: document.getElementById('tbody-estudiantes'),
    labelEstudiantes: document.getElementById('total-estudiantes-label'),
    paginationEstudiantes: document.getElementById('pagination-estudiantes'),
    thEstudiantes: document.querySelectorAll('#tabla-estudiantes th[data-sort]'),
    
    btnEscanearQr: document.getElementById('btn-escanear-qr'),
    qrContainer: document.getElementById('qr-reader-container'),
    btnCerrarScanner: document.getElementById('btn-cerrar-scanner'),
    tbodyAsistencias: document.getElementById('tbody-asistencias'),
    labelAsistencias: document.getElementById('total-asistencias-label'),
    paginationAsistencias: document.getElementById('pagination-asistencias'),
    
    filterFecha: document.getElementById('filter-fecha'),
    filterBusqueda: document.getElementById('filter-busqueda'),
    filterEstado: document.getElementById('filter-estado'),
    btnLimpiarFiltros: document.getElementById('btn-limpiar-filtros'),
    
    // Selectores del módulo dual de Respaldo
    btnExportarJson: document.getElementById('btn-exportar-json'),
    btnExportarExcel: document.getElementById('btn-exportar-excel'),
    btnTriggerJson: document.getElementById('btn-trigger-json'),
    btnTriggerExcel: document.getElementById('btn-trigger-excel'),
    inputImportarJson: document.getElementById('input-importar-json'),
    inputImportarExcel: document.getElementById('input-importar-excel')
};

// ACTIVACIÓN INICIAL DEL ENGINAL LOCAL
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEstudiantesModule();
    initAsistenciasModule();
    initRespaldoModule();
    updateDashboardMetrics();
});

function saveState() {
    localStorage.setItem('edu_estudiantes', JSON.stringify(estudiantes));
    localStorage.setItem('edu_asistencias', JSON.stringify(asistencias));
    updateDashboardMetrics();
}

function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GESTIÓN DEL MENÚ INTERACTIVO
function initNavigation() {
    DOM.menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            DOM.menuButtons.forEach(b => b.classList.remove('active'));
            DOM.modules.forEach(m => m.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
            DOM.pageTitle.textContent = btn.querySelector('span').textContent + " General";
            
            if (window.innerWidth <= 768) {
                DOM.sidebar.classList.remove('open');
                const ov = document.getElementById('sidebar-overlay');
                if (ov) ov.classList.remove('active');
            }
            if (target === 'mod-dashboard') updateDashboardMetrics();
            if (target === 'mod-estudiantes') renderEstudiantesTable();
            if (target === 'mod-asistencias') renderAsistenciasTable();
        });
    });

    if (DOM.toggleSidebar) {
        DOM.toggleSidebar.addEventListener('click', () => {
            DOM.sidebar.classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('active');
        });
    }

    // Cerrar sidebar al hacer clic en el overlay
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            DOM.sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    const triggerScannerAction = () => {
        const asistBtn = Array.from(DOM.menuButtons).find(b => b.getAttribute('data-target') === 'mod-asistencias');
        if (asistBtn) asistBtn.click();
        startQrScanner();
    };

    if (DOM.btnQuickQr) DOM.btnQuickQr.addEventListener('click', triggerScannerAction);
    if (DOM.bannerActionStart) DOM.bannerActionStart.addEventListener('click', triggerScannerAction);
}

// MONITOREO E HISTOGRAMAS DEL DASHBOARD
function updateDashboardMetrics() {
    const hoy = getLocalDateString();
    if (DOM.statEstudiantes) DOM.statEstudiantes.textContent = estudiantes.length;
    
    const asistenciasHoy = asistencias.filter(a => a.fecha === hoy);
    const countPresentes = asistenciasHoy.filter(a => a.estado === 'Presente').length;
    const countTardanzas = asistenciasHoy.filter(a => a.estado === 'Tardanza').length;
    
    // Cálculo de faltas del día actual: Alumnos activos que no pasaron QR hoy
    const dnisConRegistroHoy = asistenciasHoy.map(a => a.dni);
    const countFaltas = estudiantes.filter(e => e.estado === 'Activo' && !dnisConRegistroHoy.includes(e.dni)).length;
    
    if (DOM.statAsistencias) DOM.statAsistencias.textContent = countPresentes;
    if (DOM.statTardanzas) DOM.statTardanzas.textContent = countTardanzas;
    if (DOM.statFaltas) DOM.statFaltas.textContent = countFaltas;
    
    const totalAcciones = countPresentes + countTardanzas + countFaltas;
    if (totalAcciones > 0) {
        const porcentaje = Math.round(((countPresentes + countTardanzas) / totalAcciones) * 100);
        if (DOM.metricPercentage) DOM.metricPercentage.textContent = `${porcentaje}%`;
        if (DOM.metricProgress) DOM.metricProgress.style.width = `${porcentaje}%`;
    } else {
        if (DOM.metricPercentage) DOM.metricPercentage.textContent = '0%';
        if (DOM.metricProgress) DOM.metricProgress.style.width = '0%';
    }
    renderDashboardChart(countPresentes, countTardanzas, countFaltas);
}

function renderDashboardChart(p, t, f) {
    const canvas = document.getElementById('chart-asistencias-dia');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartAsistenciasInstance) chartAsistenciasInstance.destroy();
    const noData = (p === 0 && t === 0 && f === 0);
    
    chartAsistenciasInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: noData ? ['Sin Registros'] : ['Presentes', 'Tardanzas', 'Faltas'],
            datasets: [{
                data: noData ? [100] : [p, t, f],
                backgroundColor: noData ? ['#e2e8f0'] : ['#0066ff', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
            cutout: '75%'
        }
    });
}

// OPERACIONES Y RENDER DEL MÓDULO DE ALUMNOS
function initEstudiantesModule() {
    if (DOM.btnNuevoEstudiante) DOM.btnNuevoEstudiante.addEventListener('click', () => openEstudianteModal());
    if (DOM.searchEstudiante) DOM.searchEstudiante.addEventListener('input', () => { estudiantePage = 1; renderEstudiantesTable(); });

    DOM.thEstudiantes.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            estudianteSortAsc = (estudianteSortColumn === column) ? !estudianteSortAsc : true;
            estudianteSortColumn = column;
            renderEstudiantesTable();
        });
    });
}

function renderEstudiantesTable() {
    if (!DOM.tbodyEstudiantes) return;
    let query = DOM.searchEstudiante ? DOM.searchEstudiante.value.trim().toLowerCase() : '';
    let filtrados = estudiantes.filter(est => {
        return est.dni.includes(query) || est.nombres.toLowerCase().includes(query) || est.apellidos.toLowerCase().includes(query);
    });

    filtrados.sort((a, b) => {
        let fieldA = (a[estudianteSortColumn] || '').toString().toLowerCase();
        let fieldB = (b[estudianteSortColumn] || '').toString().toLowerCase();
        return estudianteSortAsc ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
    });

    const totalEstudiantes = filtrados.length;
    if (DOM.labelEstudiantes) DOM.labelEstudiantes.textContent = `Mostrando ${totalEstudiantes} estudiantes`;
    const totalPages = Math.ceil(totalEstudiantes / estudianteRowsPerPage) || 1;
    
    const startIndex = (estudiantePage - 1) * estudianteRowsPerPage;
    const paginados = filtrados.slice(startIndex, startIndex + estudianteRowsPerPage);

    DOM.tbodyEstudiantes.innerHTML = '';
    if (paginados.length === 0) {
        DOM.tbodyEstudiantes.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:30px;">No se encontraron registros.</td></tr>`;
        return;
    }

    paginados.forEach(est => {
        const estadoClass = (est.estado || 'Activo').toLowerCase() === 'activo' ? 'activo' : 'inactivo';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${est.dni}</strong></td>
            <td>${est.nombres}</td>
            <td>${est.apellidos}</td>
            <td>${est.edad || '-'}</td>
            <td>${est.genero || '-'}</td>
            <td>${est.carrera}</td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${est.ciclo}° Ciclo</span></td>
            <td><span class="badge ${estadoClass}">${est.estado}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-table edit-btn" onclick="openEstudianteModal('${est.dni}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-table delete-btn" onclick="deleteEstudiante('${est.dni}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        DOM.tbodyEstudiantes.appendChild(tr);
    });

    renderPaginationControls(DOM.paginationEstudiantes, totalPages, estudiantePage, (p) => { estudiantePage = p; renderEstudiantesTable(); });
}

function renderPaginationControls(container, totalPages, currentPage, onPageChange) {
    if (!container) return;
    container.innerHTML = '';
    const prevBtn = document.createElement('button');
    prevBtn.className = `page-link ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = `<i class="fa-solid fa-angle-left"></i>`;
    if (currentPage !== 1) prevBtn.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-link ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => onPageChange(i);
        container.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `page-link ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<i class="fa-solid fa-angle-right"></i>`;
    if (currentPage !== totalPages) nextBtn.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(nextBtn);
}

function openEstudianteModal(dniTarget = null) {
    const esEdicion = (dniTarget !== null);
    let est = { dni: '', nombres: '', apellidos: '', carrera: 'Administración de Centros de Cómputo', ciclo: '1', edad: '', genero: 'Masculino', estado: 'Activo' };
    if (esEdicion) est = estudiantes.find(e => e.dni === dniTarget) || est;

    let opcionesCarreraHTML = CARRERAS_CESDE.map(c => `<option value="${c}" ${est.carrera === c ? 'selected' : ''}>${c}</option>`).join('');

    Swal.fire({
        title: esEdicion ? 'Editar Registro de Alumno' : 'Ingresar Nuevo Alumno',
        background: '#ffffff',
        color: '#070f24',
        html: `
            <div style="display: flex; flex-direction: column; gap: 14px; text-align: left; font-size: 14px; color:#334155;">
                <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
                    <div>
                        <label style="font-weight:600;">DNI</label>
                        <input id="swal-dni" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.dni}" ${esEdicion ? 'disabled' : ''} maxlength="8">
                    </div>
                    <div>
                        <label style="font-weight:600;">Edad</label>
                        <input id="swal-edad" type="number" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.edad || ''}">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight:600;">Nombres</label>
                        <input id="swal-nombres" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.nombres}">
                    </div>
                    <div>
                        <label style="font-weight:600;">Apellidos</label>
                        <input id="swal-apellidos" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.apellidos}">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight:600;">Género</label>
                        <select id="swal-genero" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px; padding:0 10px; height:42px;">
                            <option value="Masculino" ${est.genero === 'Masculino' ? 'selected' : ''}>Masculino</option>
                            <option value="Femenino" ${est.genero === 'Femenino' ? 'selected' : ''}>Femenino</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-weight:600;">Estado Administrativo</label>
                        <select id="swal-estado" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px; padding:0 10px; height:42px;">
                            <option value="Activo" ${est.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                            <option value="Inactivo" ${est.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="font-weight:600;">Especialidad / Carrera</label>
                    <select id="swal-carrera" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px; padding:0 10px; height:42px;">
                        ${opcionesCarreraHTML}
                    </select>
                </div>
                <div>
                    <label style="font-weight:600;">Ciclo Académico</label>
                    <select id="swal-ciclo" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px; padding:0 10px; height:42px;">
                        <option value="1" ${est.ciclo === '1' ? 'selected' : ''}>I</option>
                        <option value="2" ${est.ciclo === '2' ? 'selected' : ''}>II</option>
                        <option value="3" ${est.ciclo === '3' ? 'selected' : ''}>III</option>
                        <option value="4" ${est.ciclo === '4' ? 'selected' : ''}>IV</option>
                        <option value="5" ${est.ciclo === '5' ? 'selected' : ''}>V</option>
                        <option value="6" ${est.ciclo === '6' ? 'selected' : ''}>VI</option>
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Alumno',
        confirmButtonColor: '#0066ff',
        preConfirm: () => {
            const dni = document.getElementById('swal-dni').value.trim();
            const edad = document.getElementById('swal-edad').value.trim();
            const nombres = document.getElementById('swal-nombres').value.trim();
            const apellidos = document.getElementById('swal-apellidos').value.trim();
            const genero = document.getElementById('swal-genero').value;
            const estado = document.getElementById('swal-estado').value;
            const carrera = document.getElementById('swal-carrera').value;
            const ciclo = document.getElementById('swal-ciclo').value;

            if (!dni || !nombres || !apellidos || !edad) {
                Swal.showValidationMessage('Campos obligatorios incompletos'); return false;
            }
            if (dni.length !== 8 || isNaN(dni)) {
                Swal.showValidationMessage('El DNI debe tener 8 dígitos'); return false;
            }
            if (!esEdicion && estudiantes.some(e => e.dni === dni)) {
                Swal.showValidationMessage('DNI ya registrado'); return false;
            }
            return { dni, edad, nombres, apellidos, genero, estado, carrera, ciclo };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (esEdicion) {
                const idx = estudiantes.findIndex(e => e.dni === dniTarget);
                estudiantes[idx] = { ...estudiantes[idx], ...result.value };
                asistencias.forEach(a => { if (a.dni === dniTarget) a.nombreCompleto = `${result.value.nombres} ${result.value.apellidos}`; });
            } else {
                estudiantes.push(result.value);
            }
            saveState(); renderEstudiantesTable();
        }
    });
}

function deleteEstudiante(dni) {
    Swal.fire({
        title: '¿Eliminar Alumno?',
        text: "Se borrará permanentemente de la lista local.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            estudiantes = estudiantes.filter(e => e.dni !== dni);
            saveState(); renderEstudiantesTable();
        }
    });
}

// LECTOR QR Y GESTIÓN FILTRADA DE ASISTENCIAS
function initAsistenciasModule() {
    if (DOM.btnEscanearQr) DOM.btnEscanearQr.addEventListener('click', () => startQrScanner());
    if (DOM.btnCerrarScanner) DOM.btnCerrarScanner.addEventListener('click', () => stopQrScanner());
    
    if (DOM.filterFecha) DOM.filterFecha.addEventListener('change', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    if (DOM.filterBusqueda) DOM.filterBusqueda.addEventListener('input', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    if (DOM.filterEstado) DOM.filterEstado.addEventListener('change', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    
    if (DOM.btnLimpiarFiltros) {
        DOM.btnLimpiarFiltros.addEventListener('click', () => {
            if (DOM.filterFecha) DOM.filterFecha.value = ''; 
            if (DOM.filterBusqueda) DOM.filterBusqueda.value = ''; 
            if (DOM.filterEstado) DOM.filterEstado.value = '';
            asistenciaPage = 1; renderAsistenciasTable();
        });
    }
}

function startQrScanner() {
    if (!DOM.qrContainer) return;
    DOM.qrContainer.classList.remove('hidden');
    DOM.qrContainer.scrollIntoView({ behavior: 'smooth' });
    if (!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        onQrScanSuccess
    ).catch(() => {
        Swal.fire('Error', 'Verifica los permisos de tu cámara web.', 'error');
        DOM.qrContainer.classList.add('hidden');
    });
}

function stopQrScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            if(DOM.qrContainer) DOM.qrContainer.classList.add('hidden');
        });
    } else {
        if(DOM.qrContainer) DOM.qrContainer.classList.add('hidden');
    }
}

function onQrScanSuccess(decodedText) {
    stopQrScanner();
    const estudiante = estudiantes.find(e => e.dni === decodedText.trim());

    if (!estudiante) {
        Swal.fire('No Encontrado', 'El DNI escaneado no pertenece a ningún alumno.', 'error').then(() => startQrScanner());
        return;
    }
    if (estudiante.estado === 'Inactivo') {
        Swal.fire('Acceso Denegado', 'El alumno se encuentra inactivo.', 'warning');
        return;
    }

    Swal.fire({
        title: 'Registrar Entrada',
        text: `${estudiante.nombres} ${estudiante.apellidos}`,
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Presente',
        denyButtonText: 'Tardanza',
        cancelButtonText: 'Falta',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#f59e0b',
        cancelButtonColor: '#ef4444',
    }).then((choice) => {
        let estado = 'Falta';
        if (choice.isConfirmed) estado = 'Presente';
        else if (choice.isDenied) estado = 'Tardanza';
        
        const ahora = new Date();
        asistencias.unshift({
            id: Date.now(),
            dni: estudiante.dni,
            nombreCompleto: `${estudiante.nombres} ${estudiante.apellidos}`,
            fecha: getLocalDateString(),
            hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`,
            estado: estado
        });
        saveState(); renderAsistenciasTable();
    });
}

function renderAsistenciasTable() {
    if (!DOM.tbodyAsistencias) return;
    const fF = DOM.filterFecha ? DOM.filterFecha.value : '';
    const fB = DOM.filterBusqueda ? DOM.filterBusqueda.value.trim().toLowerCase() : '';
    const fE = DOM.filterEstado ? DOM.filterEstado.value : '';

    let filtrados = asistencias.filter(a => {
        return (!fF || a.fecha === fF) && (!fE || a.estado === fE) && (!fB || a.dni.includes(fB) || a.nombreCompleto.toLowerCase().includes(fB));
    });

    if (DOM.labelAsistencias) DOM.labelAsistencias.textContent = `Mostrando ${filtrados.length} registros`;
    const totalPages = Math.ceil(filtrados.length / asistenciaRowsPerPage) || 1;
    const paginados = filtrados.slice((asistenciaPage - 1) * asistenciaRowsPerPage, asistenciaPage * asistenciaRowsPerPage);

    DOM.tbodyAsistencias.innerHTML = '';
    if (paginados.length === 0) {
        DOM.tbodyAsistencias.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">Sin registros coincidentes.</td></tr>`;
        return;
    }

    paginados.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${a.fecha}</td>
            <td>${a.hora}</td>
            <td><strong>${a.dni}</strong></td>
            <td>${a.nombreCompleto}</td>
            <td><span class="badge ${a.estado.toLowerCase()}">${a.estado}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-table edit-btn" onclick="editAsistenciaRecord(${a.id})"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    <button class="btn-table delete-btn" onclick="deleteAsistenciaRecord(${a.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        DOM.tbodyAsistencias.appendChild(tr);
    });

    renderPaginationControls(DOM.paginationAsistencias, totalPages, asistenciaPage, (p) => { asistenciaPage = p; renderAsistenciasTable(); });
}

function editAsistenciaRecord(id) {
    const r = asistencias.find(a => a.id === id);
    if (!r) return;
    Swal.fire({
        title: 'Modificar Estado',
        input: 'select',
        inputOptions: { 'Presente': 'Presente', 'Tardanza': 'Tardanza', 'Falta': 'Falta' },
        inputValue: r.estado,
        confirmButtonColor: '#0066ff',
        showCancelButton: true
    }).then(res => {
        if (res.isConfirmed) { r.estado = res.value; saveState(); renderAsistenciasTable(); }
    });
}

function deleteAsistenciaRecord(id) {
    asistencias = asistencias.filter(a => a.id !== id);
    saveState(); renderAsistenciasTable();
}

// ==========================================
// MÓDULO NUEVO: BACKUP Y EXCEL DUAL SYSTEM
// ==========================================
function initRespaldoModule() {
    // 1. Exportar JSON Completo
    if (DOM.btnExportarJson) {
        DOM.btnExportarJson.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ estudiantes, asistencias }, null, 2));
            const a = document.createElement('a'); 
            a.setAttribute("href", dataStr); 
            a.setAttribute("download", `respaldo_sistema_cesde.json`);
            a.click();
        });
    }

    // 2. Exportar EXCEL Filtrado por Carreras con cálculo de Faltas automáticas
    if (DOM.btnExportarExcel) {
        DOM.btnExportarExcel.addEventListener('click', () => {
            let opcionesHTML = CARRERAS_CESDE.map(c => `<option value="${c}">${c}</option>`).join('');

            Swal.fire({
                title: 'Exportar Reporte a Excel',
                text: 'Seleccione la especialidad académica y la fecha del reporte:',
                html: `
                    <div style="text-align:left; font-size:14px;">
                        <label style="font-weight:600;">Carrera:</label>
                        <select id="export-excel-carrera" class="swal2-input" style="width:100%; margin:5px 0 15px 0; border-radius:8px; height:40px; padding:0 10px;">
                            ${opcionesHTML}
                        </select>
                        <label style="font-weight:600;">Fecha de Evaluación:</label>
                        <input type="date" id="export-excel-fecha" class="swal2-input" style="width:100%; margin:5px 0 0 0; border-radius:8px; height:40px;" value="${getLocalDateString()}">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Generar Excel',
                confirmButtonColor: '#10b981',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        carrera: document.getElementById('export-excel-carrera').value,
                        fecha: document.getElementById('export-excel-fecha').value
                    }
                }
            }).then((res) => {
                if (!res.isConfirmed) return;

                const { carrera, fecha } = res.value;

                // Filtrar alumnos que pertenecen a esa especialidad
                const alumnosCarrera = estudiantes.filter(e => e.carrera === carrera);

                if (alumnosCarrera.length === 0) {
                    Swal.fire('Aviso', 'No hay estudiantes matriculados en la especialidad seleccionada.', 'info');
                    return;
                }

                // Obtener registros QR guardados de esa fecha exacta
                const asistenciasFecha = asistencias.filter(a => a.fecha === fecha);

                // Mapear filas estructurando los datos del estudiante combinados con su estado
                const filasReporte = alumnosCarrera.map(est => {
                    // Buscar si pasó o no el QR
                    const registroQR = asistenciasFecha.find(a => a.dni === est.dni);
                    
                    let horaMarcada = '-';
                    let estadoFinal = '';

                    if (registroQR) {
                        horaMarcada = registroQR.hora;
                        estadoFinal = registroQR.estado; // "Presente" o "Tardanza"
                    } else {
                        // REQUISITO: Si el estudiante no vino ni pasó el QR, se marca automáticamente Falta
                        estadoFinal = 'Falta (El estudiante no vino / No pasó QR)';
                    }

                    return {
                        'DNI': est.dni,
                        'Apellidos': est.apellidos,
                        'Nombres': est.nombres,
                        'Carrera / Especialidad': est.carrera,
                        'Ciclo': `${est.ciclo}° Ciclo`,
                        'Fecha Evaluada': fecha,
                        'Hora Marcación QR': horaMarcada,
                        'Estado Asistencia': estadoFinal
                    };
                });

                // Inicializar motor SheetJS para compilar el Libro de Trabajo (Workbook)
                const hoja = XLSX.utils.json_to_sheet(filasReporte);
                const libro = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(libro, hoja, "Asistencias");
                
                // Forzar descarga del archivo compilado en el navegador
                const nombreArchivo = `Reporte_${carrera.replace(/\s+/g, '_')}_${fecha}.xlsx`;
                XLSX.writeFile(libro, nombreArchivo);
                Swal.fire('¡Generado!', 'El reporte Excel ha sido descargado.', 'success');
            });
        });
    }

    // 3. Importar JSON (Disparador)
    if (DOM.btnTriggerJson) {
        DOM.btnTriggerJson.addEventListener('click', () => DOM.inputImportarJson.click());
    }
    if (DOM.inputImportarJson) {
        DOM.inputImportarJson.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (parsed.estudiantes && parsed.asistencias) {
                        estudiantes = parsed.estudiantes; asistencias = parsed.asistencias;
                        saveState(); renderEstudiantesTable(); renderAsistenciasTable();
                        Swal.fire('Restaurado', 'La base de datos local se actualizó correctamente.', 'success');
                    } else {
                        Swal.fire('Error', 'Estructura JSON inválida.', 'error');
                    }
                } catch { Swal.fire('Error', 'Archivo corrupto.', 'error'); }
                DOM.inputImportarJson.value = '';
            };
            reader.readAsText(file);
        });
    }

    // 4. Importar Estudiantes desde EXCEL (.xlsx)
    if (DOM.btnTriggerExcel) {
        DOM.btnTriggerExcel.addEventListener('click', () => DOM.inputImportarExcel.click());
    }
    if (DOM.inputImportarExcel) {
        DOM.inputImportarExcel.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            
            reader.onload = function(evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const primeraHoja = workbook.SheetNames[0];
                    const filas = XLSX.utils.sheet_to_json(workbook.Sheets[primeraHoja]);

                    let nuevosAgregados = 0;
                    filas.forEach(fila => {
                        // Adaptar encabezados lógicos del Excel a variables nativas
                        const dni = String(fila.DNI || fila.dni || '').trim();
                        const nombres = String(fila.Nombres || fila.nombres || '').trim();
                        const apellidos = String(fila.Apellidos || fila.apellidos || '').trim();
                        const carrera = String(fila.Carrera || fila.carrera || 'Administración de Centros de Cómputo').trim();
                        const ciclo = String(fila.Ciclo || fila.ciclo || '1').replace(/\D/g, '');

                        if (dni.length === 8 && nombres && apellidos) {
                            // Validar que no exista el DNI ya duplicado
                            if (!estudiantes.some(est => est.dni === dni)) {
                                estudiantes.push({
                                    dni,
                                    nombres,
                                    apellidos,
                                    carrera: CARRERAS_CESDE.includes(carrera) ? carrera : 'Administración de Centros de Cómputo',
                                    ciclo: ciclo || '1',
                                    edad: String(fila.Edad || fila.edad || '20'),
                                    genero: String(fila.Genero || fila.genero || 'Masculino'),
                                    estado: 'Activo'
                                });
                                nuevosAgregados++;
                            }
                        }
                    });

                    if (nuevosAgregados > 0) {
                        saveState(); renderEstudiantesTable();
                        Swal.fire('Importación Exitosa', `Se agregaron ${nuevosAgregados} nuevos alumnos desde el archivo Excel.`, 'success');
                    } else {
                        Swal.fire('Información', 'No se encontraron alumnos nuevos válidos para añadir.', 'info');
                    }
                } catch (err) {
                    Swal.fire('Error', 'No se pudo procesar el archivo Excel. Asegúrate de usar columnas claras (DNI, Nombres, Apellidos).', 'error');
                }
                DOM.inputImportarExcel.value = '';
            };
            reader.readAsArrayBuffer(file);
        });
    }
}