(() => {
  const sessionKey = "nswer-zone-session";
  const membersKey = "nswer-zone-members";
  const authModal = document.querySelector("#auth-modal");
  if (!authModal) return;

  const loginForm = document.querySelector("#login-form");
  const signupForm = document.querySelector("#signup-form");
  const loginMessage = document.querySelector("#login-message");
  const signupMessage = document.querySelector("#signup-message");
  const loginTab = document.querySelector("#login-tab");
  const signupTab = document.querySelector("#signup-tab");
  const title = document.querySelector("#auth-title");
  let currentUser = window.NswerStore.read(sessionKey, null);
  let registeredMembers = window.NswerStore.read(membersKey, []);

  function isValidSession(user) {
    return user && typeof user.id === "string" && typeof user.nickname === "string" && (user.role === "member" || user.role === "admin");
  }

  if (!isValidSession(currentUser)) currentUser = null;
  if (!Array.isArray(registeredMembers)) registeredMembers = [];

  function renderSession() {
    const loginButton = document.querySelector("#auth-open");
    const sessionDisplay = document.querySelector("#account-session");
    const nickname = document.querySelector("#account-nickname");
    const roleBadge = document.querySelector("#account-role-badge");
    if (!loginButton || !sessionDisplay) return;
    loginButton.hidden = Boolean(currentUser);
    sessionDisplay.hidden = !currentUser;
    if (currentUser) {
      nickname.textContent = currentUser.nickname;
      roleBadge.hidden = currentUser.role !== "admin";
    }
  }

  function notifySessionChanged() {
    renderSession();
    window.dispatchEvent(new CustomEvent("nswer-auth-change", { detail: { user: currentUser } }));
  }

  function showMessage(element, message, isError) {
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
  }

  function selectAuthTab(tab) {
    const isSignup = tab === "signup";
    loginForm.hidden = isSignup;
    signupForm.hidden = !isSignup;
    loginTab.classList.toggle("active", !isSignup);
    signupTab.classList.toggle("active", isSignup);
    loginTab.setAttribute("aria-selected", String(!isSignup));
    signupTab.setAttribute("aria-selected", String(isSignup));
    title.textContent = isSignup ? "회원가입" : "로그인";
    showMessage(loginMessage, "", false);
    showMessage(signupMessage, "", false);
  }

  function openLogin() {
    selectAuthTab("login");
    if (!authModal.open) authModal.showModal();
  }

  function createSalt() {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("이 브라우저에서는 안전한 데모 비밀번호 처리를 지원하지 않습니다.");
    }
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function saveSession(account) {
    const session = { id: account.id, nickname: account.nickname, role: account.role };
    window.NswerStore.write(sessionKey, session);
    currentUser = session;
    notifySessionChanged();
    authModal.close();
    window.NswerStore.showToast(`${session.nickname}님, 환영해요!`);
  }

  loginTab.addEventListener("click", () => selectAuthTab("login"));
  signupTab.addEventListener("click", () => selectAuthTab("signup"));
  document.querySelector("#auth-open").addEventListener("click", openLogin);
  document.querySelector("#auth-close").addEventListener("click", () => authModal.close());
  document.querySelector("#logout-button").addEventListener("click", async () => {
    const confirmed = await window.NswerStore.showConfirm(
      "로그아웃하시겠어요? 다시 이용하려면 로그인해야 해요.",
      "로그아웃 확인",
      "로그아웃"
    );
    if (!confirmed) return;
    try {
      window.NswerStore.write(sessionKey, null);
      currentUser = null;
      notifySessionChanged();
      window.NswerStore.showToast("로그아웃했어요.");
    } catch {
      return;
    }
  });

  document.querySelectorAll("[data-demo-account]").forEach((button) => {
    button.addEventListener("click", () => {
      const account = window.NswerDemoMembers.find((member) => member.role === button.dataset.demoAccount);
      if (!account) return;
      loginForm.elements.email.value = account.email;
      loginForm.elements.password.value = account.password;
      showMessage(loginMessage, "테스트 계정 정보가 입력됐어요.", false);
    });
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    const account = [...window.NswerDemoMembers, ...registeredMembers]
      .find((member) => member.email.toLowerCase() === email);
    if (!account) {
      showMessage(loginMessage, "등록된 계정을 찾을 수 없어요.", true);
      return;
    }

    const verify = account.passwordHash
      ? hashPassword(password, account.salt).then((hash) => hash === account.passwordHash)
      : Promise.resolve(account.password === password);
    verify.then((valid) => {
      if (!valid) {
        showMessage(loginMessage, "이메일 또는 비밀번호를 확인해 주세요.", true);
        return;
      }
      try {
        saveSession(account);
        loginForm.reset();
      } catch {
        showMessage(loginMessage, "로그인 상태를 저장하지 못했어요.", true);
      }
    }).catch((error) => {
      console.error("로그인 정보를 확인하지 못했습니다.", error);
      showMessage(loginMessage, "로그인 처리 중 오류가 발생했어요.", true);
    });
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const nickname = String(formData.get("nickname")).trim();
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    const accounts = [...window.NswerDemoMembers, ...registeredMembers];
    if (accounts.some((member) => member.email.toLowerCase() === email)) {
      showMessage(signupMessage, "이미 가입된 이메일이에요.", true);
      return;
    }
    if (accounts.some((member) => member.nickname.toLowerCase() === nickname.toLowerCase())) {
      showMessage(signupMessage, "이미 사용 중인 닉네임이에요.", true);
      return;
    }

    try {
      const salt = createSalt();
      const passwordHash = await hashPassword(password, salt);
      const account = {
        id: `member-${Date.now()}`,
        nickname,
        email,
        salt,
        passwordHash,
        role: "member"
      };
      const updatedMembers = [...registeredMembers, account];
      window.NswerStore.write(membersKey, updatedMembers);
      registeredMembers = updatedMembers;
      signupForm.reset();
      saveSession(account);
    } catch (error) {
      console.error("회원가입을 완료하지 못했습니다.", error);
      showMessage(signupMessage, error.message || "회원가입 정보를 저장하지 못했어요.", true);
    }
  });

  window.NswerAuth = {
    getCurrentUser: () => currentUser,
    openLogin
  };
  notifySessionChanged();
})();
