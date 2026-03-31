document.addEventListener("DOMContentLoaded", async () => {
  const context = await window.CampusPortal.requireRole("instructor");
  if (!context) {
    return;
  }

  const { data, account } = context;
  const profile = window.CampusPortal.getInstructorProfile(data, account.uid);
  const $ = (id) => document.getElementById(id);

  const refs = {
    instructorIdentity: $("instructorIdentity"),
    instructorLogout: $("instructorLogout"),
    instructorGreeting: $("instructorGreeting"),
    instructorStats: $("instructorStats"),
    submissionDashboard: $("submissionDashboard"),
    moduleLockList: $("moduleLockList"),
    gradeCourseSelect: $("gradeCourseSelect"),
    gradebookTable: $("gradebookTable"),
    saveGradebookButton: $("saveGradebookButton"),
    publishGradesButton: $("publishGradesButton"),
    gradebookMessage: $("gradebookMessage"),
    attendanceCourseSelect: $("attendanceCourseSelect"),
    attendanceDate: $("attendanceDate"),
    attendanceMarkingTable: $("attendanceMarkingTable"),
    saveAttendanceButton: $("saveAttendanceButton"),
    exportAttendanceButton: $("exportAttendanceButton"),
    attendanceReport: $("attendanceReport"),
    attendanceMessage: $("attendanceMessage"),
  };

  function emptyState(message) {
    return `<div class="empty-state">${window.CampusPortal.escapeHtml(message)}</div>`;
  }

  function getAssignedCourses() {
    const ids = new Set(profile ? profile.assignedCourseIds : []);
    data.courses
      .filter((course) => course.instructorUid === account.uid)
      .forEach((course) => ids.add(course.id));
    return data.courses.filter((course) => ids.has(course.id));
  }

  function getSubmissionRows() {
    return getAssignedCourses().flatMap((course) => {
      const assignments = data.assignments.filter((assignment) => assignment.courseId === course.id);
      const students = window.CampusPortal.getStudentsForCourse(data, course.id);
      return assignments.flatMap((assignment) =>
        students.map((student) => {
          const studentProfile = window.CampusPortal.getStudentProfile(data, student.uid);
          const submission = studentProfile.submissions[assignment.id];
          const submitted = submission && submission.status === "submitted";
          const overdue = !submitted && new Date(assignment.dueDate) < new Date();
          const late = submitted && new Date(submission.submittedAt) > new Date(assignment.dueDate);
          return {
            course,
            assignment,
            student,
            submission,
            submitted,
            overdue,
            late,
          };
        })
      );
    });
  }

  function renderHeader() {
    const rows = getSubmissionRows();
    const submittedCount = rows.filter((row) => row.submitted).length;
    const pendingCount = rows.filter((row) => !row.submitted).length;
    const lateCount = rows.filter((row) => row.late || row.overdue).length;
    const lockedCount = getAssignedCourses().filter((course) => data.moduleLocks[course.id] && data.moduleLocks[course.id].locked).length;

    refs.instructorIdentity.textContent = `${account.name} (${account.uid})`;
    refs.instructorGreeting.textContent = `Hello ${account.name}, your course operations are ready to manage.`;
    refs.instructorStats.innerHTML = `
      <div class="stat-card">
        <span class="muted">Submitted</span>
        <strong>${submittedCount}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Pending</span>
        <strong>${pendingCount}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Late / overdue</span>
        <strong>${lateCount}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Locked modules</span>
        <strong>${lockedCount}</strong>
      </div>
    `;
  }

  function renderSubmissionDashboard() {
    const rows = getSubmissionRows();
    if (!rows.length) {
      refs.submissionDashboard.innerHTML = emptyState("No assignments are attached to your courses yet.");
      return;
    }

    refs.submissionDashboard.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Assignment</th>
            <th>Student</th>
            <th>Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => `
              <tr>
                <td>${window.CampusPortal.escapeHtml(row.course.id)}</td>
                <td>${window.CampusPortal.escapeHtml(row.assignment.title)}</td>
                <td>${window.CampusPortal.escapeHtml(row.student.name)}</td>
                <td>${window.CampusPortal.formatDateTime(row.assignment.dueDate)}</td>
                <td>
                  <span class="badge ${
                    row.late || row.overdue ? "badge--warning" : row.submitted ? "badge--success" : "badge--neutral"
                  }">
                    ${
                      row.late
                        ? "Late submitted"
                        : row.overdue
                        ? "Pending - overdue"
                        : row.submitted
                        ? "Submitted"
                        : "Pending"
                    }
                  </span>
                </td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderModuleLocks() {
    const courses = getAssignedCourses();
    if (!courses.length) {
      refs.moduleLockList.innerHTML = emptyState("No courses are assigned to this instructor.");
      return;
    }

    refs.moduleLockList.innerHTML = courses
      .map((course) => {
        const lock = data.moduleLocks[course.id] || { locked: false, note: "" };
        return `
          <article class="stack-item">
            <div class="stack-item__row">
              <div>
                <strong>${window.CampusPortal.escapeHtml(course.name)}</strong>
                <div class="small-text">${window.CampusPortal.escapeHtml(course.id)}</div>
              </div>
              <span class="badge ${lock.locked ? "badge--warning" : "badge--success"}">${lock.locked ? "Locked" : "Open"}</span>
            </div>
            <label>
              <span>Instructor note</span>
              <input type="text" value="${window.CampusPortal.escapeHtml(lock.note || "")}" data-lock-note="${window.CampusPortal.escapeHtml(course.id)}" />
            </label>
            <div class="inline-actions">
              <button class="btn btn--secondary" type="button" data-toggle-lock="${window.CampusPortal.escapeHtml(course.id)}">${lock.locked ? "Unlock next module" : "Lock next module"}</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function populateCourseSelectors() {
    const options = getAssignedCourses()
      .map(
        (course) =>
          `<option value="${window.CampusPortal.escapeHtml(course.id)}">${window.CampusPortal.escapeHtml(course.id)} - ${window.CampusPortal.escapeHtml(course.name)}</option>`
      )
      .join("");

    refs.gradeCourseSelect.innerHTML = options;
    refs.attendanceCourseSelect.innerHTML = options;
    refs.attendanceDate.value = new Date().toISOString().slice(0, 10);
  }

  function renderGradebook() {
    const courseId = refs.gradeCourseSelect.value;
    if (!courseId) {
      refs.gradebookTable.innerHTML = emptyState("No course is selected for grade publishing.");
      refs.publishGradesButton.disabled = true;
      return;
    }

    const course = window.CampusPortal.getCourseById(data, courseId);
    const students = window.CampusPortal.getStudentsForCourse(data, courseId);
    const gradebook = data.gradebooks[courseId];

    gradebook.entries = students.map((student) => {
      const existing = gradebook.entries.find((entry) => entry.studentUid === student.uid);
      return existing || { studentUid: student.uid, studentName: student.name, marks: null, completed: false };
    });

    const canPublish =
      gradebook.entries.length > 0 &&
      gradebook.entries.every((entry) => typeof entry.marks === "number" && entry.completed);

    refs.publishGradesButton.disabled = !canPublish;
    refs.gradebookTable.innerHTML = `
      <div class="small-text">Grades for ${window.CampusPortal.escapeHtml(course.name)} can only be published after every student has a completed mark entry.</div>
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>UID</th>
            <th>Marks</th>
            <th>Letter Grade</th>
            <th>Marking</th>
          </tr>
        </thead>
        <tbody>
          ${gradebook.entries
            .map((entry) => {
              const grade = typeof entry.marks === "number" ? window.CampusPortal.gradeFromMarks(entry.marks) : null;
              return `
                <tr>
                  <td>${window.CampusPortal.escapeHtml(entry.studentName)}</td>
                  <td>${window.CampusPortal.escapeHtml(entry.studentUid)}</td>
                  <td><input type="number" min="0" max="100" value="${entry.marks ?? ""}" data-grade-mark="${window.CampusPortal.escapeHtml(entry.studentUid)}" /></td>
                  <td>${grade ? window.CampusPortal.escapeHtml(grade.letter) : "-"}</td>
                  <td><span class="badge ${entry.completed ? "badge--success" : "badge--neutral"}">${entry.completed ? "Complete" : "Pending"}</span></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderAttendanceMarking() {
    const courseId = refs.attendanceCourseSelect.value;
    if (!courseId) {
      refs.attendanceMarkingTable.innerHTML = emptyState("No course is selected for attendance.");
      refs.attendanceReport.innerHTML = "";
      return;
    }

    const students = window.CampusPortal.getStudentsForCourse(data, courseId);
    const monthKey = window.CampusPortal.monthKeyFromDate(refs.attendanceDate.value);
    const dayKey = window.CampusPortal.dayKeyFromDate(refs.attendanceDate.value);
    const daySheet = (((data.attendance[courseId] || {})[monthKey] || {})[dayKey]) || {};

    refs.attendanceMarkingTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>UID</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (student) => `
                <tr>
                  <td>${window.CampusPortal.escapeHtml(student.name)}</td>
                  <td>${window.CampusPortal.escapeHtml(student.uid)}</td>
                  <td>
                    <select data-attendance-student="${window.CampusPortal.escapeHtml(student.uid)}">
                      ${["Present", "Absent", "Late"]
                        .map(
                          (status) =>
                            `<option value="${status}" ${daySheet[student.uid] === status || (!daySheet[student.uid] && status === "Present") ? "selected" : ""}>${status}</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    const reportRows = students.map((student) => {
      const summary = window.CampusPortal.calculateAttendanceSummary(data, student.uid, courseId, monthKey);
      return { student, summary };
    });

    refs.attendanceReport.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          ${reportRows
            .map(
              ({ student, summary }) => `
                <tr>
                  <td>${window.CampusPortal.escapeHtml(student.name)}</td>
                  <td>${summary.present}</td>
                  <td>${summary.absent}</td>
                  <td>${summary.late}</td>
                  <td>${summary.percentage.toFixed(1)}%</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function refresh() {
    renderHeader();
    renderSubmissionDashboard();
    renderModuleLocks();
    populateCourseSelectors();
    renderGradebook();
    renderAttendanceMarking();
  }

  refs.moduleLockList.addEventListener("click", (event) => {
    const courseId = event.target.getAttribute("data-toggle-lock");
    if (!courseId) {
      return;
    }

    const noteInput = document.querySelector(`[data-lock-note="${courseId}"]`);
    const lock = data.moduleLocks[courseId] || { locked: false, note: "" };
    data.moduleLocks[courseId] = {
      locked: !lock.locked,
      note: noteInput ? noteInput.value.trim() : lock.note,
    };
    window.CampusPortal.saveData(data);
    renderModuleLocks();
    renderHeader();
  });

  refs.gradeCourseSelect.addEventListener("change", renderGradebook);

  refs.saveGradebookButton.addEventListener("click", () => {
    const courseId = refs.gradeCourseSelect.value;
    const gradebook = data.gradebooks[courseId];

    gradebook.entries.forEach((entry) => {
      const input = document.querySelector(`[data-grade-mark="${entry.studentUid}"]`);
      const value = input && input.value !== "" ? Number(input.value) : null;
      entry.marks = Number.isFinite(value) ? value : null;
      entry.completed = Number.isFinite(value);
    });

    gradebook.markingComplete =
      gradebook.entries.length > 0 &&
      gradebook.entries.every((entry) => typeof entry.marks === "number" && entry.completed);

    window.CampusPortal.saveData(data);
    renderGradebook();
    renderHeader();
    window.CampusPortal.setNotice(
      refs.gradebookMessage,
      gradebook.markingComplete ? "All marks are captured. You can now publish the grades." : "Gradebook saved, but publishing stays locked until every mark is complete.",
      gradebook.markingComplete ? "success" : "warning"
    );
  });

  refs.publishGradesButton.addEventListener("click", () => {
    const courseId = refs.gradeCourseSelect.value;
    const course = window.CampusPortal.getCourseById(data, courseId);
    const gradebook = data.gradebooks[courseId];

    if (!gradebook.markingComplete) {
      window.CampusPortal.setNotice(refs.gradebookMessage, "Finish marking every student before publishing.", "warning");
      return;
    }

    gradebook.published = true;
    gradebook.lastPublishedAt = new Date().toISOString();

    gradebook.entries.forEach((entry) => {
      const studentProfile = window.CampusPortal.getStudentProfile(data, entry.studentUid);
      const semester = window.CampusPortal.semesterLabel(course.semester);
      studentProfile.marks[semester] = studentProfile.marks[semester] || {};
      studentProfile.marks[semester][courseId] = entry.marks;
    });

    window.CampusPortal.saveData(data);
    renderGradebook();
    window.CampusPortal.setNotice(
      refs.gradebookMessage,
      `Grades published for ${course.name} on ${window.CampusPortal.formatDateTime(gradebook.lastPublishedAt)}.`,
      "success"
    );
  });

  refs.attendanceCourseSelect.addEventListener("change", renderAttendanceMarking);
  refs.attendanceDate.addEventListener("change", renderAttendanceMarking);

  refs.saveAttendanceButton.addEventListener("click", () => {
    const courseId = refs.attendanceCourseSelect.value;
    document.querySelectorAll("[data-attendance-student]").forEach((select) => {
      window.CampusPortal.addAttendanceRecord(
        data,
        courseId,
        refs.attendanceDate.value,
        select.getAttribute("data-attendance-student"),
        select.value
      );
    });

    window.CampusPortal.saveData(data);
    renderAttendanceMarking();
    renderHeader();
    window.CampusPortal.setNotice(
      refs.attendanceMessage,
      `Attendance saved for ${window.CampusPortal.formatDate(refs.attendanceDate.value)}.`,
      "success"
    );
  });

  refs.exportAttendanceButton.addEventListener("click", () => {
    const courseId = refs.attendanceCourseSelect.value;
    const course = window.CampusPortal.getCourseById(data, courseId);
    const monthKey = window.CampusPortal.monthKeyFromDate(refs.attendanceDate.value);
    const rows = window.CampusPortal.getStudentsForCourse(data, courseId).map((student) => {
      const summary = window.CampusPortal.calculateAttendanceSummary(data, student.uid, courseId, monthKey);
      return `${student.uid},${student.name},${summary.present},${summary.absent},${summary.late},${summary.percentage.toFixed(1)}%`;
    });

    window.CampusPortal.downloadFile(
      `${courseId}-${monthKey}-attendance-report.csv`,
      ["UID,Student,Present,Absent,Late,Attendance Percentage", ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
    window.CampusPortal.setNotice(
      refs.attendanceMessage,
      `Monthly attendance report exported for ${course.name}.`,
      "success"
    );
  });

  refs.instructorLogout.addEventListener("click", window.CampusPortal.logout);

  refresh();
});
