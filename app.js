(() => {
  'use strict';

  const STORAGE_KEY = 'estudo-em-dia-tarefas-v1';
  const form = document.querySelector('#task-form');
  const nameInput = document.querySelector('#task-name');
  const dateInput = document.querySelector('#task-date');
  const list = document.querySelector('#task-list');
  const count = document.querySelector('#task-count');
  const empty = document.querySelector('#empty-state');
  const clearDone = document.querySelector('#clear-done');
  const todayLabel = document.querySelector('#today-label');
  const searchInput = document.querySelector('#task-search');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];

  // As bibliotecas aprimoram a interface; os recursos principais continuam
  // disponíveis quando uma CDN é bloqueada ou demora para responder.
  const pad = number => String(number).padStart(2, '0');
  const localDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => window.dayjs ? dayjs().format('YYYY-MM-DD') : localDate(new Date());
  const addDays = days => {
    if (window.dayjs) return dayjs().add(days, 'day').format('YYYY-MM-DD');
    const date = new Date(); date.setDate(date.getDate() + days); return localDate(date);
  };
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
  };
  const ask = async options => window.Swal ? (await Swal.fire(options)).isConfirmed : window.confirm(`${options.title}\n${options.text || ''}`);
  const notifyAdded = () => window.Swal ? Swal.fire({ title: 'Tarefa adicionada!', icon: 'success', timer: 1500, showConfirmButton: false }) : Promise.resolve();

  const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let filter = 'all';
  let tasks;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    tasks = Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) : null;
  } catch { tasks = null; }
  if (!tasks) {
    tasks = [
      { id: makeId(), title: 'Revisar conteúdo da última aula', date: addDays(1), done: false },
      { id: makeId(), title: 'Resolver cinco exercícios', date: addDays(3), done: false },
      { id: makeId(), title: 'Organizar anotações da semana', date: addDays(5), done: false }
    ];
  }

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
    catch { document.querySelector('.list-footnote').textContent = 'O navegador bloqueou o armazenamento local. As tarefas durarão até fechar a página.'; }
  };
  const dateText = date => {
    const [year, month, day] = date.split('-').map(Number);
    const [todayYear, todayMonth, todayDay] = today().split('-').map(Number);
    const remaining = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000);
    const label = remaining < 0 ? `${Math.abs(remaining)} dia${remaining < -1 ? 's' : ''} em atraso` : remaining === 0 ? 'Hoje' : remaining === 1 ? 'Amanhã' : `Em ${remaining} dias`;
    return { label: `${pad(day)}/${pad(month)}/${year} · ${label}`, remaining };
  };
  const visibleTasks = () => {
    const filtered = tasks.filter(task => filter === 'all' || (filter === 'done' ? task.done : !task.done));
    const query = searchInput.value.trim();
    if (!query) return filtered;
    const ids = window.Fuse
      ? new Set(new Fuse(filtered, { keys: ['title'], threshold: 0.4, ignoreLocation: true }).search(query).map(result => result.item.id))
      : new Set(filtered.filter(task => task.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'))).map(task => task.id));
    return filtered.filter(task => ids.has(task.id));
  };

  function render() {
    list.replaceChildren();
    for (const task of visibleTasks()) {
      const item = document.createElement('li'); item.className = `task-item${task.done ? ' done' : ''}`; item.dataset.id = task.id;
      const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'drag-handle'; handle.textContent = '☰'; handle.title = 'Arrastar para reorganizar'; handle.setAttribute('aria-label', `Arrastar ${task.title}`);
      if (!window.Sortable) {
        handle.draggable = true;
        handle.addEventListener('dragstart', event => {
          if (searchInput.value.trim()) { event.preventDefault(); return; }
          event.dataTransfer.setData('text/plain', task.id);
          event.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragover', event => { if (!searchInput.value.trim()) event.preventDefault(); });
        item.addEventListener('drop', event => {
          event.preventDefault();
          const movedId = event.dataTransfer.getData('text/plain');
          const source = tasks.findIndex(current => current.id === movedId);
          const target = tasks.findIndex(current => current.id === task.id);
          if (source < 0 || target < 0 || source === target) return;
          tasks.splice(target, 0, tasks.splice(source, 1)[0]);
          save(); render();
        });
      }
      const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'task-check'; check.checked = task.done; check.setAttribute('aria-label', `Concluir ${task.title}`);
      check.addEventListener('change', () => { task.done = check.checked; save(); render(); });
      const text = document.createElement('div'); text.className = 'task-text';
      const title = document.createElement('span'); title.className = 'task-title'; title.textContent = task.title;
      const deadline = document.createElement('span'); const info = dateText(task.date); deadline.className = `task-date${!task.done && info.remaining < 0 ? ' overdue' : !task.done && info.remaining <= 1 ? ' soon' : ''}`; deadline.textContent = info.label;
      text.append(title, deadline);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-task'; remove.textContent = '×'; remove.title = 'Excluir tarefa'; remove.setAttribute('aria-label', `Excluir ${task.title}`);
      remove.addEventListener('click', async () => {
        if (await ask({ title: 'Excluir tarefa?', text: task.title, icon: 'question', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', reverseButtons: true })) { tasks = tasks.filter(current => current.id !== task.id); save(); render(); }
      });
      item.append(handle, check, text, remove); list.append(item);
    }
    const pending = tasks.filter(task => !task.done).length;
    count.textContent = `${pending} pendente${pending === 1 ? '' : 's'} de ${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}`;
    empty.hidden = list.children.length > 0;
    empty.textContent = searchInput.value.trim() ? 'Nenhuma tarefa encontrada. Tente outro termo.' : 'Nenhuma tarefa neste filtro. Que tal adicionar uma?';
    clearDone.disabled = !tasks.some(task => task.done);
  }

  if (window.Sortable) new Sortable(list, { animation: 180, handle: '.drag-handle', filter: () => Boolean(searchInput.value.trim()), preventOnFilter: false, ghostClass: 'sortable-ghost', onEnd: () => {
    const visibleIds = [...list.children].map(item => item.dataset.id);
    const byId = new Map(tasks.map(task => [task.id, task]));
    const positions = tasks.map((task, index) => ({ task, index })).filter(entry => visibleIds.includes(entry.task.id)).map(entry => entry.index);
    positions.forEach((position, index) => { tasks[position] = byId.get(visibleIds[index]); });
    save(); render();
  }});

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const title = nameInput.value.trim(); const date = dateInput.value;
    if (!title || !validDate(date)) return;
    tasks.push({ id: makeId(), title, date, done: false }); save(); filter = 'all';
    filterButtons.forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    render(); form.reset(); dateInput.value = addDays(2); nameInput.focus();
    await notifyAdded();
  });
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    filterButtons.forEach(current => { const active = current === button; current.classList.toggle('active', active); current.setAttribute('aria-pressed', String(active)); });
    render();
  }));
  searchInput.addEventListener('input', render);
  clearDone.addEventListener('click', async () => {
    const total = tasks.filter(task => task.done).length;
    if (!total) return;
    if (await ask({ title: 'Limpar tarefas concluídas?', text: `${total} tarefa${total === 1 ? '' : 's'} será${total === 1 ? '' : 'ão'} removida${total === 1 ? '' : 's'}.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Limpar', cancelButtonText: 'Cancelar', reverseButtons: true })) { tasks = tasks.filter(task => !task.done); save(); render(); }
  });

  const [year, month, day] = today().split('-');
  todayLabel.textContent = `Hoje, ${day}/${month}/${year}`;
  dateInput.value = addDays(2);
  save(); render();
})();
