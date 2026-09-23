/**
 * SMCC Live - Shared Academic Store
 * Manages batches, students, and academic calendar events in localStorage.
 * Enables real-time synchronization between Teacher and Student dashboards
 * during local development, prototyping, and testing.
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'smcc_academic_store_v1';

  // Realistic seed data reflecting SMCC Live curriculum & batches
  const DEFAULT_DATA = {
    batches: [
      {
        id: 'batch-a',
        code: 'A',
        name: 'Batch A · Modern Indian History',
        subject: 'History',
        schedule: 'Mon, Wed, Fri · 10:00 AM',
        color: 'green',
        teacherName: 'Dr. Anika Roy',
        studentCount: 18,
        description: 'Comprehensive analysis of modern Indian freedom struggle, governance reforms, and socio-economic changes.',
      },
      {
        id: 'batch-b',
        code: 'B',
        name: 'Batch B · World Civilizations',
        subject: 'History',
        schedule: 'Tue, Thu · 02:30 PM',
        color: 'blue',
        teacherName: 'Dr. Anika Roy',
        studentCount: 16,
        description: 'Comparative study of Mediterranean, Asian, and Pre-Columbian historical architectures and governance.',
      },
      {
        id: 'batch-c',
        code: 'C',
        name: 'Batch C · Foundation Humanities',
        subject: 'Humanities',
        schedule: 'Sat · 11:00 AM',
        color: 'gold',
        teacherName: 'Dr. Anika Roy',
        studentCount: 14,
        description: 'Preparatory core modules covering critical historiography, research methodologies, and analytical writing.',
      }
    ],
    students: [
      { id: 'stu-1', batchId: 'batch-a', name: 'Niharika Sen', email: 'niharika.sen@smcc.edu', rollNo: 'HIS-2026-001', joinedDate: '2026-08-01', status: 'active' },
      { id: 'stu-2', batchId: 'batch-a', name: 'Aarav Sharma', email: 'aarav.s@smcc.edu', rollNo: 'HIS-2026-004', joinedDate: '2026-08-01', status: 'active' },
      { id: 'stu-3', batchId: 'batch-a', name: 'Priya Mukherjee', email: 'priya.m@smcc.edu', rollNo: 'HIS-2026-009', joinedDate: '2026-08-03', status: 'active' },
      { id: 'stu-4', batchId: 'batch-a', name: 'Devendra Patel', email: 'devendra.p@smcc.edu', rollNo: 'HIS-2026-012', joinedDate: '2026-08-05', status: 'active' },
      { id: 'stu-5', batchId: 'batch-b', name: 'Rohit Kulkarni', email: 'rohit.k@smcc.edu', rollNo: 'WCV-2026-002', joinedDate: '2026-08-02', status: 'active' },
      { id: 'stu-6', batchId: 'batch-b', name: 'Meera Iyer', email: 'meera.i@smcc.edu', rollNo: 'WCV-2026-007', joinedDate: '2026-08-02', status: 'active' },
      { id: 'stu-7', batchId: 'batch-c', name: 'Kabir Das', email: 'kabir.d@smcc.edu', rollNo: 'FND-2026-003', joinedDate: '2026-08-10', status: 'active' }
    ],
    events: [
      {
        id: 'evt-1',
        title: 'Modern Indian History: Lecture 8',
        type: 'class', // 'class' | 'assignment' | 'reading'
        batchId: 'batch-a',
        batchName: 'Batch A · Modern Indian History',
        date: '2026-09-23',
        time: '10:00 AM',
        duration: '75 mins',
        topics: 'Constitutional Assembly Debates (1946–1949), Preamble philosophies, and minority rights committees.',
        materials: 'Read Draft Constitution Committee Notes, pages 45–68.',
        isLiveNow: true,
        roomStatus: 'open'
      },
      {
        id: 'evt-2',
        title: 'Essay Submission: The Early Republic',
        type: 'assignment',
        batchId: 'batch-b',
        batchName: 'Batch B · World Civilizations',
        date: '2026-09-23',
        time: '02:30 PM',
        duration: '',
        topics: 'Critique the structural differences between Roman Republican governance and Athenian democracy.',
        materials: '1,200 words max, APA citations required, PDF only.',
        isLiveNow: false,
        status: 'pending'
      },
      {
        id: 'evt-3',
        title: 'Pre-class Reading: The Industrial Transition',
        type: 'reading',
        batchId: 'batch-c',
        batchName: 'Batch C · Foundation Humanities',
        date: '2026-09-23',
        time: '05:00 PM',
        duration: '45 mins reading',
        topics: 'Key concepts: Technological displacement, enclosure movements, and urbanization waves.',
        materials: 'Chapter 4 excerpt provided in the reading repository (PDF 2.4 MB).',
        isLiveNow: false
      },
      {
        id: 'evt-4',
        title: 'Colonial Land Revenue Systems',
        type: 'class',
        batchId: 'batch-a',
        batchName: 'Batch A · Modern Indian History',
        date: '2026-09-25',
        time: '10:00 AM',
        duration: '75 mins',
        topics: 'Permanent Settlement of Bengal (1793), Ryotwari and Mahalwari comparisons.',
        materials: 'Primary source excerpts from Cornwallis Regulations.',
        isLiveNow: false
      },
      {
        id: 'evt-5',
        title: 'Historiography Term Paper Outline Due',
        type: 'assignment',
        batchId: 'batch-a',
        batchName: 'Batch A · Modern Indian History',
        date: '2026-09-25',
        time: '06:00 PM',
        duration: '',
        topics: 'Submit thesis statement, 3 primary sources, and 5 annotated scholarly citations.',
        materials: 'Submit via student portal or email draft to instructor.',
        isLiveNow: false
      },
      {
        id: 'evt-6',
        title: 'Read: Post-War Economic Reconstruction',
        type: 'reading',
        batchId: 'batch-b',
        batchName: 'Batch B · World Civilizations',
        date: '2026-09-28',
        time: '09:00 AM',
        duration: '60 mins',
        topics: 'Marshall Plan logistics and Bretton Woods monetary architecture.',
        materials: 'Keynes vs. White archival summaries (JSTOR link / PDF in Materials).',
        isLiveNow: false
      },
      {
        id: 'evt-7',
        title: 'Weekly Seminar: Historiographical Methods',
        type: 'class',
        batchId: 'batch-c',
        batchName: 'Batch C · Foundation Humanities',
        date: '2026-09-26',
        time: '11:00 AM',
        duration: '90 mins',
        topics: 'Subaltern studies vs. Cambridge School interpretations.',
        materials: 'Guha and Spivak introductory essays.',
        isLiveNow: false
      }
    ],
    studentProgress: {
      completedReadings: ['evt-3'],
      submittedAssignments: []
    }
  };

  class AcademicStore {
    constructor() {
      this.listeners = new Set();
      this.init();
    }

    init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
          this.save();
        } else {
          this.data = JSON.parse(raw);
          // Ensure schema completeness
          if (!Array.isArray(this.data.batches)) this.data.batches = DEFAULT_DATA.batches;
          if (!Array.isArray(this.data.students)) this.data.students = DEFAULT_DATA.students;
          if (!Array.isArray(this.data.events)) this.data.events = DEFAULT_DATA.events;
          if (!this.data.studentProgress) this.data.studentProgress = DEFAULT_DATA.studentProgress;
        }
      } catch (e) {
        console.warn('Failed to parse academic store from localStorage, using defaults.', e);
        this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }

      // Listen for cross-tab or cross-window updates
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.data = JSON.parse(e.newValue);
            this.notify();
          } catch (err) {
            console.error('Storage sync error:', err);
          }
        }
      });
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.notify();
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify() {
      for (const listener of this.listeners) {
        try {
          listener(this.data);
        } catch (e) {
          console.error('Store listener error:', e);
        }
      }
    }

    // --- Batches ---
    getBatches() {
      return [...this.data.batches];
    }

    getBatchById(id) {
      return this.data.batches.find((b) => b.id === id) || null;
    }

    addBatch(batch) {
      const id = 'batch-' + (batch.name || 'new').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) + '-' + Date.now().toString().slice(-4);
      const code = (batch.code || batch.name.charAt(0) || 'D').toUpperCase();
      const newBatch = {
        id,
        code,
        name: batch.name.trim(),
        subject: batch.subject?.trim() || 'General',
        schedule: batch.schedule?.trim() || 'Flexible',
        color: batch.color || ['green', 'blue', 'gold', 'purple'][this.data.batches.length % 4],
        teacherName: batch.teacherName || 'Dr. Anika Roy',
        studentCount: 0,
        description: batch.description?.trim() || 'Active study batch for SMCC Live.'
      };
      this.data.batches.push(newBatch);
      this.save();
      return newBatch;
    }

    // --- Students ---
    getStudents(batchId = null) {
      if (!batchId) return [...this.data.students];
      return this.data.students.filter((s) => s.batchId === batchId);
    }

    addStudentToBatch(batchId, student) {
      const batch = this.getBatchById(batchId);
      if (!batch) throw new Error('Batch not found');

      const id = 'stu-' + Date.now().toString().slice(-6);
      const rollNo = student.rollNo?.trim() || `${batch.code || 'BCH'}-2026-${String(this.data.students.length + 1).padStart(3, '0')}`;
      const newStudent = {
        id,
        batchId,
        name: student.name.trim(),
        email: student.email.trim(),
        rollNo,
        joinedDate: student.joinedDate || new Date().toISOString().split('T')[0],
        status: 'active'
      };

      this.data.students.push(newStudent);
      batch.studentCount = this.getStudents(batchId).length;
      this.save();
      return newStudent;
    }

    removeStudent(studentId) {
      const idx = this.data.students.findIndex((s) => s.id === studentId);
      if (idx !== -1) {
        const student = this.data.students[idx];
        this.data.students.splice(idx, 1);
        const batch = this.getBatchById(student.batchId);
        if (batch) {
          batch.studentCount = this.getStudents(student.batchId).length;
        }
        this.save();
      }
    }

    // --- Events (Academic Calendar) ---
    getEvents(dateFilter = null) {
      if (!dateFilter) return [...this.data.events];
      return this.data.events.filter((e) => e.date === dateFilter);
    }

    getEventsByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return this.data.events.filter((e) => e.date.startsWith(prefix));
    }

    getEventById(id) {
      return this.data.events.find((e) => e.id === id) || null;
    }

    addEvent(event) {
      const id = 'evt-' + Date.now().toString().slice(-6);
      const batch = this.getBatchById(event.batchId);
      const newEvent = {
        id,
        title: event.title.trim(),
        type: event.type || 'class',
        batchId: event.batchId || 'all',
        batchName: batch ? batch.name : 'All Batches',
        date: event.date, // 'YYYY-MM-DD'
        time: event.time || '10:00 AM',
        duration: event.duration || (event.type === 'class' ? '60 mins' : ''),
        topics: event.topics?.trim() || '',
        materials: event.materials?.trim() || '',
        isLiveNow: Boolean(event.isLiveNow),
        roomStatus: event.type === 'class' ? 'scheduled' : undefined
      };
      this.data.events.push(newEvent);
      this.save();
      return newEvent;
    }

    updateEvent(id, updates) {
      const event = this.getEventById(id);
      if (!event) throw new Error('Event not found');
      if (updates.batchId && updates.batchId !== event.batchId) {
        const batch = this.getBatchById(updates.batchId);
        event.batchName = batch ? batch.name : 'All Batches';
      }
      Object.assign(event, updates);
      this.save();
      return event;
    }

    deleteEvent(id) {
      const idx = this.data.events.findIndex((e) => e.id === id);
      if (idx !== -1) {
        this.data.events.splice(idx, 1);
        this.save();
      }
    }

    // --- Student Progress ---
    toggleAssignmentStatus(eventId) {
      if (!this.data.studentProgress) this.data.studentProgress = { completedReadings: [], submittedAssignments: [] };
      const list = this.data.studentProgress.submittedAssignments;
      const idx = list.indexOf(eventId);
      if (idx === -1) {
        list.push(eventId);
      } else {
        list.splice(idx, 1);
      }
      this.save();
      return list.includes(eventId);
    }

    toggleReadingCompleted(eventId) {
      if (!this.data.studentProgress) this.data.studentProgress = { completedReadings: [], submittedAssignments: [] };
      const list = this.data.studentProgress.completedReadings;
      const idx = list.indexOf(eventId);
      if (idx === -1) {
        list.push(eventId);
      } else {
        list.splice(idx, 1);
      }
      this.save();
      return list.includes(eventId);
    }

    isAssignmentSubmitted(eventId) {
      return this.data.studentProgress?.submittedAssignments?.includes(eventId) || false;
    }

    isReadingCompleted(eventId) {
      return this.data.studentProgress?.completedReadings?.includes(eventId) || false;
    }

    resetToDefaults() {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      this.save();
    }
  }

  // Export globally for browser use
  window.SMCC_STORE = new AcademicStore();
})();

