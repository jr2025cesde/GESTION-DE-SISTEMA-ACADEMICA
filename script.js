/**
 * CESDE EduAsist - Core Backend Engine Local
 */

// CARGAR DATOS DESDE LOCALSTORAGE
let estudiantes = JSON.parse(localStorage.getItem('edu_estudiantes')) || [];
let asistencias = JSON.parse(localStorage.getItem('edu_asistencias')) || [];

// VARIABLES COLECTIVAS DE CONTROL
let estudiantePage = 1;
const estudianteRowsPerPage = 5;
let estudianteSortColumn = 'apellidos';
let estudianteSortAsc = true;

let asistenciaPage = 1;
const asistenciaRowsPerPage = 5;

let chartAsistenciasInstance = null;
let html5QrcodeScanner = null;

// CENTRALIZACIÓN DE OBJETOS DEL DOM
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
    
    btnExportar: document.getElementById('btn-exportar'),
    btnTriggerImportar: document.getElementById('btn-trigger-importar'),
    inputImportar: document.getElementById('input-importar')
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEstudiantesModule();
    initAsistenciasModule();
    initRespaldoModule();
    updateDashboardMetrics();
});

// GUARDADO CENTRALIZADO DE ESTADOS
function saveState() {
    localStorage.setItem('edu_estudiantes', JSON.stringify(estudiantes));
    localStorage.setItem('edu_asistencias', JSON.stringify(asistencias));
    updateDashboardMetrics();
}

function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GESTIÓN DE ENRUTAMIENTO LOCAL E INTERFAZ
function initNavigation() {
    DOM.menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            DOM.menuButtons.forEach(b => b.classList.remove('active'));
            DOM.modules.forEach(m => m.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
            
            DOM.pageTitle.textContent = btn.querySelector('span').textContent + " General";
            
            if (window.innerWidth <= 768) DOM.sidebar.classList.remove('open');
            
            if (target === 'mod-dashboard') updateDashboardMetrics();
            if (target === 'mod-estudiantes') renderEstudiantesTable();
            if (target === 'mod-asistencias') renderAsistenciasTable();
        });
    });

    DOM.toggleSidebar.addEventListener('click', () => DOM.sidebar.classList.toggle('open'));

    // Botones de llamada al escáner directo
    const triggerScannerAction = () => {
        DOM.menuButtons[2].click();
        startQrScanner();
    };
    DOM.btnQuickQr.addEventListener('click', triggerScannerAction);
    if(DOM.bannerActionStart) DOM.bannerActionStart.addEventListener('click', triggerScannerAction);
}

// LOGICA E INDICADORES DE PANEL PRINCIPAL
function updateDashboardMetrics() {
    const hoy = getLocalDateString();
    DOM.statEstudiantes.textContent = estudiantes.length;
    
    const asistenciasHoy = asistencias.filter(a => a.fecha === hoy);
    const countPresentes = asistenciasHoy.filter(a => a.estado === 'Presente').length;
    const countTardanzas = asistenciasHoy.filter(a => a.estado === 'Tardanza').length;
    const countFaltas = asistenciasHoy.filter(a => a.estado === 'Falta').length;
    
    DOM.statAsistencias.textContent = countPresentes;
    DOM.statTardanzas.textContent = countTardanzas;
    DOM.statFaltas.textContent = countFaltas;
    
    if (asistencias.length > 0) {
        const cumplidos = asistencias.filter(a => a.estado === 'Presente' || a.estado === 'Tardanza').length;
        const porcentaje = Math.round((cumplidos / asistencias.length) * 100);
        DOM.metricPercentage.textContent = `${porcentaje}%`;
        DOM.metricProgress.style.width = `${porcentaje}%`;
    } else {
        DOM.metricPercentage.textContent = '0%';
        DOM.metricProgress.style.width = '0%';
    }
    
    renderDashboardChart(countPresentes, countTardanzas, countFaltas);
}

