/**
 * SMCC Live - Teacher Dashboard Logic
 * Powers dynamic academic calendar rendering, event creation/editing/deletion,
 * batch management, and student cohort rosters with real-time localStorage sync.
 */

(() => {
  'use strict';

  const store = window.SMCC_STORE;
  if (!store) {
    console.error('SMCC_STORE is not loaded.');
    return;
  }

  // --- State ---
  let viewYear = 2026;
  let viewMonth = 8; // 0-indexed: 8 = September
  let selectedDate = '2026-09-23';
  let activeRosterBatchId = null;

  // Month names
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // DOM Elements
  const calendarTitle = document.querySelector('#calendar-title');
  const calendarGrid = document.querySelector('#calendar-grid');
  const calPrevBtn = document.querySelector('#cal-prev-btn');
  const calNextBtn = document.querySelector('#cal-next-btn');
  const calTodayBtn = document.querySelector('#cal-today-btn');

  const agendaHeading = document.querySelector('#agenda-date-heading');
  const agendaList = document.querySelector('#agenda-list');
  const agendaAddBtn = document.querySelector('#agenda-add-event-btn');
  const agendaClassShortcut = document.querySelector('#agenda-create-class-shortcut');

  const batchList = document.querySelector('#batch-list');
  const statBatchCount = document.querySelector('#stat-batch-count');
  const statBatchActive = document.querySelector('#stat-batch-active');
  const statStudentCount = document.querySelector('#stat-student-count');
  const statEventCount = document.querySelector('#stat-event-count');
  const sidebarBatchCount = document.querySelector('#sidebar-batch-count');

  // Modals & Backdrops
  const eventModal = document.querySelector('#event-modal');
  const eventForm = document.querySelector('#event-form');
  const eventModalTitle = document.querySelector('#event-modal-title');
  const eventIdInput = document.querySelector('#event-id');
  const eventBatchSelect = document.querySelector('#event-batch');

  const batchModal = document.querySelector('#batch-modal');
  const batchForm = document.querySelector('#batch-form');

  const rosterModal = document.querySelector('#roster-modal');
  const rosterBatchCode = document.querySelector('#roster-batch-code');
  const rosterModalTitle = document.querySelector('#roster-modal-title');
  const rosterCount = document.querySelector('#roster-count');
  const rosterTableBody = document.querySelector('#roster-table-body');
  const addStudentForm = document.querySelector('#add-student-form');
  const rosterBatchIdInput = document.querySelector('#roster-batch-id');

  // Mobile drawer
  const mobileMenuBtn = document.querySelector('#mobile-menu-btn');
  const sidebar = document.querySelector('#sidebar');
  const sidebarBackdrop = document.querySelector('#sidebar-backdrop');
  const signOutBtn = document.querySelector('#sign-out-btn');
  const toastContainer = document.querySelector('#toast-container');

  // Helper: Toast message
  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  };

  // Helper: Format Date String to Readable
  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('en-GB', options);
  };

  // --- Modal Helpers ---
  const openModal = (modal) => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  };

  const closeModal = (modal) => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const backdrop = e.target.closest('.modal-backdrop');
      if (backdrop) closeModal(backdrop);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal);
      if (sidebar.classList.contains('open')) closeSidebar();
    }
  });

  // Mobile menu drawer
  const openSidebar = () => {
    sidebar.classList.add('open');
    sidebarBackdrop.classList.add('active');
  };

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('active');
  };

  mobileMenuBtn?.addEventListener('click', openSidebar);
  sidebarBackdrop?.addEventListener('click', closeSidebar);

  // --- Calendar Logic ---
  const renderCalendar = () => {
    calendarTitle.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    // Get first day of month (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDayObj = new Date(viewYear, viewMonth, 1);
    // Convert to Monday=0 .. Sunday=6
    let startDay = firstDayObj.getDay() - 1;
    if (startDay < 0) startDay = 6;

    // Total days in view month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Days in previous month
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Fetch events for this month
    const monthEvents = store.getEventsByMonth(viewYear, viewMonth + 1);

    calendarGrid.innerHTML = '';

    // 1. Previous month trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day muted';
      cell.innerHTML = `<span class="cal-day-num">${dayNum}</span>`;
      calendarGrid.appendChild(cell);
    }

    // 2. Active days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.dataset.date = dateStr;

      const isToday = dateStr === '2026-09-23'; // Academic timeline reference
      const isSelected = dateStr === selectedDate;

      if (isToday) cell.classList.add('today');
      if (isSelected) cell.classList.add('selected');

      // Day number
      const numSpan = document.createElement('span');
      numSpan.className = 'cal-day-num';
      numSpan.textContent = day;
      cell.appendChild(numSpan);

      // Event dots
      const dayEvents = monthEvents.filter((e) => e.date === dateStr);
      if (dayEvents.length > 0) {
        const indicators = document.createElement('div');
        indicators.className = 'cal-day-indicators';
        dayEvents.slice(0, 3).forEach((ev) => {
          const dot = document.createElement('span');
          dot.className = `cal-event-dot dot ${ev.type === 'class' ? 'lesson' : ev.type}`;
          indicators.appendChild(dot);
        });
        cell.appendChild(indicators);
      }

      cell.addEventListener('click', () => {
        selectedDate = dateStr;
        document.querySelectorAll('.cal-day.selected').forEach((c) => c.classList.remove('selected'));
        cell.classList.add('selected');
        renderAgenda();
      });

      calendarGrid.appendChild(cell);
    }

    // 3. Trailing days to fill standard 35 or 42 grid cells
    const totalRendered = startDay + daysInMonth;
    const remaining = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);
    for (let day = 1; day <= remaining; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day muted';
      cell.innerHTML = `<span class="cal-day-num">${day}</span>`;
      calendarGrid.appendChild(cell);
    }
  };

  // Month navigation
  calPrevBtn?.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    renderCalendar();
  });

  calNextBtn?.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderCalendar();
  });

  calTodayBtn?.addEventListener('click', () => {
    viewYear = 2026;
    viewMonth = 8;
    selectedDate = '2026-09-23';
    renderCalendar();
    renderAgenda();
  });

  // --- Agenda Logic ---
  const renderAgenda = () => {
    agendaHeading.textContent = selectedDate === '2026-09-23'
      ? 'Today, 23 Sep'
      : formatFriendlyDate(selectedDate);

    const dayEvents = store.getEvents(selectedDate);
    agendaList.innerHTML = '';

    if (dayEvents.length === 0) {
      agendaList.innerHTML = `
        <div class="agenda-empty">
          <div class="agenda-empty-icon">◻</div>
          <p>No lectures, readings, or deadlines scheduled for this date.</p>
        </div>
      `;
      return;
    }

    dayEvents.forEach((event) => {
      const card = document.createElement('div');
      card.className = 'agenda-card';

      const typeLabel = event.type === 'class' ? 'Class & Discussion' : event.type === 'assignment' ? 'Assignment Due' : 'Reading Material';
      const typeClass = event.type;

      card.innerHTML = `
        <div class="agenda-card-top">
          <span class="agenda-badge ${typeClass}">
            <i class="dot ${event.type === 'class' ? 'lesson' : event.type}"></i> ${typeLabel}
          </span>
          <span class="agenda-time">${event.time || ''}</span>
        </div>
        <h4 class="agenda-card-title">${event.title}</h4>
        <span class="agenda-card-batch">${event.batchName}</span>
        ${event.topics ? `<div class="agenda-card-topics"><strong>Topics to discuss:</strong> ${event.topics}</div>` : ''}
        ${event.materials ? `<div class="agenda-card-materials"><strong>Reading / Instructions:</strong> ${event.materials}</div>` : ''}
        <div class="agenda-card-actions">
          <button class="item-btn edit" data-action="edit" data-id="${event.id}">✎ Edit</button>
          <button class="item-btn delete" data-action="delete" data-id="${event.id}">✕ Remove</button>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditEventModal(event.id));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (confirm(`Remove "${event.title}" from the academic calendar?`)) {
          store.deleteEvent(event.id);
          showToast('Event removed from calendar.');
          renderCalendar();
          renderAgenda();
          updateMetrics();
        }
      });

      agendaList.appendChild(card);
    });
  };

  // --- Batches Management Logic ---
  const renderBatches = () => {
    const batches = store.getBatches();
    batchList.innerHTML = '';

    batches.forEach((batch) => {
      const students = store.getStudents(batch.id);
      const row = document.createElement('div');
      row.className = 'batch-row';
      row.innerHTML = `
        <div class="batch-code ${batch.color || 'green'}">${batch.code || 'B'}</div>
        <div class="batch-details">
          <strong>${batch.name}</strong>
          <span>${batch.schedule || 'Flexible'} · ${batch.subject || 'Tutorial'}</span>
        </div>
        <span class="batch-count-pill">${students.length} Learners</span>
        <button class="batch-manage-btn" type="button" data-batch-id="${batch.id}">
          Manage Roster
        </button>
      `;

      row.querySelector('.batch-manage-btn').addEventListener('click', () => {
        openRosterModal(batch.id);
      });

      batchList.appendChild(row);
    });
  };

  // Populate Batch Select dropdowns
  const populateBatchDropdowns = () => {
    const batches = store.getBatches();
    eventBatchSelect.innerHTML = '<option value="all">All Batches</option>';
    batches.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      eventBatchSelect.appendChild(opt);
    });
  };

  // --- Metrics ---
  const updateMetrics = () => {
    const batches = store.getBatches();
    const students = store.getStudents();
    const events = store.getEvents();

    statBatchCount.textContent = batches.length;
    statBatchActive.textContent = `${batches.length} cohorts`;
    sidebarBatchCount.textContent = batches.length;
    statStudentCount.textContent = students.length;
    statEventCount.textContent = events.length;
  };

  // --- Event Modal Handling ---
  const openNewEventModal = (prefilledDate = null, defaultType = 'class') => {
    eventForm.reset();
    eventIdInput.value = '';
    eventModalTitle.textContent = 'Schedule Academic Event';
    document.querySelector('#event-date').value = prefilledDate || selectedDate || '2026-09-23';
    document.querySelector('#event-type').value = defaultType;
    populateBatchDropdowns();
    openModal(eventModal);
  };

  const openEditEventModal = (eventId) => {
    const event = store.getEventById(eventId);
    if (!event) return;

    populateBatchDropdowns();
    eventIdInput.value = event.id;
    eventModalTitle.textContent = 'Edit Academic Event';
    document.querySelector('#event-title').value = event.title;
    document.querySelector('#event-type').value = event.type;
    document.querySelector('#event-batch').value = event.batchId;
    document.querySelector('#event-date').value = event.date;
    document.querySelector('#event-time').value = event.time || '';
    document.querySelector('#event-topics').value = event.topics || '';
    document.querySelector('#event-materials').value = event.materials || '';

    openModal(eventModal);
  };

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = eventIdInput.value.trim();
    const title = document.querySelector('#event-title').value.trim();
    const type = document.querySelector('#event-type').value;
    const batchId = document.querySelector('#event-batch').value;
    const date = document.querySelector('#event-date').value;
    const time = document.querySelector('#event-time').value.trim();
    const topics = document.querySelector('#event-topics').value.trim();
    const materials = document.querySelector('#event-materials').value.trim();

    if (!title || !date) {
      alert('Please fill out the required title and date.');
      return;
    }

    if (id) {
      store.updateEvent(id, { title, type, batchId, date, time, topics, materials });
      showToast('Event updated successfully.');
    } else {
      store.addEvent({ title, type, batchId, date, time, topics, materials });
      showToast('New event scheduled on calendar.');
    }

    closeModal(eventModal);
    renderCalendar();
    renderAgenda();
    updateMetrics();
  });

  // --- Batch Creation Modal ---
  batchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.querySelector('#batch-name').value.trim();
    const subject = document.querySelector('#batch-subject').value.trim();
    const color = document.querySelector('#batch-color').value;
    const schedule = document.querySelector('#batch-schedule').value.trim();
    const description = document.querySelector('#batch-description').value.trim();

    if (!name || !schedule) {
      alert('Please provide batch name and schedule rhythm.');
      return;
    }

    store.addBatch({ name, subject, color, schedule, description });
    showToast(`Batch "${name}" created.`);
    batchForm.reset();
    closeModal(batchModal);
    renderBatches();
    populateBatchDropdowns();
    updateMetrics();
  });

  // --- Roster Modal Handling ---
  const openRosterModal = (batchId) => {
    activeRosterBatchId = batchId;
    const batch = store.getBatchById(batchId);
    if (!batch) return;

    rosterBatchIdInput.value = batchId;
    rosterBatchCode.textContent = `BATCH ${batch.code || 'COHORT'}`;
    rosterModalTitle.textContent = batch.name;
    document.querySelector('#roster-batch-subtitle').textContent =
      `${batch.schedule || 'Scheduled session'} · Primary Instructor: ${batch.teacherName || 'Dr. Anika Roy'}`;

    renderRosterTable(batchId);
    openModal(rosterModal);
  };

  const renderRosterTable = (batchId) => {
    const students = store.getStudents(batchId);
    rosterCount.textContent = students.length;
    rosterTableBody.innerHTML = '';

    if (students.length === 0) {
      rosterTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--muted); padding: 24px;">
            No students currently enrolled in this batch. Use the form above to add learners.
          </td>
        </tr>
      `;
      return;
    }

    students.forEach((stu) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${stu.name}</strong><br>
          <small style="color: #7b8882;">${stu.email}</small>
        </td>
        <td><code>${stu.rollNo || 'Pending'}</code></td>
        <td><span style="color: #27664c; font-weight: 600;">Active</span></td>
        <td>
          <button class="roster-remove-btn" type="button" data-stu-id="${stu.id}">Remove</button>
        </td>
      `;

      tr.querySelector('.roster-remove-btn').addEventListener('click', () => {
        if (confirm(`Remove student ${stu.name} from this batch?`)) {
          store.removeStudent(stu.id);
          showToast(`Student removed from batch.`);
          renderRosterTable(batchId);
          renderBatches();
          updateMetrics();
        }
      });

      rosterTableBody.appendChild(tr);
    });
  };

  addStudentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const batchId = rosterBatchIdInput.value;
    const name = document.querySelector('#student-name').value.trim();
    const email = document.querySelector('#student-email').value.trim();
    const rollNo = document.querySelector('#student-roll').value.trim();

    if (!name || !email) {
      alert('Please enter student full name and valid email.');
      return;
    }

    store.addStudentToBatch(batchId, { name, email, rollNo });
    showToast(`Added ${name} to batch.`);
    addStudentForm.reset();
    renderRosterTable(batchId);
    renderBatches();
    updateMetrics();
  });

  // --- Button Event Listeners ---
  document.querySelector('#open-event-modal-btn')?.addEventListener('click', () => openNewEventModal());
  document.querySelector('#topbar-quick-add')?.addEventListener('click', () => openNewEventModal());
  agendaAddBtn?.addEventListener('click', () => openNewEventModal(selectedDate));
  agendaClassShortcut?.addEventListener('click', () => openNewEventModal(selectedDate, 'class'));

  document.querySelector('#open-batch-modal-btn')?.addEventListener('click', () => openModal(batchModal));
  document.querySelector('#create-batch-top-btn')?.addEventListener('click', () => openModal(batchModal));
  document.querySelector('#qa-new-batch')?.addEventListener('click', () => openModal(batchModal));

  document.querySelector('#qa-add-reading')?.addEventListener('click', () => openNewEventModal(selectedDate, 'reading'));
  document.querySelector('#qa-add-assignment')?.addEventListener('click', () => openNewEventModal(selectedDate, 'assignment'));

  // Sign out
  signOutBtn?.addEventListener('click', async () => {
    if (window.SMCC_SUPABASE_CONFIG?.url && window.supabase) {
      try {
        const { createClient } = window.supabase;
        const client = createClient(window.SMCC_SUPABASE_CONFIG.url, window.SMCC_SUPABASE_CONFIG.anonKey);
        await client.auth.signOut();
      } catch (err) {
        console.warn('Sign-out error:', err);
      }
    }
    window.location.assign(new URL('../Login/', window.location.href));
  });

  // Auto-subscribe to storage updates (e.g. if student updates status or cross-tab sync)
  store.subscribe(() => {
    renderCalendar();
    renderAgenda();
    renderBatches();
    updateMetrics();
    if (activeRosterBatchId && !rosterModal.hidden) {
      renderRosterTable(activeRosterBatchId);
    }
  });

  // --- Initialize ---
  populateBatchDropdowns();
  renderCalendar();
  renderAgenda();
  renderBatches();
  updateMetrics();
})();