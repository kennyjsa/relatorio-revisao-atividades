// Variáveis globais
let csvData = [];
let filteredData = [];
let dailyTableInstance = null;
let projectTableInstance = null;
let activityTableInstance = null;
let dayOffs = {}; // Day offs por período: { "2025-09-21_2025-10-20": ["2025-09-25", ...] }
let periodPicker = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializePeriodPicker();
    setupEventListeners();
    loadDayOffs();
});

// Configurar event listeners
function setupEventListeners() {
    const fileInput = document.getElementById('csvFileInput');
    const uploadArea = document.getElementById('uploadArea');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    // Upload de arquivo
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Filtros
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);

    // Day Offs Button
    const dayOffsBtn = document.getElementById('dayOffsBtn');
    if (dayOffsBtn) {
        dayOffsBtn.addEventListener('click', openDayOffsModal);
    }

    // Copy Projects Button
    const copyProjectsBtn = document.getElementById('copyProjectsBtn');
    if (copyProjectsBtn) {
        copyProjectsBtn.addEventListener('click', copyProjectsToClipboard);
    }
}

// Carregar day offs do localStorage
function loadDayOffs() {
    const saved = localStorage.getItem('dayOffs');
    if (saved) {
        try {
            dayOffs = JSON.parse(saved);
        } catch (e) {
            dayOffs = {};
        }
    }
}

// Salvar day offs no localStorage
function saveDayOffs() {
    localStorage.setItem('dayOffs', JSON.stringify(dayOffs));
}