function renderDashboardChart(p, t, f) {
    const ctx = document.getElementById('chart-asistencias-dia').getContext('2d');
    if (chartAsistenciasInstance) chartAsistenciasInstance.destroy();
    
    const noData = (p === 0 && t === 0 && f === 0);
    
    chartAsistenciasInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: noData ? ['Sin Registros Hoy'] : ['Presentes', 'Tardanzas', 'Faltas'],
            datasets: [{
                data: noData ? [100] : [p, t, f],
                backgroundColor: noData ? ['#e2e8f0'] : ['#0066ff', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }
            },
            cutout: '75%'
        }
    });
}

// SECCIÓN DE CONTROL DE REGISTRO DE ALUMNOS
function initEstudiantesModule() {
    DOM.btnNuevoEstudiante.addEventListener('click', () => openEstudianteModal());
    DOM.searchEstudiante.addEventListener('input', () => { estudiantePage = 1; renderEstudiantesTable(); });

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
    let query = DOM.searchEstudiante.value.trim().toLowerCase();
    let filtrados = estudiantes.filter(est => {
        return est.dni.includes(query) || est.nombres.toLowerCase().includes(query) || est.apellidos.toLowerCase().includes(query);
    });

    filtrados.sort((a, b) => {
        let fieldA = a[estudianteSortColumn].toString().toLowerCase();
        let fieldB = b[estudianteSortColumn].toString().toLowerCase();
        return estudianteSortAsc ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
    });

    const totalEstudiantes = filtrados.length;
    DOM.labelEstudiantes.textContent = `Mostrando ${totalEstudiantes} estudiantes`;
    
    const totalPages = Math.ceil(totalEstudiantes / estudianteRowsPerPage) || 1;
    if (estudiantePage > totalPages) estudiantePage = totalPages;
    
    const startIndex = (estudiantePage - 1) * estudianteRowsPerPage;
    const paginados = filtrados.slice(startIndex, startIndex + estudianteRowsPerPage);

    DOM.tbodyEstudiantes.innerHTML = '';

    if (paginados.length === 0) {
        DOM.tbodyEstudiantes.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">No se encontraron registros.</td></tr>`;
        renderPaginationControls(DOM.paginationEstudiantes, totalPages, estudiantePage, (p) => { estudiantePage = p; renderEstudiantesTable(); });
        return;
    }

    paginados.forEach(est => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${est.dni}</strong></td>
            <td>${est.nombres}</td>
            <td>${est.apellidos}</td>
            <td>${est.correo}</td>
            <td>${est.telefono}</td>
            <td>${est.carrera}</td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${est.ciclo}° Ciclo</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-table edit" onclick="openEstudianteModal('${est.dni}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-table delete" onclick="deleteEstudiante('${est.dni}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        DOM.tbodyEstudiantes.appendChild(tr);
    });

    renderPaginationControls(DOM.paginationEstudiantes, totalPages, estudiantePage, (p) => { estudiantePage = p; renderEstudiantesTable(); });
}

