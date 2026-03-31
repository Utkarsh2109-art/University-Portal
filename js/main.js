(function () {
  const STORAGE_KEY = "campusflow-portal-data-v1";
  const SESSION_KEY = "campusflow-portal-session-v1";
  const PAGE_BY_ROLE = {
    admin: "admin.html",
    student: "student.html",
    instructor: "instructor.html",
  };

  let cache = null;

  const courseTemplates = [
    { id: "CSE101", name: "Programming Fundamentals", semester: 1, department: "Computer Science", creditHours: 3, classroom: "Lab 1" },
    { id: "MAT102", name: "Discrete Mathematics", semester: 1, department: "Mathematics", creditHours: 4, classroom: "Room 204" },
    { id: "ENG103", name: "Technical Communication", semester: 1, department: "Humanities", creditHours: 2, classroom: "Room 105" },
    { id: "DBS201", name: "Database Systems", semester: 2, department: "Computer Science", creditHours: 3, classroom: "Room 311" },
    { id: "WEB202", name: "Web Engineering", semester: 2, department: "Computer Science", creditHours: 3, classroom: "Studio 2" },
    { id: "STA203", name: "Statistics for Computing", semester: 2, department: "Mathematics", creditHours: 3, classroom: "Room 118" },
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomDigitString(length) {
    const digits = [];

    if (window.crypto && window.crypto.getRandomValues) {
      const bucket = new Uint32Array(length);
      window.crypto.getRandomValues(bucket);
      for (let index = 0; index < length; index += 1) {
        digits.push(String(bucket[index] % 10));
      }
      return digits.join("");
    }

    for (let index = 0; index < length; index += 1) {
      digits.push(String(Math.floor(Math.random() * 10)));
    }

    return digits.join("");
  }

  async function hashPassword(password) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const source = new TextEncoder().encode(password);
      const digest = await window.crypto.subtle.digest("SHA-256", source);
      return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
    }

    return btoa(unescape(encodeURIComponent(password))).replace(/=/g, "");
  }

  function readData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Failed to read portal data:", error);
      return null;
    }
  }

  function saveData(data) {
    cache = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Failed to read session:", error);
      return null;
    }
  }

  function setSession(account) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ uid: account.uid, role: account.role, name: account.name })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function semesterLabel(semesterNumber) {
    return `Semester ${semesterNumber}`;
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatTime(value) {
    return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  function monthKeyFromDate(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function dayKeyFromDate(value) {
    return String(new Date(value).getDate()).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setNotice(element, message, tone) {
    if (!element) {
      return;
    }

    if (!message) {
      element.textContent = "";
      element.className = "notice notice--hidden";
      return;
    }

    element.textContent = message;
    element.className = `notice notice--${tone || "success"}`;
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPdf(filename, lines) {
    const safeLines = (lines || []).map((line) =>
      String(line || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
    );
    const stream = ["BT", "/F1 12 Tf", "50 760 Td", ...safeLines.flatMap((line, index) => (index === 0 ? [`(${line}) Tj`] : ["0 -18 Td", `(${line}) Tj`])), "ET"].join("\n");
    const objects = [
      null,
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = pdf.length;
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function gradeFromMarks(value) {
    const marks = Number(value);
    if (marks >= 90) return { letter: "A+", points: 4 };
    if (marks >= 80) return { letter: "A", points: 3.7 };
    if (marks >= 70) return { letter: "B+", points: 3.3 };
    if (marks >= 60) return { letter: "B", points: 3 };
    if (marks >= 50) return { letter: "C", points: 2.7 };
    if (marks >= 40) return { letter: "D", points: 2 };
    return { letter: "F", points: 0 };
  }

  function calculateProfileGpa(data, profile) {
    const semesters = Object.entries(profile.marks || {})
      .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
      .map(([semester, marksByCourse]) => {
        const rows = Object.entries(marksByCourse || {}).map(([courseId, marks]) => {
          const course = data.courses.find((item) => item.id === courseId);
          const grade = gradeFromMarks(marks);
          return {
            courseId,
            courseName: course ? course.name : courseId,
            marks,
            creditHours: course ? Number(course.creditHours) : 0,
            letter: grade.letter,
            points: grade.points,
          };
        });

        const totalCredits = rows.reduce((sum, row) => sum + row.creditHours, 0);
        const weightedPoints = rows.reduce((sum, row) => sum + row.creditHours * row.points, 0);
        return {
          semester,
          gpa: totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0,
          totalCredits,
          rows,
        };
      });

    const overallCredits = semesters.reduce((sum, item) => sum + item.totalCredits, 0);
    const overallPoints = semesters.reduce(
      (sum, item) => sum + item.rows.reduce((inner, row) => inner + row.creditHours * row.points, 0),
      0
    );

    return {
      semesters,
      overallCgpa: overallCredits ? Number((overallPoints / overallCredits).toFixed(2)) : 0,
    };
  }

  function calculateAttendanceSummary(data, studentUid, courseId, monthKey) {
    const courseAttendance = data.attendance[courseId] || {};
    const months = monthKey ? [monthKey] : Object.keys(courseAttendance);
    const summary = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

    months.forEach((currentMonth) => {
      const days = courseAttendance[currentMonth] || {};
      Object.values(days).forEach((studentMap) => {
        const status = studentMap[studentUid];
        if (!status) {
          return;
        }
        summary.total += 1;
        if (status === "Present") summary.present += 1;
        else if (status === "Absent") summary.absent += 1;
        else summary.late += 1;
      });
    });

    summary.percentage = summary.total
      ? Number((((summary.present + summary.late) / summary.total) * 100).toFixed(1))
      : 0;

    return summary;
  }

  function getStudents(data) {
    return data.accounts.filter((account) => account.role === "student").sort((a, b) => a.name.localeCompare(b.name));
  }

  function getInstructors(data) {
    return data.accounts.filter((account) => account.role === "instructor").sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCourseById(data, courseId) {
    return data.courses.find((course) => course.id === courseId) || null;
  }

  function getStudentProfile(data, uid) {
    return data.studentProfiles[uid] || null;
  }

  function getInstructorProfile(data, uid) {
    return data.instructorProfiles[uid] || null;
  }

  function getStudentsForCourse(data, courseId) {
    return getStudents(data).filter((student) => {
      const profile = getStudentProfile(data, student.uid);
      return profile && profile.enrolledCourseIds.includes(courseId);
    });
  }

  function ensureGradebooks(data) {
    if (!data.gradebooks || typeof data.gradebooks !== "object") {
      data.gradebooks = {};
    }

    data.courses.forEach((course) => {
      if (!data.gradebooks[course.id]) {
        data.gradebooks[course.id] = {
          courseId: course.id,
          markingComplete: false,
          published: false,
          lastPublishedAt: null,
          entries: [],
        };
      }
    });
  }

  function createMarksTemplate(uid) {
    const offset = ((Number(uid.slice(-2)) || 1) % 5) - 2;
    const seed = {
      "Semester 1": { CSE101: 82, MAT102: 76, ENG103: 88 },
      "Semester 2": { DBS201: 79, WEB202: 84, STA203: 72 },
    };
    const result = {};

    Object.entries(seed).forEach(([semester, courses]) => {
      result[semester] = {};
      Object.entries(courses).forEach(([courseId, marks]) => {
        result[semester][courseId] = clamp(marks + offset * 2, 58, 96);
      });
    });

    return result;
  }

  function addAttendanceRecord(data, courseId, dateValue, studentUid, status) {
    const monthKey = monthKeyFromDate(dateValue);
    const dayKey = dayKeyFromDate(dateValue);

    data.attendance[courseId] = data.attendance[courseId] || {};
    data.attendance[courseId][monthKey] = data.attendance[courseId][monthKey] || {};
    data.attendance[courseId][monthKey][dayKey] = data.attendance[courseId][monthKey][dayKey] || {};
    data.attendance[courseId][monthKey][dayKey][studentUid] = status;
  }

  function seedAttendanceForStudent(data, studentUid) {
    const today = new Date();
    const sessions = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26];
    const studentOffset = Number(studentUid.slice(-1)) || 0;

    data.courses.forEach((course, courseIndex) => {
      sessions.forEach((day, sessionIndex) => {
        const date = new Date(today.getFullYear(), today.getMonth(), day, 9, 0, 0);
        const normalCycle = ["Present", "Present", "Present", "Absent", "Present", "Late"];
        const riskCycle = ["Present", "Absent", "Late", "Present", "Absent", "Present"];
        const cycle = course.id === "WEB202" ? riskCycle : normalCycle;
        const status = cycle[(sessionIndex + courseIndex + studentOffset) % cycle.length];
        addAttendanceRecord(data, course.id, date.toISOString(), studentUid, status);
      });
    });
  }

  function syncGradebooksForStudent(data, account, profile) {
    ensureGradebooks(data);

    data.courses.forEach((course) => {
      const gradebook = data.gradebooks[course.id];
      const semester = semesterLabel(course.semester);
      const marks = profile.marks[semester] ? profile.marks[semester][course.id] : null;
      let entry = gradebook.entries.find((item) => item.studentUid === account.uid);

      if (!entry) {
        entry = {
          studentUid: account.uid,
          studentName: account.name,
          marks: typeof marks === "number" ? marks : null,
          completed: typeof marks === "number",
        };
        gradebook.entries.push(entry);
      } else {
        entry.studentName = account.name;
        if (entry.marks === null && typeof marks === "number") {
          entry.marks = marks;
          entry.completed = true;
        }
      }

      gradebook.markingComplete =
        gradebook.entries.length > 0 &&
        gradebook.entries.every((item) => typeof item.marks === "number" && item.completed);
    });
  }

  function updateTimetableTeacherName(data, courseId, teacherName) {
    data.timetable
      .filter((slot) => slot.courseId === courseId)
      .forEach((slot) => {
        slot.teacherName = teacherName;
      });
  }

  function createStudentProfile(data, account) {
    const dueMap = Object.fromEntries(data.assignments.map((assignment) => [assignment.id, assignment.dueDate]));
    const onTime = new Date(new Date(dueMap.A1).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const late = new Date(new Date(dueMap.A3).getTime() + 14 * 60 * 60 * 1000).toISOString();
    const profile = {
      uid: account.uid,
      currentSemester: 2,
      department: account.department,
      enrolledCourseIds: data.courses.map((course) => course.id),
      marks: createMarksTemplate(account.uid),
      submissions: {
        A1: { assignmentId: "A1", status: "submitted", method: "upload", fileName: `${account.uid}-lab-sheet.zip`, submittedAt: onTime },
        A2: { assignmentId: "A2", status: "pending", method: "offline", fileName: "", submittedAt: null },
        A3: { assignmentId: "A3", status: "submitted", method: "upload", fileName: `${account.uid}-er-diagram.pdf`, submittedAt: late },
        A4: { assignmentId: "A4", status: "pending", method: "upload", fileName: "", submittedAt: null },
      },
      gpaSnapshot: null,
    };

    data.studentProfiles[account.uid] = profile;
    seedAttendanceForStudent(data, account.uid);
    profile.gpaSnapshot = calculateProfileGpa(data, profile);
    syncGradebooksForStudent(data, account, profile);
    return profile;
  }

  function createInstructorProfile(data, account) {
    const profile = { uid: account.uid, department: account.department, assignedCourseIds: [] };
    const unassignedCourses = data.courses.filter((course) => !course.instructorUid);
    const pickedCourses = unassignedCourses.slice(0, 3);

    pickedCourses.forEach((course) => {
      course.instructorUid = account.uid;
      course.teacherName = account.name;
      updateTimetableTeacherName(data, course.id, account.name);
      profile.assignedCourseIds.push(course.id);
    });

    data.instructorProfiles[account.uid] = profile;
    return profile;
  }

  function generateUid(role, data) {
    const existing = new Set(data.accounts.map((account) => account.uid));
    let uid = "";
    do {
      uid = role === "student" ? `126${randomDigitString(7)}` : `32${randomDigitString(4)}`;
    } while (existing.has(uid));
    return uid;
  }

  function createSeedData(adminHash) {
    const now = new Date();
    const buildDate = (daysAhead, hour, minute) => {
      const date = new Date(now);
      date.setDate(date.getDate() + daysAhead);
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    };
    const buildDay = (daysAhead) => {
      const date = new Date(now);
      date.setDate(date.getDate() + daysAhead);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().slice(0, 10);
    };

    return {
      version: 1,
      seededAt: now.toISOString(),
      accounts: [
        {
          uid: "ADM001",
          role: "admin",
          name: "System Administrator",
          email: "admin@campusflow.local",
          department: "Administration",
          passwordHash: adminHash,
          createdAt: now.toISOString(),
        },
      ],
      courses: courseTemplates.map((course) => ({ ...course, teacherName: "Faculty Pending", instructorUid: null })),
      materials: [
        { id: "M1", courseId: "CSE101", title: "Loops, Functions, and Arrays", module: "Module 1", fileName: "programming-fundamentals-module-1.pdf", summary: "Concept notes with solved examples for loops, functions, and arrays." },
        { id: "M2", courseId: "MAT102", title: "Graphs and Logic Toolkit", module: "Module 1", fileName: "discrete-mathematics-graphs-logic.pdf", summary: "Definitions, truth tables, and proof patterns used in the first unit." },
        { id: "M3", courseId: "DBS201", title: "Normalization Cheat Sheet", module: "Module 2", fileName: "database-systems-normalization.pdf", summary: "Quick reference for ER modeling, normalization, and SQL design rules." },
        { id: "M4", courseId: "WEB202", title: "Responsive UI Starter Pack", module: "Module 2", fileName: "web-engineering-responsive-ui.pdf", summary: "Layout planning guide, CSS grid examples, and accessibility reminders." },
      ],
      assignments: [
        { id: "A1", courseId: "CSE101", title: "Lab Sheet 1", dueDate: buildDate(4, 23, 59), mode: "online", description: "Upload code for functions, arrays, and pattern problems." },
        { id: "A2", courseId: "MAT102", title: "Proof Journal", dueDate: buildDate(6, 18, 0), mode: "offline", description: "Submit the handwritten proof journal manually in class." },
        { id: "A3", courseId: "DBS201", title: "ER Diagram Submission", dueDate: buildDate(-2, 17, 0), mode: "online", description: "Design the ER diagram for the library management case study." },
        { id: "A4", courseId: "WEB202", title: "Responsive Interface Build", dueDate: buildDate(8, 20, 0), mode: "online", description: "Build the landing page with responsive sections and accessibility labels." },
      ],
      exams: [
        { id: "E1", courseId: "CSE101", title: "Mid Semester Exam", dateTime: buildDate(14, 9, 0), durationMinutes: 120, roomNumber: "A-204", roomLink: "https://www.google.com/maps/search/?api=1&query=Campus+A-204" },
        { id: "E2", courseId: "MAT102", title: "Mid Semester Exam", dateTime: buildDate(14, 9, 30), durationMinutes: 120, roomNumber: "A-206", roomLink: "https://www.google.com/maps/search/?api=1&query=Campus+A-206" },
        { id: "E3", courseId: "WEB202", title: "Practical Exam", dateTime: buildDate(18, 11, 0), durationMinutes: 90, roomNumber: "Studio 2", roomLink: "https://www.google.com/maps/search/?api=1&query=Campus+Studio+2" },
        { id: "E4", courseId: "DBS201", title: "End Semester", dateTime: buildDate(22, 13, 0), durationMinutes: 120, roomNumber: "B-102", roomLink: "https://www.google.com/maps/search/?api=1&query=Campus+B-102" },
      ],
      timetable: [
        { id: "T1", day: "Monday", time: "09:00 - 10:30", courseId: "CSE101", classroom: "Lab 1", teacherName: "Faculty Pending" },
        { id: "T2", day: "Monday", time: "11:00 - 12:00", courseId: "MAT102", classroom: "Room 204", teacherName: "Faculty Pending" },
        { id: "T3", day: "Tuesday", time: "09:30 - 10:30", courseId: "ENG103", classroom: "Room 105", teacherName: "Faculty Pending" },
        { id: "T4", day: "Wednesday", time: "10:00 - 11:30", courseId: "DBS201", classroom: "Room 311", teacherName: "Faculty Pending" },
        { id: "T5", day: "Thursday", time: "13:00 - 14:30", courseId: "WEB202", classroom: "Studio 2", teacherName: "Faculty Pending" },
        { id: "T6", day: "Friday", time: "10:00 - 11:00", courseId: "STA203", classroom: "Room 118", teacherName: "Faculty Pending" },
      ],
      substituteAssignments: [],
      moduleLocks: {
        WEB202: { locked: true, note: "Next module opens after assignment review is completed." },
      },
      studentProfiles: {},
      instructorProfiles: {},
      attendance: {},
      gradebooks: {},
      systemDates: {
        substituteDefaultDate: buildDay(3),
      },
    };
  }

  function normalizeData(data) {
    data.accounts = Array.isArray(data.accounts) ? data.accounts : [];
    data.courses = Array.isArray(data.courses) ? data.courses : [];
    data.materials = Array.isArray(data.materials) ? data.materials : [];
    data.assignments = Array.isArray(data.assignments) ? data.assignments : [];
    data.exams = Array.isArray(data.exams) ? data.exams : [];
    data.timetable = Array.isArray(data.timetable) ? data.timetable : [];
    data.substituteAssignments = Array.isArray(data.substituteAssignments) ? data.substituteAssignments : [];
    data.moduleLocks = data.moduleLocks && typeof data.moduleLocks === "object" ? data.moduleLocks : {};
    data.studentProfiles = data.studentProfiles && typeof data.studentProfiles === "object" ? data.studentProfiles : {};
    data.instructorProfiles = data.instructorProfiles && typeof data.instructorProfiles === "object" ? data.instructorProfiles : {};
    data.attendance = data.attendance && typeof data.attendance === "object" ? data.attendance : {};
    data.gradebooks = data.gradebooks && typeof data.gradebooks === "object" ? data.gradebooks : {};
    data.systemDates = data.systemDates && typeof data.systemDates === "object" ? data.systemDates : {};

    data.courses.forEach((course) => {
      if (!course.teacherName) {
        course.teacherName = "Faculty Pending";
      }
      if (!course.classroom) {
        course.classroom = "TBD";
      }
    });

    ensureGradebooks(data);
    return data;
  }

  async function ensureData() {
    if (cache) {
      return cache;
    }

    let data = readData();
    if (!data) {
      const adminHash = await hashPassword("Admin@123");
      data = createSeedData(adminHash);
    }

    data = normalizeData(data);
    saveData(data);
    return data;
  }

  async function createManagedAccount(payload) {
    const data = await ensureData();
    const role = payload.role;

    if (!["student", "instructor"].includes(role)) {
      throw new Error("Only student and instructor accounts can be created here.");
    }

    const email = String(payload.email || "").trim().toLowerCase();
    if (data.accounts.some((account) => account.email.toLowerCase() === email)) {
      throw new Error("This email is already in use.");
    }

    const uid = generateUid(role, data);
    const account = {
      uid,
      role,
      name: String(payload.name || "").trim(),
      email,
      department: String(payload.department || "").trim(),
      passwordHash: await hashPassword(String(payload.password || "")),
      createdAt: new Date().toISOString(),
    };

    data.accounts.push(account);

    if (role === "student") {
      createStudentProfile(data, account);
    } else {
      createInstructorProfile(data, account);
    }

    saveData(data);
    return account;
  }

  async function login(uid, password) {
    const data = await ensureData();
    const cleanedUid = String(uid || "").trim();
    const passwordHash = await hashPassword(String(password || ""));
    const account = data.accounts.find((entry) => entry.uid === cleanedUid && entry.passwordHash === passwordHash);

    if (!account) {
      throw new Error("Invalid user ID or password.");
    }

    setSession(account);
    return account;
  }

  function redirectForRole(role) {
    const target = PAGE_BY_ROLE[role] || "index.html";
    if (!window.location.pathname.endsWith(target)) {
      window.location.href = target;
    }
  }

  async function requireRole(role) {
    const data = await ensureData();
    const session = getSession();

    if (!session) {
      window.location.href = "index.html";
      return null;
    }

    const account = data.accounts.find((entry) => entry.uid === session.uid && entry.role === role);

    if (!account) {
      clearSession();
      window.location.href = "index.html";
      return null;
    }

    return { data, account };
  }

  function logout() {
    clearSession();
    window.location.href = "index.html";
  }

  function detectExamConflicts(data) {
    const conflicts = [];
    const sorted = [...data.exams].sort((first, second) => new Date(first.dateTime) - new Date(second.dateTime));

    for (let index = 0; index < sorted.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < sorted.length; otherIndex += 1) {
        const first = sorted[index];
        const second = sorted[otherIndex];
        const firstCourse = getCourseById(data, first.courseId);
        const secondCourse = getCourseById(data, second.courseId);
        const firstStart = new Date(first.dateTime).getTime();
        const firstEnd = firstStart + first.durationMinutes * 60000;
        const secondStart = new Date(second.dateTime).getTime();
        const secondEnd = secondStart + second.durationMinutes * 60000;
        const overlap = firstStart < secondEnd && secondStart < firstEnd;

        if (!overlap) {
          continue;
        }

        const reasons = [];
        if (first.roomNumber === second.roomNumber) {
          reasons.push("same room");
        }
        if (firstCourse && secondCourse && firstCourse.semester === secondCourse.semester) {
          reasons.push(`same semester (${semesterLabel(firstCourse.semester)})`);
        }
        if (
          firstCourse &&
          secondCourse &&
          firstCourse.instructorUid &&
          firstCourse.instructorUid === secondCourse.instructorUid
        ) {
          reasons.push("same instructor");
        }

        if (reasons.length) {
          conflicts.push({ first, second, reasons });
        }
      }
    }

    return conflicts;
  }

  function syncGpaSnapshots(data) {
    getStudents(data).forEach((student) => {
      const profile = getStudentProfile(data, student.uid);
      if (profile) {
        profile.gpaSnapshot = calculateProfileGpa(data, profile);
      }
    });
    saveData(data);
  }

  function initAuthPage() {
    const session = getSession();
    if (session && PAGE_BY_ROLE[session.role]) {
      redirectForRole(session.role);
      return;
    }

    const form = document.getElementById("loginForm");
    const message = document.getElementById("loginMessage");
    const uidInput = document.getElementById("uid");
    const passwordInput = document.getElementById("password");
    const prefillButton = document.getElementById("prefillAdmin");

    if (!form) {
      return;
    }

    prefillButton.addEventListener("click", () => {
      uidInput.value = "ADM001";
      passwordInput.value = "Admin@123";
      uidInput.focus();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setNotice(message, "", "success");

      try {
        const account = await login(uidInput.value, passwordInput.value);
        redirectForRole(account.role);
      } catch (error) {
        setNotice(message, error.message, "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await ensureData();
    if (document.body.dataset.page === "auth") {
      initAuthPage();
    }
  });

  window.CampusPortal = {
    ensureData,
    saveData,
    getSession,
    requireRole,
    logout,
    setNotice,
    escapeHtml,
    formatDate,
    formatDateTime,
    formatTime,
    gradeFromMarks,
    calculateProfileGpa,
    calculateAttendanceSummary,
    createManagedAccount,
    getStudents,
    getInstructors,
    getCourseById,
    getStudentProfile,
    getInstructorProfile,
    getStudentsForCourse,
    detectExamConflicts,
    syncGpaSnapshots,
    downloadFile,
    downloadPdf,
    monthKeyFromDate,
    dayKeyFromDate,
    semesterLabel,
    addAttendanceRecord,
  };
})();