// Normalizar data para comparação (meia-noite local)
function normalizeDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Data no formato ISO (yyyy-MM-dd) para chaves
function toISODate(date) {
    const d = normalizeDate(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Período padrão: ciclo 21 a 20
function getDefaultPeriod() {
    const today = normalizeDate(new Date());
    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();

    let start;
    let end;

    if (day >= 21) {
        start = new Date(year, month, 21);
        end = new Date(year, month + 1, 20);
    } else {
        start = new Date(year, month - 1, 21);
        end = new Date(year, month, 20);
    }

    return { start: normalizeDate(start), end: normalizeDate(end) };
}

function isDateInPeriod(date, start, end) {
    const d = normalizeDate(date);
    return d >= start && d <= end;
}

function getSelectedPeriod() {
    if (periodPicker && periodPicker.selectedDates.length === 2) {
        return {
            start: normalizeDate(periodPicker.selectedDates[0]),
            end: normalizeDate(periodPicker.selectedDates[1])
        };
    }
    return getDefaultPeriod();
}

function initializePeriodPicker() {
    const periodInput = document.getElementById('periodRange');
    if (!periodInput) return;

    const { start, end } = getDefaultPeriod();

    periodPicker = flatpickr(periodInput, {
        mode: 'range',
        dateFormat: 'd/m/Y',
        locale: 'pt',
        defaultDate: [start, end],
        allowInput: false,
        showMonths: 2
    });
}

// Obter chave para o período selecionado
function getDayOffKey(start, end) {
    return `${toISODate(start)}_${toISODate(end)}`;
}

// Verificar se um dia é day off
function isDayOff(date) {
    const { start, end } = getSelectedPeriod();
    const key = getDayOffKey(start, end);
    if (!dayOffs[key]) return false;

    return dayOffs[key].includes(toISODate(date));
}

// Iterar cada dia de um período
function eachDayInPeriod(start, end, callback) {
    const current = normalizeDate(start);
    const last = normalizeDate(end);

    while (current <= last) {
        callback(new Date(current));
        current.setDate(current.getDate() + 1);
    }
}

// Abrir modal de seleção de day offs
function openDayOffsModal() {
    const { start, end } = getSelectedPeriod();
    const key = getDayOffKey(start, end);

    if (!dayOffs[key]) {
        dayOffs[key] = [];
    }

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let checkboxesHtml = '<div class="row">';
    const daysInPeriod = [];

    eachDayInPeriod(start, end, (date) => {
        const isoDate = toISODate(date);
        daysInPeriod.push(isoDate);
        const dayOfWeek = date.getDay();
        const isChecked = dayOffs[key].includes(isoDate);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        checkboxesHtml += `
            <div class="col-6 col-md-4 col-lg-3 mb-2">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="day-${isoDate}" value="${isoDate}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="day-${isoDate}" style="${isWeekend ? 'color: #6c757d;' : ''}">
                        ${formatDate(date)} - ${dayNames[dayOfWeek]}
                    </label>
                </div>
            </div>
        `;
    });

    checkboxesHtml += '</div>';

    const periodLabel = `${formatDate(start)} a ${formatDate(end)}`;
    // Criar modal
    const modalHtml = `
        <div class="modal fade" id="dayOffsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="bi bi-calendar-x"></i> Selecionar Day Offs</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted">Período: <strong>${periodLabel}</strong></p>
                        <p class="text-muted">Marque os dias que não devem contar como dias úteis:</p>
                        ${checkboxesHtml}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="saveDayOffsBtn">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior se existir
    const oldModal = document.getElementById('dayOffsModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Adicionar modal ao body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('dayOffsModal'));
    modal.show();
    
    // Evento de salvar
    document.getElementById('saveDayOffsBtn').addEventListener('click', function() {
        const selectedDays = [];
        daysInPeriod.forEach((isoDate) => {
            const checkbox = document.getElementById(`day-${isoDate}`);
            if (checkbox && checkbox.checked) {
                selectedDays.push(isoDate);
            }
        });
        
        dayOffs[key] = selectedDays;
        saveDayOffs();
        modal.hide();
        
        // Reaplicar filtros para atualizar a visualização
        applyFilters();
    });
}

// Inicializar filtros com período padrão (ciclo 21 a 20)
function initializeFilters() {
    const { start, end } = getDefaultPeriod();
    if (periodPicker) {
        periodPicker.setDate([start, end], false);
    }
}

// Manipular seleção de arquivo
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Processar arquivo CSV
function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Por favor, selecione um arquivo CSV válido.');
        return;
    }
    
    document.getElementById('fileName').innerHTML = 
        `<i class="bi bi-file-earmark-check"></i> <strong>${file.name}</strong> carregado com sucesso!`;
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            csvData = results.data;
            processData();
        },
        error: function(error) {
            alert('Erro ao processar o arquivo: ' + error.message);
        }
    });
}

// Processar dados do CSV
function processData() {
    if (csvData.length === 0) {
        alert('Nenhum dado encontrado no arquivo CSV.');
        return;
    }
    
    // Mostrar seções
    document.getElementById('filtersSection').style.display = 'flex';
    document.getElementById('statsSection').style.display = 'flex';
    document.getElementById('healthSection').style.display = 'block';
    document.getElementById('tablesSection').style.display = 'block';
    
    // Aplicar filtros iniciais
    applyFilters();
}

// Aplicar filtros
function applyFilters() {
    const { start, end } = getSelectedPeriod();

    filteredData = csvData.filter(row => {
        if (!row.Prazoss || !row['Completed Work']) return false;

        const date = parseDate(row.Prazoss);
        if (!date) return false;

        return isDateInPeriod(date, start, end);
    });
    
    // Atualizar visualizações
    updateStats();
    updateHealth();
    updateTables();
}

// Resetar filtros
function resetFilters() {
    initializeFilters();
    applyFilters();
}

// Parsear data do formato dd/MM/yyyy HH:mm:ss
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    
    return new Date(year, month, day);
}

// Formatar data para exibição
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Atualizar estatísticas
function updateStats() {
    let totalHours = 0;
    let totalTasks = 0;
    const projects = new Set();
    const activities = new Set();
    
    filteredData.forEach(row => {
        const hours = parseFloat(row['Completed Work']);
        if (!isNaN(hours)) {
            totalHours += hours;
            totalTasks++;
        }
        
        if (row['Area Path']) projects.add(row['Area Path']);
        if (row.Activity) activities.add(row.Activity);
    });
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(2) + 'h';
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('totalProjects').textContent = projects.size;
    document.getElementById('totalActivities').textContent = activities.size;
}

// Calcular dias úteis do período (excluindo sábados, domingos e day offs)
function calculateWorkingDays(start, end) {
    let workingDays = 0;

    eachDayInPeriod(start, end, (date) => {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isDayOff(date)) {
            workingDays++;
        }
    });

    return workingDays;
}

// Calcular dias úteis decorridos até hoje (ou até o fim do período)
function calculateElapsedWorkingDays(start, end) {
    const today = normalizeDate(new Date());
    const periodStart = normalizeDate(start);
    const periodEnd = normalizeDate(end);

    if (today < periodStart) {
        return 0;
    }

    const lastDate = today <= periodEnd ? today : periodEnd;
    let workingDays = 0;

    eachDayInPeriod(periodStart, lastDate, (date) => {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isDayOff(date)) {
            workingDays++;
        }
    });

    return workingDays;
}

// Atualizar saúde do lançamento
function updateHealth() {
    const { start, end } = getSelectedPeriod();
    
    // Calcular horas totais lançadas
    let totalHours = 0;
    filteredData.forEach(row => {
        const hours = parseFloat(row['Completed Work']);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });
    
    // Calcular dias úteis
    const totalWorkingDays = calculateWorkingDays(start, end);
    const elapsedWorkingDays = calculateElapsedWorkingDays(start, end);
    
    // Meta de 8 horas por dia útil
    const targetHours = totalWorkingDays * 8;
    const expectedHours = elapsedWorkingDays * 8;
    const remainingHours = targetHours - totalHours;
    
    // Calcular percentual
    const percentage = targetHours > 0 ? (totalHours / targetHours * 100) : 0;
    const expectedPercentage = targetHours > 0 ? (expectedHours / targetHours * 100) : 0;
    
    // Atualizar elementos
    document.getElementById('targetHours').textContent = targetHours.toFixed(0) + 'h';
    document.getElementById('workingDays').textContent = totalWorkingDays + ' dias úteis';
    document.getElementById('expectedHours').textContent = expectedHours.toFixed(0) + 'h';
    document.getElementById('elapsedDays').textContent = elapsedWorkingDays + ' dias úteis decorridos';
    
    // Atualizar horas restantes
    if (remainingHours > 0) {
        document.getElementById('remainingLabel').textContent = 'Faltam';
        document.getElementById('remainingHours').textContent = remainingHours.toFixed(0) + 'h';
        document.getElementById('remainingHours').style.color = '#dc3545';
    } else {
        document.getElementById('remainingLabel').textContent = 'Excedente';
        document.getElementById('remainingHours').textContent = Math.abs(remainingHours).toFixed(0) + 'h';
        document.getElementById('remainingHours').style.color = '#198754';
    }
    
    // Determinar status e cor
    let healthStatus = '';
    let healthColor = '';
    let progressBarColor = '';
    let healthDescription = '';
    
    if (percentage >= 100) {
        healthStatus = 'Completo';
        healthColor = 'bg-success';
        progressBarColor = '#198754';
        healthDescription = '🎉 Meta do período atingida!';
    } else if (percentage >= expectedPercentage - 10) {
        healthStatus = 'Saudável';
        healthColor = 'bg-success';
        progressBarColor = '#198754';
        healthDescription = '✅ Você está no ritmo esperado para o período.';
    } else if (percentage >= expectedPercentage - 30) {
        healthStatus = 'Atenção';
        healthColor = 'bg-warning';
        progressBarColor = '#ffc107';
        healthDescription = '⚠️ Levemente abaixo do esperado, mas recuperável.';
    } else {
        healthStatus = 'Crítico';
        healthColor = 'bg-danger';
        progressBarColor = '#dc3545';
        healthDescription = '🚨 Significativamente abaixo da meta esperada!';
    }
    
    // Atualizar badge de status
    const healthBadge = document.getElementById('healthBadge');
    healthBadge.textContent = healthStatus;
    healthBadge.className = 'badge ' + healthColor;
    
    document.getElementById('healthPercentage').textContent = percentage.toFixed(1) + '% da meta';
    
    // Atualizar barra de progresso
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = Math.min(percentage, 100) + '%';
    progressBar.style.backgroundColor = progressBarColor;
    progressBar.setAttribute('aria-valuenow', percentage);
    document.getElementById('progressText').textContent = percentage.toFixed(1) + '%';
    document.getElementById('progressDescription').textContent = healthDescription;
}

// Agrupar dados por dia (todos os dias do período)
function groupByDay() {
    const { start, end } = getSelectedPeriod();
    const grouped = {};
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    eachDayInPeriod(start, end, (date) => {
        const dateKey = formatDate(date);
        const dayOfWeek = date.getDay();
        const dayOff = isDayOff(date);

        grouped[dateKey] = {
            hours: 0,
            tasks: 0,
            dayOfWeek: dayNames[dayOfWeek],
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            isDayOff: dayOff,
            date: date
        };
    });
    
    // Adicionar dados reais do CSV
    filteredData.forEach(row => {
        if (!row.Prazoss || !row['Completed Work']) return;
        
        const date = parseDate(row.Prazoss);
        if (!date) return;
        
        const dateKey = formatDate(date);
        const hours = parseFloat(row['Completed Work']);
        
        if (grouped[dateKey] && !isNaN(hours)) {
            grouped[dateKey].hours += hours;
            grouped[dateKey].tasks++;
        }
    });
    
    return grouped;
}

// Agrupar dados por projeto
function groupByProject() {
    const grouped = {};
    let totalHours = 0;
    
    filteredData.forEach(row => {
        if (!row['Area Path'] || !row['Completed Work']) return;
        
        const project = row['Area Path'];
        const hours = parseFloat(row['Completed Work']);
        
        if (!grouped[project]) {
            grouped[project] = { hours: 0, tasks: 0 };
        }
        
        if (!isNaN(hours)) {
            grouped[project].hours += hours;
            grouped[project].tasks++;
            totalHours += hours;
        }
    });
    
    // Adicionar percentual
    Object.keys(grouped).forEach(project => {
        grouped[project].percentage = totalHours > 0 
            ? (grouped[project].hours / totalHours * 100).toFixed(1) 
            : 0;
    });
    
    return grouped;
}

// Agrupar dados por atividade
function groupByActivity() {
    const grouped = {};
    let totalHours = 0;
    
    filteredData.forEach(row => {
        if (!row.Activity || !row['Completed Work']) return;
        
        const activity = row.Activity;
        const hours = parseFloat(row['Completed Work']);
        
        if (!grouped[activity]) {
            grouped[activity] = { hours: 0, tasks: 0 };
        }
        
        if (!isNaN(hours)) {
            grouped[activity].hours += hours;
            grouped[activity].tasks++;
            totalHours += hours;
        }
    });
    
    // Adicionar percentual
    Object.keys(grouped).forEach(activity => {
        grouped[activity].percentage = totalHours > 0 
            ? (grouped[activity].hours / totalHours * 100).toFixed(1) 
            : 0;
    });
    
    return grouped;
}

// Atualizar tabelas
function updateTables() {
    updateDailyTable();
    updateProjectTable();
    updateActivityTable();
}

// Atualizar tabela diária
function updateDailyTable() {
    const dailyData = groupByDay();
    const { start, end } = getSelectedPeriod();
    const periodDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // Converter para array e ordenar
    const dataArray = Object.entries(dailyData).map(([date, data]) => ({
        date: date,
        sortDate: toISODate(data.date),
        dayOfWeek: data.dayOfWeek,
        hours: data.hours,
        tasks: data.tasks,
        isWeekend: data.isWeekend,
        isDayOff: data.isDayOff
    }));
    
    // Destruir tabela anterior se existir
    if (dailyTableInstance) {
        dailyTableInstance.destroy();
    }
    
    // Criar nova tabela
    dailyTableInstance = $('#dailyTable').DataTable({
        data: dataArray,
        columns: [
            { 
                data: 'date', 
                title: 'Data',
                render: function(data, type, row) {
                    if (type === 'sort' || type === 'type') {
                        return row.sortDate;
                    }
                    return data;
                },
                createdCell: function(td, cellData, rowData) {
                    if (rowData.isDayOff) {
                        $(td).css('background-color', '#d1ecf1');
                        $(td).css('font-weight', 'bold');
                        $(td).css('border-left', '3px solid #0dcaf0');
                    } else if (rowData.isWeekend) {
                        $(td).css('background-color', '#f8f9fa');
                        $(td).css('font-weight', 'bold');
                    }
                }
            },
            { 
                data: 'dayOfWeek', 
                title: 'Dia da Semana',
                render: function(data, type, row) {
                    if (type === 'display' && row.isDayOff) {
                        return `${data} <span class="badge bg-info text-dark" style="font-size: 0.7rem;"><i class="bi bi-x-circle"></i> Day Off</span>`;
                    }
                    return data;
                },
                createdCell: function(td, cellData, rowData) {
                    if (rowData.isDayOff) {
                        $(td).css('background-color', '#d1ecf1');
                        $(td).css('font-weight', 'bold');
                    } else if (rowData.isWeekend) {
                        $(td).css('background-color', '#f8f9fa');
                        $(td).css('font-weight', 'bold');
                        $(td).css('color', '#6c757d');
                    }
                }
            },
            { 
                data: 'hours', 
                title: 'Horas Trabalhadas',
                render: function(data, type, row) {
                    if (type === 'display') {
                        let colorClass = '';
                        let bgColor = '';
                        
                        if (data < 6) {
                            bgColor = '#dc3545'; // Vermelho
                            colorClass = 'text-white';
                        } else if (data >= 6 && data < 7.5) {
                            bgColor = '#ffc107'; // Amarelo
                            colorClass = 'text-dark';
                        } else if (data >= 7.5) {
                            bgColor = '#198754'; // Verde
                            colorClass = 'text-white';
                        }
                        
                        if (data === 0) {
                            return '<span style="color: #dee2e6;">-</span>';
                        }
                        
                        return `<span class="badge ${colorClass}" style="background-color: ${bgColor}; font-size: 0.9rem; padding: 0.4em 0.8em;">${data.toFixed(2)}h</span>`;
                    }
                    return data;
                },
                createdCell: function(td, cellData, rowData) {
                    if (rowData.isDayOff) {
                        $(td).css('background-color', '#d1ecf1');
                    } else if (rowData.isWeekend) {
                        $(td).css('background-color', '#f8f9fa');
                    }
                }
            },
            { 
                data: 'tasks', 
                title: 'Quantidade de Tasks',
                createdCell: function(td, cellData, rowData) {
                    if (rowData.isDayOff) {
                        $(td).css('background-color', '#d1ecf1');
                    } else if (rowData.isWeekend) {
                        $(td).css('background-color', '#f8f9fa');
                    }
                    if (cellData === 0) {
                        $(td).html('<span style="color: #dee2e6;">-</span>');
                    }
                }
            }
        ],
        order: [[0, 'asc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
        },
        pageLength: Math.max(periodDays, 10)
    });
}

// Atualizar tabela de projetos
function updateProjectTable() {
    const projectData = groupByProject();
    
    // Converter para array e ordenar por horas
    const dataArray = Object.entries(projectData).map(([project, data]) => ({
        project: project,
        hours: data.hours,
        tasks: data.tasks,
        percentage: data.percentage
    })).sort((a, b) => b.hours - a.hours);
    
    // Destruir tabela anterior se existir
    if (projectTableInstance) {
        projectTableInstance.destroy();
    }
    
    // Criar nova tabela
    projectTableInstance = $('#projectTable').DataTable({
        data: dataArray,
        columns: [
            { data: 'project', title: 'Projeto' },
            { 
                data: 'hours', 
                title: 'Horas Trabalhadas',
                render: function(data) {
                    return data.toFixed(2) + 'h';
                }
            },
            { data: 'tasks', title: 'Quantidade de Tasks' },
            { 
                data: 'percentage', 
                title: '% do Total',
                render: function(data) {
                    return `<span class="badge bg-primary">${data}%</span>`;
                }
            }
        ],
        order: [[1, 'desc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
        },
        pageLength: 25
    });
}

// Atualizar tabela de atividades
function updateActivityTable() {
    const activityData = groupByActivity();

    // Converter para array e ordenar por horas
    const dataArray = Object.entries(activityData).map(([activity, data]) => ({
        activity: activity,
        hours: data.hours,
        tasks: data.tasks,
        percentage: data.percentage
    })).sort((a, b) => b.hours - a.hours);

    // Destruir tabela anterior se existir
    if (activityTableInstance) {
        activityTableInstance.destroy();
    }

    // Criar nova tabela
    activityTableInstance = $('#activityTable').DataTable({
        data: dataArray,
        columns: [
            { data: 'activity', title: 'Atividade' },
            {
                data: 'hours',
                title: 'Horas Trabalhadas',
                render: function(data) {
                    return data.toFixed(2) + 'h';
                }
            },
            { data: 'tasks', title: 'Quantidade de Tasks' },
            {
                data: 'percentage',
                title: '% do Total',
                render: function(data) {
                    return `<span class="badge bg-success">${data}%</span>`;
                }
            }
        ],
        order: [[1, 'desc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/pt-BR.json'
        },
        pageLength: 25
    });
}

// Gerar texto dos projetos para copiar
function generateProjectsText() {
    const { start, end } = getSelectedPeriod();

    // Obter projetos únicos do filteredData, sem repetição
    const projects = new Set();
    filteredData.forEach(row => {
        if (row['Area Path']) {
            projects.add(row['Area Path']);
        }
    });

    // Converter para array e ordenar
    const projectsArray = Array.from(projects).sort();

    const periodText = `${formatDate(start)} à ${formatDate(end)}`;

    // Montar texto final
    let text = 'Projeto:\n';
    projectsArray.forEach(project => {
        text += project + '\n';
    });
    text += `\nPeríodo: ${periodText}`;

    return text;
}

// Copiar projetos para clipboard
function copyProjectsToClipboard() {
    const text = generateProjectsText();

    navigator.clipboard.writeText(text).then(() => {
        // Feedback visual de sucesso
        const btn = document.getElementById('copyProjectsBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-circle"></i> Copiado!';
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-primary');
        }, 2000);
    }).catch(() => {
        alert('Erro ao copiar para o clipboard');
    });
}

