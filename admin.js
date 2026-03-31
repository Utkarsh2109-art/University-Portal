document.addEventListener("DOMContentLoaded", async () => {
  const context = await window.CampusPortal.requireRole("admin");
  if (!context) {
    return;
  }

  const { data, account } = context;
  const $ = (id) => document.getElementById(id);

  const refs = {
    adminWelcome: $("adminWelcome"),
    logoutButton: $("logoutButton"),
    accountSummary: $("accountSummary"),
    accountForm: $("accountForm"),
    accountResult: $("accountResult"),
    accountsList: $("accountsList"),
    courseCreditsTable: $("courseCreditsTable"),
    saveCreditsButton: $("saveCreditsButton"),
    creditsMessage: $("creditsMessage"),
    examConflicts: $("examConflicts"),
    refreshConflictsButton: $("refreshConflictsButton"),
    substituteForm: $("substituteForm"),
    substituteCourse: $("substituteCourse"),
    substituteDate: $("substituteDate"),
    substituteInstructor: $("substituteInstructor"),
    substituteMessage: $("substituteMessage"),
    substituteList: $("substituteList"),
    gpaAudit: $("gpaAudit"),
    syncGpaButton: $("syncGpaButton"),
    gpaMessage: $("gpaMessage"),
  };

  function emptyState(message) {
    return `<div class="empty-state">${window.CampusPortal.escapeHtml(message)}</div>`;
  }

  function formatNumber(value) {
    return Number(value).toFixed(2);
  }

  function renderAccountSummary() {
    const students = window.CampusPortal.getStudents(data);
    const instructors = window.CampusPortal.getInstructors(data);

    refs.accountSummary.innerHTML = `
      <div class="stat-card">
        <span class="muted">Students</span>
        <strong>${students.length}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Instructors</span>
        <strong>${instructors.length}</strong>
      </div>
      <div class="stat-card">
        <span class="muted">Courses</span>
        <strong>${data.courses.length}</strong>
      </div>
    `;
  }

  function renderAccounts() {
    const accounts = data.accounts.filter((entry) => entry.role !== "admin");
    if (!accounts.length) {
      refs.accountsList.innerHTML = emptyState("No student or instructor accounts yet.");
      return;
    }

    refs.accountsList.innerHTML = accounts
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
      .map(
        (entry) => `
          <article class="stack-item">
            <div class="stack-item__row">
              <div>
                <strong>${window.CampusPortal.escapeHtml(entry.name)}</strong>
                <div class="small-text">${window.CampusPortal.escapeHtml(entry.email)}</div>
              </div>
              <span class="badge badge--neutral">${window.CampusPortal.escapeHtml(entry.role)}</span>
            </div>
            <div class="card-row">
              <span><strong>UID:</strong> ${window.CampusPortal.escapeHtml(entry.uid)}</span>
              <span><strong>Department:</strong> ${window.CampusPortal.escapeHtml(entry.department)}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderCourseCredits() {
    refs.courseCreditsTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Semester</th>
            <th>Assigned Teacher</th>
            <th>Credit Hours</th>
          </tr>
        </thead>
        <tbody>
          ${data.courses
            .map(
              (course) => `
                <tr>
                  <td>
                    <strong>${window.CampusPortal.escapeHtml(course.id)}</strong><br />
                    <span class="small-text">${window.CampusPortal.escapeHtml(course.name)}</span>
                  </td>
                  <td>${window.CampusPortal.escapeHtml(window.CampusPortal.semesterLabel(course.semester))}</td>
                  <td>${window.CampusPortal.escapeHtml(course.teacherName || "Faculty Pending")}</td>
                  <td>
                    <input type="number" min="1" max="6" value="${course.creditHours}" data-credit-course="${window.CampusPortal.escapeHtml(course.id)}" />
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderExamConflicts() {
    const conflicts = window.CampusPortal.detectExamConflicts(data);
    if (!conflicts.length) {
      refs.examConflicts.innerHTML = emptyState("No active exam conflicts detected.");
      return;
    }

    refs.examConflicts.innerHTML = conflicts
      .map(({ first, second, reasons }) => {
        const firstCourse = window.CampusPortal.getCourseById(data, first.courseId);
        const secondCourse = window.CampusPortal.getCourseById(data, second.courseId);
        return `
          <article class="stack-item">
            <div class="stack-item__row">
              <strong>${window.CampusPortal.escapeHtml(firstCourse.name)} vs ${window.CampusPortal.escapeHtml(secondCourse.name)}</strong>
              <span class="badge badge--warning">Conflict</span>
            </div>
            <div class="small-text">${window.CampusPortal.formatDateTime(first.dateTime)} and ${window.CampusPortal.formatDateTime(second.dateTime)}</div>
            <div class="card-row">
              <span>${window.CampusPortal.escapeHtml(reasons.join(", "))}</span>
              <span>${window.CampusPortal.escapeHtml(first.roomNumber)} / ${window.CampusPortal.escapeHtml(second.roomNumber)}</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function populateSubstituteOptions() {
    refs.substituteCourse.innerHTML = data.courses
      .map((course) => `<option value="${window.CampusPortal.escapeHtml(course.id)}">${window.CampusPortal.escapeHtml(course.id)} - ${window.CampusPortal.escapeHtml(course.name)}</option>`)
      .join("");

    const instructors = window.CampusPortal.getInstructors(data);
    refs.substituteInstructor.innerHTML = instructors.length
      ? instructors
          .map(
            (entry) =>
              `<option value="${window.CampusPortal.escapeHtml(entry.uid)}">${window.CampusPortal.escapeHtml(entry.name)} (${window.CampusPortal.escapeHtml(entry.uid)})</option>`
          )
          .join("")
      : `<option value="">Create an instructor account first</option>`;

    refs.substituteDate.value = data.systemDates.substituteDefaultDate || new Date().toISOString().slice(0, 10);
  }

  function renderSubstitutes() {
    if (!data.substituteAssignments.length) {
      refs.substituteList.innerHTML = emptyState("No substitute teacher assignments have been added.");
      return;
    }

    refs.substituteList.innerHTML = data.substituteAssignments
      .sort((first, second) => first.date.localeCompare(second.date))
      .map(
        (entry) => `
          <article class="stack-item">
            <div class="stack-item__row">
              <strong>${window.CampusPortal.escapeHtml(entry.courseId)}</strong>
              <span class="badge badge--success">${window.CampusPortal.escapeHtml(entry.substituteName)}</span>
            </div>
            <div class="small-text">${window.CampusPortal.formatDate(entry.date)}</div>
            <div class="card-row">
              <span>Original: ${window.CampusPortal.escapeHtml(entry.originalTeacher || "Faculty Pending")}</span>
              <span>Substitute UID: ${window.CampusPortal.escapeHtml(entry.substituteUid)}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderGpaAudit() {
    const students = window.CampusPortal.getStudents(data);

    if (!students.length) {
      refs.gpaAudit.innerHTML = emptyState("Create a student account to run GPA validation.");
      return;
    }

    refs.gpaAudit.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Snapshot</th>
            <th>Live CGPA</th>
            <th>Semester GPAs</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map((student) => {
              const profile = window.CampusPortal.getStudentProfile(data, student.uid);
              const live = window.CampusPortal.calculateProfileGpa(data, profile);
              const snapshot = profile.gpaSnapshot || { overallCgpa: 0, semesters: [] };
              const mismatch =
                formatNumber(snapshot.overallCgpa || 0) !== formatNumber(live.overallCgpa) ||
                live.semesters.some((semesterRow, index) => {
                  const snap = snapshot.semesters[index];
                  return !snap || formatNumber(snap.gpa || 0) !== formatNumber(semesterRow.gpa);
                });

              return `
                <tr>
                  <td>
                    <strong>${window.CampusPortal.escapeHtml(student.name)}</strong><br />
                    <span class="small-text">${window.CampusPortal.escapeHtml(student.uid)}</span>
                  </td>
                  <td>${formatNumber(snapshot.overallCgpa || 0)}</td>
                  <td>${formatNumber(live.overallCgpa)}</td>
                  <td>
                    ${live.semesters
                      .map((semesterRow) => `${window.CampusPortal.escapeHtml(semesterRow.semester)}: ${formatNumber(semesterRow.gpa)}`)
                      .join("<br />")}
                  </td>
                  <td>
                    <span class="badge ${mismatch ? "badge--warning" : "badge--success"}">
                      ${mismatch ? "Needs sync" : "Verified"}
                    </span>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function refresh() {
    refs.adminWelcome.textContent = `${account.name} (${account.uid})`;
    renderAccountSummary();
    renderAccounts();
    renderCourseCredits();
    renderExamConflicts();
    populateSubstituteOptions();
    renderSubstitutes();
    renderGpaAudit();
  }

  refs.accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.CampusPortal.setNotice(refs.accountResult, "", "success");

    try {
      const formData = new FormData(refs.accountForm);
      const password = String(formData.get("password") || "").trim();

      if (password.length < 6) {
        throw new Error("Temporary password must be at least 6 characters long.");
      }

      const created = await window.CampusPortal.createManagedAccount({
        role: String(formData.get("role") || "").trim(),
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        department: String(formData.get("department") || "").trim(),
        password,
      });

      window.CampusPortal.setNotice(
        refs.accountResult,
        `${created.role} account created. UID: ${created.uid} | Temporary password: ${password}`,
        "success"
      );
      refs.accountForm.reset();
      refresh();
    } catch (error) {
      window.CampusPortal.setNotice(refs.accountResult, error.message, "error");
    }
  });

  refs.saveCreditsButton.addEventListener("click", () => {
    document.querySelectorAll("[data-credit-course]").forEach((input) => {
      const course = window.CampusPortal.getCourseById(data, input.getAttribute("data-credit-course"));
      if (course) {
        course.creditHours = Math.max(1, Number(input.value) || course.creditHours);
      }
    });

    window.CampusPortal.saveData(data);
    renderGpaAudit();
    window.CampusPortal.setNotice(
      refs.creditsMessage,
      "Credit hours saved. GPA audit now reflects the updated course weights.",
      "success"
    );
  });

  refs.refreshConflictsButton.addEventListener("click", renderExamConflicts);

  refs.substituteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const instructors = window.CampusPortal.getInstructors(data);
    if (!instructors.length) {
      window.CampusPortal.setNotice(refs.substituteMessage, "Create an instructor account first.", "warning");
      return;
    }

    const course = window.CampusPortal.getCourseById(data, refs.substituteCourse.value);
    const instructor = instructors.find((entry) => entry.uid === refs.substituteInstructor.value);

    const existing = data.substituteAssignments.find(
      (entry) => entry.courseId === course.id && entry.date === refs.substituteDate.value
    );

    const payload = {
      courseId: course.id,
      date: refs.substituteDate.value,
      substituteUid: instructor.uid,
      substituteName: instructor.name,
      originalTeacher: course.teacherName,
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      data.substituteAssignments.push(payload);
    }

    window.CampusPortal.saveData(data);
    renderSubstitutes();
    window.CampusPortal.setNotice(
      refs.substituteMessage,
      `Substitute teacher assigned for ${course.id} on ${window.CampusPortal.formatDate(refs.substituteDate.value)}.`,
      "success"
    );
  });

  refs.syncGpaButton.addEventListener("click", () => {
    window.CampusPortal.syncGpaSnapshots(data);
    renderGpaAudit();
    window.CampusPortal.setNotice(refs.gpaMessage, "Stored GPA snapshots are now aligned with the live calculation.", "success");
  });

  refs.logoutButton.addEventListener("click", window.CampusPortal.logout);

  refresh();
});
