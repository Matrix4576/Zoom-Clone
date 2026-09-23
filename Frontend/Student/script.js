/**
 * SMCC Live - Student Dashboard Logic
 * Provides a calm, distraction-free learning schedule, dynamic academic calendar,
 * topic outlines, reading materials tracking, and live classroom join gateway.
 */

(() => {
  'use strict';

  const store = window.SMCC_STORE;
  if (!store) {
    console.error('SMCC_STORE is not loaded.');
    return;
  }

  // --- Student State ---
  const STUDENT_BATCH_ID = 'batch-a'; // Niharika Sen is enrolled in Batch A
  let viewYear = 2026;
  let viewMonth = 8; // 0-indexed: 8 = September
  let selectedDate = '2026-09-23';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // DOM Elements
  const calendarTitle = document.querySelector('#calendar-title');
  const calendarGrid = document.querySelector('#calendar-grid');
  const calPrevBtn = document.querySelector('#cal-prev-btn');
  const calNextBtn = document.querySelector('#cal-next-btn');
  const calTodayBtn = document.querySelector('#cal-today-btn');

  const agendaHeading = document.querySelector('#agenda-date-heading');
  const agendaCountBadge = document.querySelector('#agenda-count-badge');
  const agendaList = document.querySelector('#agenda-list');

  const liveBanner = document.querySelector('#live-banner');
  const liveBannerTitle = document.querySelector('#live-banner-title');
  const liveBannerTopics = document.querySelector('#live-banner-topics');
  const liveBannerJoinBtn = document.querySelector('#live-banner-join-btn');

  const batchNameDisplay = document.querySelector('#batch-name-display');
  const batchScheduleDisplay = document.querySelector('#batch-schedule-display');
  const batchDescDisplay = document.querySelector('#batch-desc-display');

  // Modals
  const detailModal = document.querySelector('#detail-modal');
  const detailCategoryBadge = document.querySelector('#detail-category-badge');
  const detailTitle = document.querySelector('#detail-title');
  const detailBatchName = document.querySelector('#detail-batch-name');
  const detailDatetime = document.querySelector('#detail-datetime');
  const detailDuration = document.querySelector('#detail-duration');
  const detailDurationBlock = document.querySelector('#detail-duration-block');
  const detailTopicsWrap = document.querySelector('#detail-topics-wrap');
  const detailTopics = document.querySelector('#detail-topics');
  const detailMaterialsWrap = document.querySelector('#detail-materials-wrap');
  const detailMaterials = document.querySelector('#detail-materials');
  const detailActionBtn = document.querySelector('#detail-action-btn');

  const classroomModal = document.querySelector('#classroom-modal');
  const classroomTitle = document.querySelector('#classroom-title');
  const enterRoomBtn = document.querySelector('#enter-room-btn');

  // Mobile Drawer
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

  // Mobile Drawer
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

  // --- Calendar Rendering ---
  const renderCalendar = () => {
    calendarTitle.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const firstDayObj = new Date(viewYear, viewMonth, 1);
    let startDay = firstDayObj.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Student events for this month (filter by student's batch or 'all')
    const allMonthEvents = store.getEventsByMonth(viewYear, viewMonth + 1);
    const studentEvents = allMonthEvents.filter(
      (e) => e.batchId === STUDENT_BATCH_ID || e.batchId === 'all'
    );

    calendarGrid.innerHTML = '';

    // 1. Previous month trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day muted';
      cell.innerHTML = `<span class="cal-day-num">${dayNum}</span>`;
      calendarGrid.appendChild(cell);
    }

    // 2. Active days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.dataset.date = dateStr;

      const isToday = dateStr === '2026-09-23';
      const isSelected = dateStr === selectedDate;

      if (isToday) cell.classList.add('today');
      if (isSelected) cell.classList.add('selected');

      const numSpan = document.createElement('span');
      numSpan.className = 'cal-day-num';
      numSpan.textContent = day;
      cell.appendChild(numSpan);

      // Event dots for student's relevant events
      const dayEvents = studentEvents.filter((e) => e.date === dateStr);
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

    // 3. Trailing days
    const totalRendered = startDay + daysInMonth;
    const remaining = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);
    for (let day = 1; day <= remaining; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day muted';
      cell.innerHTML = `<span class="cal-day-num">${day}</span>`;
      calendarGrid.appendChild(cell);
    }
  };

  // Month Navigation
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

  // --- Agenda Rendering ---
  const renderAgenda = () => {
    agendaHeading.textContent = selectedDate === '2026-09-23'
      ? 'Today, 23 Sep'
      : formatFriendlyDate(selectedDate);

    // Get events for selectedDate for student's batch or all
    const dayEvents = store.getEvents(selectedDate).filter(
      (e) => e.batchId === STUDENT_BATCH_ID || e.batchId === 'all'
    );

    agendaCountBadge.textContent = `${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}`;
    agendaList.innerHTML = '';

    if (dayEvents.length === 0) {
      agendaList.innerHTML = `
        <div class="agenda-empty">
          <div class="agenda-empty-icon">☕</div>
          <p>No lectures, readings, or deadlines for this day.</p>
        </div>
      `;
      return;
    }

    dayEvents.forEach((event) => {
      const card = document.createElement('div');
      card.className = 'agenda-card';

      const typeLabel = event.type === 'class' ? 'Class & Discussion' : event.type === 'assignment' ? 'Assignment Due' : 'Reading Material';
      const typeClass = event.type;

      let statusHtml = '';
      let actionBtnHtml = '';

      if (event.type === 'class') {
        actionBtnHtml = `<button class="action-btn-pill join" data-action="join" type="button">Join Class</button>`;
        statusHtml = `<span class="status-tag">Room opens 10m early</span>`;
      } else if (event.type === 'assignment') {
        const isSubmitted = store.isAssignmentSubmitted(event.id);
        statusHtml = `<span class="status-tag ${isSubmitted ? 'done' : ''}">${isSubmitted ? '✓ Submitted' : 'Pending Submission'}</span>`;
        actionBtnHtml = `<button class="action-btn-pill check" data-action="toggle-assignment" type="button">${isSubmitted ? 'Undo' : 'Mark Done'}</button>`;
      } else if (event.type === 'reading') {
        const isRead = store.isReadingCompleted(event.id);
        statusHtml = `<span class="status-tag ${isRead ? 'done' : ''}">${isRead ? '✓ Completed' : 'Pending Reading'}</span>`;
        actionBtnHtml = `<button class="action-btn-pill check" data-action="toggle-reading" type="button">${isRead ? 'Undo' : 'Mark Read'}</button>`;
      }

      card.innerHTML = `
        <div class="agenda-card-top">
          <span class="agenda-badge ${typeClass}">
            <i class="dot ${event.type === 'class' ? 'lesson' : event.type}"></i> ${typeLabel}
          </span>
          <span class="agenda-time">${event.time || ''}</span>
        </div>
        <h4 class="agenda-card-title">${event.title}</h4>
        ${event.topics ? `<div class="agenda-card-topics-preview"><strong>Topic:</strong> ${event.topics}</div>` : ''}
        <div class="agenda-card-footer">
          ${statusHtml}
          ${actionBtnHtml}
        </div>
      `;

      // Card click opens detail inspection
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return; // let action button handle
        openDetailModal(event);
      });

      // Actions
      const joinBtn = card.querySelector('[data-action="join"]');
      if (joinBtn) {
        joinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openClassroomModal(event);
        });
      }

      const toggleAssignBtn = card.querySelector('[data-action="toggle-assignment"]');
      if (toggleAssignBtn) {
        toggleAssignBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const submitted = store.toggleAssignmentStatus(event.id);
          showToast(submitted ? 'Assignment marked as submitted!' : 'Assignment marked as pending.');
          renderAgenda();
        });
      }

      const toggleReadBtn = card.querySelector('[data-action="toggle-reading"]');
      if (toggleReadBtn) {
        toggleReadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const read = store.toggleReadingCompleted(event.id);
          showToast(read ? 'Reading marked as completed!' : 'Reading marked as pending.');
          renderAgenda();
        });
      }

      agendaList.appendChild(card);
    });
  };

  // --- Live Class Banner ---
  const updateLiveBanner = () => {
    // Check if there is a class on '2026-09-23' for student
    const todayClasses = store.getEvents('2026-09-23').filter(
      (e) => (e.batchId === STUDENT_BATCH_ID || e.batchId === 'all') && e.type === 'class'
    );

    if (todayClasses.length > 0) {
      const liveClass = todayClasses[0];
      liveBanner.style.display = 'flex';
      liveBannerTitle.textContent = liveClass.title;
      liveBannerTopics.textContent = liveClass.topics ? `Topics: ${liveClass.topics}` : 'Live WebRTC tutorial session with Dr. Anika Roy.';
      liveBannerJoinBtn.onclick = () => openClassroomModal(liveClass);
    } else {
      liveBanner.style.display = 'none';
    }
  };

  // --- Enrolled Batch Info ---
  const updateBatchInfo = () => {
    const batch = store.getBatchById(STUDENT_BATCH_ID);
    if (!batch) return;

    batchNameDisplay.textContent = batch.name;
    batchScheduleDisplay.textContent = batch.schedule;
    batchDescDisplay.textContent = `Instructor: ${batch.teacherName || 'Dr. Anika Roy'} · Focus: ${batch.description}`;
  };

  // --- Detail Inspection Modal ---
  const openDetailModal = (event) => {
    detailCategoryBadge.textContent = event.type === 'class' ? 'CLASS & TOPICS' : event.type === 'assignment' ? 'ASSIGNMENT DETAILS' : 'READING MATERIAL';
    detailTitle.textContent = event.title;
    detailBatchName.textContent = event.batchName || 'Batch A';
    detailDatetime.textContent = `${formatFriendlyDate(event.date)} · ${event.time || 'Schedule announced'}`;

    if (event.duration) {
      detailDurationBlock.style.display = 'block';
      detailDuration.textContent = event.duration;
    } else {
      detailDurationBlock.style.display = 'none';
    }

    if (event.topics) {
      detailTopicsWrap.style.display = 'block';
      detailTopics.textContent = event.topics;
    } else {
      detailTopicsWrap.style.display = 'none';
    }

    if (event.materials) {
      detailMaterialsWrap.style.display = 'block';
      detailMaterials.textContent = event.materials;
    } else {
      detailMaterialsWrap.style.display = 'none';
    }

    if (event.type === 'class') {
      detailActionBtn.style.display = 'inline-flex';
      detailActionBtn.textContent = 'Enter Live Classroom';
      detailActionBtn.onclick = () => {
        closeModal(detailModal);
        openClassroomModal(event);
      };
    } else if (event.type === 'assignment') {
      const isSubmitted = store.isAssignmentSubmitted(event.id);
      detailActionBtn.style.display = 'inline-flex';
      detailActionBtn.textContent = isSubmitted ? 'Mark as Incomplete' : 'Mark as Submitted';
      detailActionBtn.onclick = () => {
        store.toggleAssignmentStatus(event.id);
        showToast('Assignment status updated.');
        closeModal(detailModal);
        renderAgenda();
      };
    } else {
      detailActionBtn.style.display = 'none';
    }

    openModal(detailModal);
  };

  // --- Classroom Simulation Modal ---
  const openClassroomModal = (event) => {
    classroomTitle.textContent = event?.title || 'Modern Indian History';
    openModal(classroomModal);
  };

  enterRoomBtn?.addEventListener('click', () => {
    enterRoomBtn.disabled = true;
    enterRoomBtn.textContent = 'Connecting to LiveKit SFU...';
    setTimeout(() => {
      enterRoomBtn.disabled = false;
      enterRoomBtn.textContent = 'Enter Live Classroom';
      closeModal(classroomModal);
      showToast('Admitted to Live Classroom room session.');
    }, 1200);
  });

  // Reading feature CTA
  document.querySelector('#open-reading-btn')?.addEventListener('click', () => {
    const readingEvt = store.getEvents().find((e) => e.type === 'reading');
    if (readingEvt) {
      openDetailModal(readingEvt);
    } else {
      showToast('Opening repository materials...');
    }
  });

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

  // Auto-subscribe to storage updates (e.g. when teacher adds/edits events or batches)
  store.subscribe(() => {
    renderCalendar();
    renderAgenda();
    updateLiveBanner();
    updateBatchInfo();
  });

  // --- Initialize ---
  renderCalendar();
  renderAgenda();
  updateLiveBanner();
  updateBatchInfo();
})();