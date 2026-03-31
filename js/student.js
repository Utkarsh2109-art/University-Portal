document.addEventListener("DOMContentLoaded", async () => {
  const context = await window.CampusPortal.requireRole("student");
  if (!context) {
    return;
  }

  const { data, account } = context;
  const profile = window.CampusPortal.getStudentProfile(data, account.uid);
  const $ = (id) => document.getElementById(id);

  const refs = {
    studentIdentity: $("studentIdentity"),
    studentLogout: $("studentLogout"),
    studentGreeting: $("studentGreeting"),
    studentStats: $("studentStats"),
    attendanceAlerts: $("attendanceAlerts"),
    materialsList: $("materialsList"),
    materialPreview: $("materialPreview"),
    assignmentsList: $("assignmentsList"),
    cgpaCards: $("cgpaCards"),
    marksTables: $("marksTables"),
    examTable: $("examTable"),
    upcomingExams: $("upcomingExams"),
    attendanceTable: $("attendanceTable"),
    timetableTable: $("timetableTable"),
    downloadResultPdf: $("downloadResultPdf"),
  };

  const assignmentNotice = document.createElement("div");
  assignmentNotice.className = "notice notice--hidden";
  refs.assignmentsList.insertAdjacentElement("afterend", assignmentNotice);

  if (!profile) {
    refs.materialsList.innerHTML = `<div class="empty-state">Your account is active, but no student profile data is available yet.</div>`;
    return;
  }

  function emptyState(message) {
    return `<div class="empty-state">${window.CampusPortal.escapeHtml(message)}</div>`;
  }

  function countdownLabel(value) {
    const diff = new Date(value).getTime() - Date.now();
    const absolute = Math.abs(diff);
    const days = Math.floor(absolute / (24 * 60 * 60 * 1000));
    const hours = Math.floor((absolute % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return diff >= 0 ? `${days}d ${hours}h left` : `${days}d ${hours}h overdue`;
  }

  function isLocked(courseId, moduleName) {
    const lock = data.moduleLocks[courseId];
    return Boolean(lock && lock.locked && moduleName !== "Module 1");
  }

  function getStudentCourses() {
    return data.courses.filter((course) => profile.enrolledCourseIds.includes(course.id));
  }

  function getStudentAssignments() {
    return data.assignments
      .filter((assignment) => profile.enrolledCourseIds.includes(assignment.courseId))
      .sort((first, second) => new Date(first.dueDate) - new Date(second.dueDate));
  }

  function getStudentExams() {
    return data.exams
      .filter((exam) => profile.enrolledCourseIds.includes(exam.courseId))
      .sort((first, second) => new Date(first.dateTime) - new Date(second.dateTime));
  }

  function renderHeader() {
    const gpa = window.CampusPortal.calculateProfileGpa(data, profile);
    const attendanceRisks = getStudentCourses().filter((course) => {
      const summary = window.CampusPortal.calculateAttendanceSummary(data, account.uid, course.id);
      return summary.percentage < 75;
    }).length;
    const upcomingExams = getStudentExams().filter((exam) => new Date(exam.dateTime) > new Date()).length;
    const pendingAssignments = getStudentAssignments().filter((assignment) => {
      const submission = profile.submissions[assignment.id];
      return !submission || submission.status !== "submitted";
    }).length;

    refs.studentIdentity.textContent = `${account.name} (${account.uid})`;
    refs.studentGreeting.textContent = `Hello ${account.name}, your semester progress is ready to review.`;
    refs.studentStats.innerHTML = `
      <div class="stat-card">
        <span class="muted">Overall CGPA</span>
        <strong>${gpa.overallCgpa.toFixed(2)}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Upcoming exams</span>
        <strong>${upcomingExams}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Pending assignments</span>
        <strong>${pendingAssignments}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Attendance alerts</span>
        <strong>${attendanceRisks}</strong>
      </div>
    `;
  }

  function renderAttendanceAlerts() {
    const alerts = getStudentCourses()
      .map((course) => {
        const summary = window.CampusPortal.calculateAttendanceSummary(data, account.uid, course.id);
        return { course, summary };
      })
      .filter((item) => item.summary.percentage < 75);

    refs.attendanceAlerts.innerHTML = alerts.length
      ? alerts
          .map(
            ({ course, summary }) => `
              <div class="alert-banner">
                <strong>Attendance alert: ${window.CampusPortal.escapeHtml(course.name)}</strong>
                <p>Your attendance is ${summary.percentage.toFixed(1)}%, which is below 75%.</p>
              </div>
            `
          )
          .join("")
      : "";
  }

  function renderMaterials() {
    const materials = data.materials.filter((material) => profile.enrolledCourseIds.includes(material.courseId));

    if (!materials.length) {
      refs.materialsList.innerHTML = emptyState("No materials are available yet.");
      return;
    }

    refs.materialsList.innerHTML = materials
      .map((material) => {
        const course = window.CampusPortal.getCourseById(data, material.courseId);
        const locked = isLocked(material.courseId, material.module);
        const lockNote = data.moduleLocks[material.courseId];
        return `
          <article class="stack-item">
            <div class="stack-item__row">
              <div>
                <strong>${window.CampusPortal.escapeHtml(material.title)}</strong>
                <div class="small-text">${window.CampusPortal.escapeHtml(course.name)} | ${window.CampusPortal.escapeHtml(material.module)}</div>
              </div>
              <span class="badge ${locked ? "badge--warning" : "badge--success"}">${locked ? "Locked" : "Available"}</span>
            </div>
            <p>${window.CampusPortal.escapeHtml(material.summary)}</p>
            <div class="inline-actions">
              <button class="btn btn--secondary" type="button" data-view-material="${window.CampusPortal.escapeHtml(material.id)}">View</button>
              <button class="btn btn--primary" type="button" data-download-material="${window.CampusPortal.escapeHtml(material.id)}" ${locked ? "disabled" : ""}>Download</button>
            </div>
            ${locked ? `<div class="small-text warning-text">${window.CampusPortal.escapeHtml(lockNote.note)}</div>` : ""}
          </article>
        `;
      })
      .join("");

    refs.materialPreview.innerHTML = `
      <strong>Material Preview</strong>
      <p>Select a file to preview the summary here.</p>
    `;
  }

  function renderAssignments() {
    const assignments = getStudentAssignments();

    if (!assignments.length) {
      refs.assignmentsList.innerHTML = emptyState("No assignments are mapped to your courses.");
      return;
    }

    refs.assignmentsList.innerHTML = assignments
      .map((assignment) => {
        const course = window.CampusPortal.getCourseById(data, assignment.courseId);
        const submission = profile.submissions[assignment.id];
        const submitted = submission && submission.status === "submitted";
        const late = submitted && new Date(submission.submittedAt) > new Date(assignment.dueDate);
        const canRetract = submitted && new Date() < new Date(assignment.dueDate);
        return `
          <article class="stack-item">
            <div class="stack-item__row">
              <div>
                <strong>${window.CampusPortal.escapeHtml(assignment.title)}</strong>
                <div class="small-text">${window.CampusPortal.escapeHtml(course.name)} | ${window.CampusPortal.escapeHtml(assignment.mode)} task</div>
              </div>
              <span class="badge ${submitted ? (late ? "badge--warning" : "badge--success") : "badge--neutral"}">
                ${submitted ? (late ? "Late submitted" : "Submitted") : "Pending"}
              </span>
            </div>
            <p>${window.CampusPortal.escapeHtml(assignment.description)}</p>
            <div class="card-row">
              <span><strong>Due:</strong> ${window.CampusPortal.formatDateTime(assignment.dueDate)}</span>
              <span class="countdown">${countdownLabel(assignment.dueDate)}</span>
            </div>
            ${submitted ? `<div class="small-text">Submitted ${window.CampusPortal.formatDateTime(submission.submittedAt)}${submission.fileName ? ` | ${window.CampusPortal.escapeHtml(submission.fileName)}` : ""}</div>` : ""}
            <div class="inline-actions">
              ${
                assignment.mode === "online"
                  ? `<label class="upload-label"><span>Upload file</span><input type="file" data-upload-assignment="${window.CampusPortal.escapeHtml(assignment.id)}" /></label>`
                  : `<button class="btn btn--secondary" type="button" data-offline-submit="${window.CampusPortal.escapeHtml(assignment.id)}">Mark offline as Submitted</button>`
              }
              ${canRetract ? `<button class="btn btn--secondary" type="button" data-retract-assignment="${window.CampusPortal.escapeHtml(assignment.id)}">Retract before deadline</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderMarks() {
    const gpa = window.CampusPortal.calculateProfileGpa(data, profile);

    refs.cgpaCards.innerHTML = `
      ${gpa.semesters
        .map(
          (semesterRow) => `
            <div class="stat-card">
              <span class="muted">${window.CampusPortal.escapeHtml(semesterRow.semester)} CGPA</span>
              <strong>${semesterRow.gpa.toFixed(2)}</strong>
            </div>
          `
        )
        .join("")}
      <div class="stat-card">
        <span class="muted">Overall CGPA</span>
        <strong>${gpa.overallCgpa.toFixed(2)}</strong>
      </div>
    `;

    refs.marksTables.innerHTML = gpa.semesters
      .map(
        (semesterRow) => `
          <article class="stack-item">
            <div class="stack-item__row">
              <strong>${window.CampusPortal.escapeHtml(semesterRow.semester)}</strong>
              <span class="badge badge--success">Auto calculated</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Marks</th>
                    <th>Letter Grade</th>
                    <th>Grade Points</th>
                    <th>Credit Hours</th>
                  </tr>
                </thead>
                <tbody>
                  ${semesterRow.rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${window.CampusPortal.escapeHtml(row.courseName)}</td>
                          <td>${row.marks}</td>
                          <td>${window.CampusPortal.escapeHtml(row.letter)}</td>
                          <td>${row.points.toFixed(1)}</td>
                          <td>${row.creditHours}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderExams() {
    const exams = getStudentExams();
    const upcoming = exams.filter((exam) => new Date(exam.dateTime) > new Date());

    refs.examTable.innerHTML = exams.length
      ? `
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Exam</th>
              <th>Date & Time</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            ${exams
              .map((exam) => {
                const course = window.CampusPortal.getCourseById(data, exam.courseId);
                return `
                  <tr>
                    <td>${window.CampusPortal.escapeHtml(course.name)}</td>
                    <td>${window.CampusPortal.escapeHtml(exam.title)}</td>
                    <td>${window.CampusPortal.formatDateTime(exam.dateTime)}</td>
                    <td><a href="${window.CampusPortal.escapeHtml(exam.roomLink)}" target="_blank" rel="noreferrer">${window.CampusPortal.escapeHtml(exam.roomNumber)}</a></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `
      : emptyState("No exams are scheduled yet.");

    refs.upcomingExams.innerHTML = upcoming.length
      ? upcoming
          .map((exam) => {
            const course = window.CampusPortal.getCourseById(data, exam.courseId);
            return `
              <article class="stack-item">
                <div class="stack-item__row">
                  <strong>${window.CampusPortal.escapeHtml(course.name)}</strong>
                  <span class="badge badge--neutral">${window.CampusPortal.formatDate(exam.dateTime)}</span>
                </div>
                <div class="card-row">
                  <span>${window.CampusPortal.escapeHtml(exam.title)}</span>
                  <span>${window.CampusPortal.formatTime(exam.dateTime)}</span>
                </div>
              </article>
            `;
          })
          .join("")
      : emptyState("No upcoming exams remain in the schedule.");
  }

  function renderAttendance() {
    const rows = getStudentCourses().map((course) => {
      const summary = window.CampusPortal.calculateAttendanceSummary(data, account.uid, course.id);
      return { course, summary };
    });

    refs.attendanceTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
            <th>Attendance %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ({ course, summary }) => `
                <tr>
                  <td>${window.CampusPortal.escapeHtml(course.name)}</td>
                  <td>${summary.present}</td>
                  <td>${summary.absent}</td>
                  <td>${summary.late}</td>
                  <td>${summary.percentage.toFixed(1)}%</td>
                  <td><span class="badge ${summary.percentage < 75 ? "badge--warning" : "badge--success"}">${summary.percentage < 75 ? "Below 75%" : "Safe"}</span></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderTimetable() {
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const slots = data.timetable
      .filter((slot) => profile.enrolledCourseIds.includes(slot.courseId))
      .sort((first, second) => order.indexOf(first.day) - order.indexOf(second.day));

    refs.timetableTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Classroom</th>
            <th>Teacher</th>
          </tr>
        </thead>
        <tbody>
          ${slots
            .map((slot) => {
              const course = window.CampusPortal.getCourseById(data, slot.courseId);
              return `
                <tr>
                  <td>${window.CampusPortal.escapeHtml(slot.day)}</td>
                  <td>${window.CampusPortal.escapeHtml(slot.time)}</td>
                  <td>${window.CampusPortal.escapeHtml(course.name)}</td>
                  <td>${window.CampusPortal.escapeHtml(slot.classroom)}</td>
                  <td>${window.CampusPortal.escapeHtml(slot.teacherName || "Faculty Pending")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function refresh() {
    renderHeader();
    renderAttendanceAlerts();
    renderMaterials();
    renderAssignments();
    renderMarks();
    renderExams();
    renderAttendance();
    renderTimetable();
  }

  refs.materialsList.addEventListener("click", (event) => {
    const viewId = event.target.getAttribute("data-view-material");
    const downloadId = event.target.getAttribute("data-download-material");
    const material = data.materials.find((entry) => entry.id === (viewId || downloadId));

    if (!material) {
      return;
    }

    const course = window.CampusPortal.getCourseById(data, material.courseId);
    const locked = isLocked(material.courseId, material.module);

    if (viewId) {
      refs.materialPreview.innerHTML = `
        <strong>${window.CampusPortal.escapeHtml(material.title)}</strong>
        <p>${window.CampusPortal.escapeHtml(material.summary)}</p>
        <div class="small-text">${window.CampusPortal.escapeHtml(course.name)} | ${window.CampusPortal.escapeHtml(material.module)}</div>
        ${locked ? `<div class="small-text warning-text">Locked: ${window.CampusPortal.escapeHtml(data.moduleLocks[material.courseId].note)}</div>` : ""}
      `;
      return;
    }

    if (locked) {
      refs.materialPreview.innerHTML = `
        <strong>${window.CampusPortal.escapeHtml(material.title)}</strong>
        <p class="warning-text">This module is locked by your instructor.</p>
      `;
      return;
    }

    window.CampusPortal.downloadPdf(material.fileName, [
      "CampusFlow Course Material",
      `Course: ${course.name}`,
      `Module: ${material.module}`,
      "",
      material.summary,
    ]);
  });

  refs.assignmentsList.addEventListener("change", (event) => {
    const assignmentId = event.target.getAttribute("data-upload-assignment");
    if (!assignmentId || !event.target.files || !event.target.files.length) {
      return;
    }

    const assignment = data.assignments.find((entry) => entry.id === assignmentId);
    const file = event.target.files[0];
    profile.submissions[assignmentId] = {
      assignmentId,
      status: "submitted",
      method: "upload",
      fileName: file.name,
      submittedAt: new Date().toISOString(),
    };
    window.CampusPortal.saveData(data);
    window.CampusPortal.setNotice(
      assignmentNotice,
      `Uploaded ${file.name} for ${assignment.title}.`,
      "success"
    );
    renderAssignments();
    renderHeader();
  });

  refs.assignmentsList.addEventListener("click", (event) => {
    const offlineId = event.target.getAttribute("data-offline-submit");
    const retractId = event.target.getAttribute("data-retract-assignment");

    if (offlineId) {
      const assignment = data.assignments.find((entry) => entry.id === offlineId);
      profile.submissions[offlineId] = {
        assignmentId: offlineId,
        status: "submitted",
        method: "offline",
        fileName: "",
        submittedAt: new Date().toISOString(),
      };
      window.CampusPortal.saveData(data);
      window.CampusPortal.setNotice(assignmentNotice, `${assignment.title} marked as submitted.`, "success");
      renderAssignments();
      renderHeader();
      return;
    }

    if (retractId) {
      const assignment = data.assignments.find((entry) => entry.id === retractId);
      profile.submissions[retractId] = {
        assignmentId: retractId,
        status: "pending",
        method: assignment.mode,
        fileName: "",
        submittedAt: null,
      };
      window.CampusPortal.saveData(data);
      window.CampusPortal.setNotice(assignmentNotice, `${assignment.title} submission retracted before deadline.`, "warning");
      renderAssignments();
      renderHeader();
    }
  });

  refs.downloadResultPdf.addEventListener("click", () => {
    const gpa = window.CampusPortal.calculateProfileGpa(data, profile);
    const lines = [
      "CampusFlow Result Summary",
      `Student: ${account.name}`,
      `UID: ${account.uid}`,
      `Department: ${account.department}`,
      "",
      ...gpa.semesters.flatMap((semesterRow) => [
        `${semesterRow.semester} CGPA: ${semesterRow.gpa.toFixed(2)}`,
        ...semesterRow.rows.map((row) => `${row.courseName}: ${row.marks} (${row.letter})`),
        "",
      ]),
      `Overall CGPA: ${gpa.overallCgpa.toFixed(2)}`,
    ];
    window.CampusPortal.downloadPdf(`${account.uid}-result-sheet.pdf`, lines);
  });

  refs.studentLogout.addEventListener("click", window.CampusPortal.logout);

  refresh();
});
