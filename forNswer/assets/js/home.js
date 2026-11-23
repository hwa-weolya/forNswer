(() => {
  const storageKey = "nswer-zone-events";
  const today = new Date();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  let events = window.NswerStore.read(storageKey, []);
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = null;
  let adminMode = false;
  let currentUser = window.NswerAuth.getCurrentUser();

  const calendarGrid = document.querySelector("#calendar-grid");
  if (!calendarGrid) return;

  const eventList = document.querySelector("#event-list");
  const eventCard = document.querySelector(".event-card");
  const scheduleLayout = document.querySelector(".schedule-layout");
  const eventDateTitle = document.querySelector("#event-date-title");
  const eventCount = document.querySelector("#event-count");
  const monthButton = document.querySelector("#calendar-month");
  const monthTitle = document.querySelector("#calendar-month-label");
  const monthPicker = document.querySelector("#month-picker");
  const monthPickerForm = document.querySelector("#month-picker-form");
  const pickerYear = document.querySelector("#picker-year");
  const pickerMonth = document.querySelector("#picker-month");
  const adminButton = document.querySelector("#admin-toggle");
  const adminPanel = document.querySelector("#admin-panel");

  for (let month = 1; month <= 12; month += 1) {
    const option = document.createElement("option");
    option.value = String(month);
    option.textContent = `${month}월`;
    pickerMonth.append(option);
  }

  function getEventsForDate(date) {
    return events.filter((event) => event.date === date).sort((a, b) => a.time.localeCompare(b.time));
  }

  function renderEvents() {
    const hasSelection = Boolean(selectedDate);
    eventCard.hidden = !hasSelection;
    scheduleLayout.classList.toggle("has-selection", hasSelection);
    if (!hasSelection) {
      eventList.replaceChildren();
      return;
    }

    const dayEvents = getEventsForDate(selectedDate);
    const selected = new Date(`${selectedDate}T00:00:00`);
    eventDateTitle.textContent = `${selected.getMonth() + 1}월 ${selected.getDate()}일 일정`;
    eventCount.textContent = `${dayEvents.length} EVENT${dayEvents.length === 1 ? "" : "S"}`;
    eventList.replaceChildren();

    if (!dayEvents.length) {
      const empty = document.createElement("p");
      empty.className = "empty-events";
      empty.textContent = "등록된 일정이 없어요. ✦\n공식 채널에서 새 소식을 확인해 보세요.";
      eventList.append(empty);
      return;
    }

    dayEvents.forEach((event) => {
      const item = document.createElement("article");
      item.className = "event-item";
      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = event.time || "시간 미정";
      const info = document.createElement("div");
      info.className = "event-info";
      const title = document.createElement("strong");
      title.textContent = event.title;
      const meta = document.createElement("div");
      meta.className = "event-meta";
      const tag = document.createElement("span");
      tag.className = `event-tag${event.member !== "NMIXX" ? " member-tag" : ""}`;
      tag.textContent = event.member;
      const type = document.createElement("span");
      type.textContent = event.type;
      meta.append(tag, type);
      info.append(title, meta);
      item.append(time, info);

      if (adminMode) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-entry";
        remove.textContent = "삭제";
        remove.setAttribute("aria-label", `일정 삭제: ${event.title}`);
        remove.addEventListener("click", () => {
          if (!currentUser || currentUser.role !== "admin" || !adminMode) return;
          const remaining = events.filter((entry) => entry.id !== event.id);
          try {
            window.NswerStore.write(storageKey, remaining);
            events = remaining;
            renderCalendar();
            window.NswerStore.showToast("일정을 삭제했어요.");
          } catch {
            return;
          }
        });
        item.append(remove);
      }
      eventList.append(item);
    });
  }

  function updateAdminAccess() {
    const canManage = Boolean(currentUser && currentUser.role === "admin");
    adminButton.hidden = !canManage;
    adminButton.disabled = !canManage;
    adminButton.title = canManage
      ? "일정 관리 도구 미리보기"
      : "관리자 데모 계정으로 로그인하면 사용할 수 있어요.";
    if (!canManage) {
      adminMode = false;
      adminButton.setAttribute("aria-expanded", "false");
      adminPanel.hidden = true;
      renderEvents();
    }
  }

  function renderCalendar() {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    monthTitle.textContent = `${year}년 ${month + 1}월`;
    monthButton.setAttribute("aria-label", `${year}년 ${month + 1}월 선택`);
    calendarGrid.replaceChildren();

    ["일", "월", "화", "수", "목", "금", "토"].forEach((label) => {
      const heading = document.createElement("span");
      heading.className = "calendar-day-name";
      heading.textContent = label;
      calendarGrid.append(heading);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let index = 0; index < cellCount; index += 1) {
      let day;
      let date;
      let otherMonth = false;
      if (index < firstDay) {
        day = previousMonthDays - firstDay + index + 1;
        date = dateKey(new Date(year, month - 1, day));
        otherMonth = true;
      } else if (index >= firstDay + daysInMonth) {
        day = index - firstDay - daysInMonth + 1;
        date = dateKey(new Date(year, month + 1, day));
        otherMonth = true;
      } else {
        day = index - firstDay + 1;
        date = dateKey(new Date(year, month, day));
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = String(day);
      const dayEvents = getEventsForDate(date);
      button.setAttribute("aria-label", `${date}${dayEvents.length ? `, 일정 ${dayEvents.length}개` : ""}`);
      if (otherMonth) button.classList.add("other-month");
      if (date === dateKey(today)) button.classList.add("today");
      if (date === selectedDate) button.classList.add("selected");
      if (dayEvents.length) {
        const dots = document.createElement("span");
        dots.className = "day-dots";
        dayEvents.slice(0, 3).forEach((event) => {
          const dot = document.createElement("i");
          dot.className = `day-dot${event.member !== "NMIXX" ? " member" : ""}`;
          dots.append(dot);
        });
        button.append(dots);
      }
      button.addEventListener("click", () => {
        selectedDate = date;
        visibleMonth = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1);
        renderCalendar();
      });
      calendarGrid.append(button);
    }
    renderEvents();
  }

  document.querySelector("#prev-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    selectedDate = null;
    renderCalendar();
  });
  document.querySelector("#next-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    selectedDate = null;
    renderCalendar();
  });
  monthButton.addEventListener("click", () => {
    pickerYear.value = String(visibleMonth.getFullYear());
    pickerMonth.value = String(visibleMonth.getMonth() + 1);
    monthPicker.showModal();
  });
  document.querySelector("#month-picker-close").addEventListener("click", () => monthPicker.close());
  monthPickerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(pickerYear.value);
    const month = Number(pickerMonth.value);
    if (!monthPickerForm.reportValidity() || !Number.isInteger(year) || !Number.isInteger(month)) return;
    visibleMonth = new Date(year, month - 1, 1);
    selectedDate = null;
    monthPicker.close();
    renderCalendar();
  });
  adminButton.addEventListener("click", (event) => {
    if (!currentUser || currentUser.role !== "admin") return;
    const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
    adminMode = !expanded;
    event.currentTarget.setAttribute("aria-expanded", String(!expanded));
    adminPanel.hidden = expanded;
    renderEvents();
  });
  window.addEventListener("nswer-auth-change", (event) => {
    currentUser = event.detail.user;
    updateAdminAccess();
  });
  document.querySelector("#schedule-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "admin" || !adminMode) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newEvent = {
      id: `event-${Date.now()}`,
      title: String(data.get("title")).trim(),
      date: String(data.get("date")),
      time: String(data.get("time")) || "시간 미정",
      member: String(data.get("member")),
      type: String(data.get("type"))
    };
    if (!newEvent.title || !newEvent.date) return;
    try {
      const updatedEvents = [...events, newEvent];
      window.NswerStore.write(storageKey, updatedEvents);
      events = updatedEvents;
    } catch {
      return;
    }
    selectedDate = newEvent.date;
    visibleMonth = new Date(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)) - 1, 1);
    form.reset();
    renderCalendar();
    window.NswerStore.showToast("일정을 등록했어요!");
  });

  updateAdminAccess();
  renderCalendar();

  const heroCard = document.querySelector(".card-front");
  if (heroCard && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let animationFrame = 0;
    const updateCardRotation = () => {
      animationFrame = 0;
      const progress = Math.min(Math.max(window.scrollY, 0), 360) / 360;
      heroCard.style.setProperty("--scroll-rotate-y", `${progress * 22}deg`);
      heroCard.style.setProperty("--scroll-rotate-x", `${progress * 7}deg`);
    };
    window.addEventListener("scroll", () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateCardRotation);
    }, { passive: true });
    updateCardRotation();
  }
})();