function renderPaginationControls(container, totalPages, currentPage, onPageChange) {
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
    let est = { dni: '', nombres: '', apellidos: '', correo: '', telefono: '', carrera: '', ciclo: '1' };
    if (esEdicion) est = estudiantes.find(e => e.dni === dniTarget) || est;

    Swal.fire({
        title: esEdicion ? 'Editar Registro de Alumno' : 'Ingresar Nuevo Alumno',
        background: '#ffffff',
        color: '#070f24',
        html: `
            <div style="display: flex; flex-direction: column; gap: 14px; text-align: left; font-size: 14px; color:#334155;">
                <div>
                    <label style="font-weight:600;">Documento de Identidad DNI</label>
                    <input id="swal-dni" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.dni}" ${esEdicion ? 'disabled' : ''} maxlength="8">
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
                <div>
                    <label style="font-weight:600;">Correo Electrónico</label>
                    <input id="swal-correo" type="email" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.correo}">
                </div>
                <div>
                    <label style="font-weight:600;">Teléfono Celular</label>
                    <input id="swal-telefono" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.telefono}">
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight:600;">Especialidad / Carrera</label>
                        <input id="swal-carrera" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px;" value="${est.carrera}">
                    </div>
                    <div>
                        <label style="font-weight:600;">Ciclo</label>
                        <select id="swal-ciclo" class="swal2-input" style="width:100%; margin:4px 0 0 0; border:1px solid #cbd5e1; border-radius:10px; padding:0 10px;">
                            <option value="1" ${est.ciclo==='1'?'selected':''}>I</option>
                            <option value="2" ${est.ciclo==='2'?'selected':''}>II</option>
                            <option value="3" ${est.ciclo==='3'?'selected':''}>III</option>
                            <option value="4" ${est.ciclo==='4'?'selected':''}>IV</option>
                            <option value="5" ${est.ciclo==='5'?'selected':''}>V</option>
                            <option value="6" ${est.ciclo==='6'?'selected':''}>VI</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Alumno',
        confirmButtonColor: '#0066ff',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
            const dni = document.getElementById('swal-dni').value.trim();
            const nombres = document.getElementById('swal-nombres').value.trim();
            const apellidos = document.getElementById('swal-apellidos').value.trim();
            const correo = document.getElementById('swal-correo').value.trim();
            const telefono = document.getElementById('swal-telefono').value.trim();
            const carrera = document.getElementById('swal-carrera').value.trim();
            const ciclo = document.getElementById('swal-ciclo').value;

            if (!dni || !nombres || !apellidos || !correo || !carrera) {
                Swal.showValidationMessage('Todos los campos obligatorios deben completarse'); return false;
            }
            if (dni.length !== 8 || isNaN(dni)) {
                Swal.showValidationMessage('El número de DNI debe contener exactamente 8 dígitos numéricos'); return false;
            }
            if (!esEdicion && estudiantes.some(e => e.dni === dni)) {
                Swal.showValidationMessage('Este número de DNI ya está registrado en el sistema'); return false;
            }
            return { dni, nombres, apellidos, correo, telefono, carrera, ciclo };
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
            Swal.fire({ title: 'Sincronizado', text: 'Datos guardados de inmediato de forma local.', icon: 'success', confirmButtonColor: '#0066ff' });
        }
    });
}

function deleteEstudiante(dni) {
    Swal.fire({
        title: '¿Eliminar Alumno?',
        text: "Se removerá el registro completo. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Eliminar Registro'
    }).then((result) => {
        if (result.isConfirmed) {
            estudiantes = estudiantes.filter(e => e.dni !== dni);
            saveState(); renderEstudiantesTable();
        }
    });
}

// CONTROLADOR DE ASISTENCIAS MEDIANTE LECTOR QR
function initAsistenciasModule() {
    DOM.btnEscanearQr.addEventListener('click', () => startQrScanner());
    DOM.btnCerrarScanner.addEventListener('click', () => stopQrScanner());
    DOM.filterFecha.addEventListener('change', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    DOM.filterBusqueda.addEventListener('input', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    DOM.filterEstado.addEventListener('change', () => { asistenciaPage = 1; renderAsistenciasTable(); });
    DOM.btnLimpiarFiltros.addEventListener('click', () => {
        DOM.filterFecha.value = ''; DOM.filterBusqueda.value = ''; DOM.filterEstado.value = '';
        asistenciaPage = 1; renderAsistenciasTable();
    });
}

function startQrScanner() {
    DOM.qrContainer.classList.remove('hidden');
    DOM.qrContainer.scrollIntoView({ behavior: 'smooth' });
    if (!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        onQrScanSuccess
    ).catch(() => {
        Swal.fire('Error de Acceso', 'No se pudo iniciar la cámara de escaneo.', 'error');
        DOM.qrContainer.classList.add('hidden');
    });
}

function stopQrScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => DOM.qrContainer.classList.add('hidden'));
    } else {
        DOM.qrContainer.classList.add('hidden');
    }
}

function onQrScanSuccess(decodedText) {
    stopQrScanner();
    const estudiante = estudiantes.find(e => e.dni === decodedText.trim());

    if (!estudiante) {
        Swal.fire({ title: 'No Encontrado', text: 'El DNI escaneado no está registrado en la base de alumnos.', icon: 'error', confirmButtonColor: '#0066ff' }).then(() => startQrScanner());
        return;
    }

    Swal.fire({
        title: 'Asignar Estado de Ingreso',
        text: `Estudiante: ${estudiante.nombres} ${estudiante.apellidos}`,
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
    const fF = DOM.filterFecha.value;
    const fB = DOM.filterBusqueda.value.trim().toLowerCase();
    const fE = DOM.filterEstado.value;

    let filtrados = asistencias.filter(a => {
        return (!fF || a.fecha === fF) && (!fE || a.estado === fE) && (!fB || a.dni.includes(fB) || a.nombreCompleto.toLowerCase().includes(fB));
    });

    DOM.labelAsistencias.textContent = `Mostrando ${filtrados.length} registros`;
    const totalPages = Math.ceil(filtrados.length / asistenciaRowsPerPage) || 1;
    const paginados = filtrados.slice((asistenciaPage - 1) * asistenciaRowsPerPage, asistenciaPage * asistenciaRowsPerPage);

    DOM.tbodyAsistencias.innerHTML = '';
    if (paginados.length === 0) {
        DOM.tbodyAsistencias.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No se registran entradas bajo los filtros actuales.</td></tr>`;
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
                    <button class="btn-table edit" onclick="editAsistenciaRecord(${a.id})"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    <button class="btn-table delete" onclick="deleteAsistenciaRecord(${a.id})"><i class="fa-solid fa-trash"></i></button>
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
        title: 'Cambiar Estado Horario',
        input: 'select',
        inputOptions: { 'Presente': 'Presente', 'Tardanza': 'Tardanza', 'Falta': 'Falta' },
        inputValue: r.estado,
        confirmButtonColor: '#0066ff'
    }).then(res => {
        if (res.isConfirmed) { r.estado = res.value; saveState(); renderAsistenciasTable(); }
    });
}

