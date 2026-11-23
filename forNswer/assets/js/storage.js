(() => {
  const toast = document.querySelector("#toast");
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function initializeTheme() {
    const accountControl = document.querySelector(".site-header .account-control");
    if (!accountControl) return;

    let theme = "dark";
    try {
      theme = localStorage.getItem("nswer-zone-theme") === "light" ? "light" : "dark";
    } catch (error) {
      console.warn("테마 설정을 읽지 못했습니다.", error);
    }

    const button = document.createElement("button");
    button.id = "theme-toggle";
    button.className = "theme-toggle";
    button.type = "button";
    accountControl.prepend(button);

    function applyTheme(nextTheme, persist) {
      theme = nextTheme;
      document.documentElement.dataset.theme = theme;
      const isLight = theme === "light";
      button.textContent = isLight ? "☼" : "☾";
      button.setAttribute("aria-label", isLight ? "다크 모드로 전환" : "라이트 모드로 전환");
      button.setAttribute("aria-pressed", String(isLight));
      button.title = isLight ? "다크 모드로 전환" : "라이트 모드로 전환";
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = isLight ? "#f7f5f8" : "#11111a";
      if (!persist) return;
      try {
        localStorage.setItem("nswer-zone-theme", theme);
      } catch (error) {
        console.warn("테마 설정을 저장하지 못했습니다.", error);
        showToast("테마 설정을 저장하지 못했어요.");
      }
    }

    button.addEventListener("click", () => {
      applyTheme(theme === "dark" ? "light" : "dark", true);
    });
    applyTheme(theme, false);
  }

  function getActionDialog() {
    let dialog = document.querySelector("#action-dialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "action-dialog";
    dialog.className = "action-dialog";
    dialog.setAttribute("aria-labelledby", "action-dialog-title");
    dialog.setAttribute("aria-describedby", "action-dialog-message");
    const content = document.createElement("div");
    content.className = "action-dialog-content";
    const heading = document.createElement("h2");
    heading.id = "action-dialog-title";
    const message = document.createElement("p");
    message.id = "action-dialog-message";
    const actions = document.createElement("div");
    actions.className = "action-dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "admin-toggle";
    cancel.textContent = "취소";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "button button-primary form-submit";
    confirm.textContent = "확인";
    actions.append(cancel, confirm);
    content.append(heading, message, actions);
    dialog.append(content);
    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close("cancel");
      }
    });
    cancel.addEventListener("click", () => dialog.close("cancel"));
    confirm.addEventListener("click", () => dialog.close("confirm"));
    return dialog;
  }

  function showActionDialog(message, { title, confirmLabel, cancelLabel } = {}) {
    const dialog = getActionDialog();
    dialog.querySelector("#action-dialog-title").textContent = title;
    dialog.querySelector("#action-dialog-message").textContent = message;
    const cancel = dialog.querySelector(".admin-toggle");
    const confirm = dialog.querySelector(".form-submit");
    cancel.hidden = cancelLabel === null;
    if (cancelLabel) cancel.textContent = cancelLabel;
    confirm.textContent = confirmLabel;
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
      dialog.showModal();
      confirm.focus();
    });
  }

  // Keep persistence behind one adapter so local storage can later be replaced with an API.
  window.NswerStore = {
    read(key, fallback) {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
      } catch (error) {
        console.warn(`저장된 데이터(${key})를 읽지 못했습니다.`, error);
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`데이터(${key})를 저장하지 못했습니다.`, error);
        showToast("저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.");
        throw error;
      }
    },
    showToast,
    showConfirm(message, title = "게시글 확인", confirmLabel = "계속하기") {
      return showActionDialog(message, {
        title,
        confirmLabel,
        cancelLabel: "취소"
      });
    },
    showNotice(message, title = "완료") {
      return showActionDialog(message, {
        title,
        confirmLabel: "확인",
        cancelLabel: null
      });
    }
  };
  initializeTheme();
})();