function deleteAsistenciaRecord(id) {
    asistencias = asistencias.filter(a => a.id !== id);
    saveState(); renderAsistenciasTable();
}

// EXPORTACIÓN E IMPORTACIÓN DE RESPALDOS JSON
function initRespaldoModule() {
    DOM.btnExportar.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ estudiantes, asistencias }, null, 2));
        const a = document.createElement('a'); 
        a.setAttribute("href", dataStr); 
        a.setAttribute("download", `respaldo_asistencias_cesde.json`);
        a.click();
    });
    
    DOM.btnTriggerImportar.addEventListener('click', () => DOM.inputImportar.click());
    
    DOM.inputImportar.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsedData = JSON.parse(evt.target.result);
                if (parsedData.estudiantes && parsedData.asistencias) {
                    Swal.fire({
                        title: '¿Sincronizar Copia de Respaldo?',
                        text: 'Esta acción sobrescribirá toda la información actual por el archivo cargado.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#10b981',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: 'Reemplazar todo'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            estudiantes = parsedData.estudiantes; 
                            asistencias = parsedData.asistencias;
                            saveState(); 
                            renderEstudiantesTable(); 
                            renderAsistenciasTable();
                            Swal.fire('¡Restauración Exitosa!', 'Los datos locales han sido sincronizados.', 'success');
                        }
                    });
                } else {
                    Swal.fire('Formato Inválido', 'El archivo seleccionado no tiene la estructura correcta.', 'error');
                }
            } catch {
                Swal.fire('Error de Lectura', 'No se pudo decodificar el archivo JSON correctamente.', 'error');
            }
            DOM.inputImportar.value = '';
        };
        reader.readAsText(file);
    });
}