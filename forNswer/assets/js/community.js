(() => {
  const storageKey = "nswer-zone-posts";
  const storedPosts = window.NswerStore.read(storageKey, window.NswerInitialPosts);
  let posts = (Array.isArray(storedPosts) ? storedPosts : window.NswerInitialPosts).map((post) => {
    const migratedPost = {
      ...post,
      topPinned: Boolean(post.pinned && post.topPinned),
      topic: post.pinned || post.topic === "공지" ? null : post.topic === "사진" ? "자유" : post.topic || "자유",
      comments: Array.isArray(post.comments) ? post.comments : []
    };
    if (migratedPost.ownerId) return migratedPost;
    if (migratedPost.author === "운영팀") return { ...migratedPost, ownerId: "admin-demo", authorRole: "admin" };
    if (migratedPost.author === "NSWER") return { ...migratedPost, ownerId: "member-demo", author: "mixxstar", authorRole: "member" };
    return { ...migratedPost, ownerId: null, authorRole: migratedPost.authorRole || "member" };
  });
  let currentUser = window.NswerAuth.getCurrentUser();
  let selectedBoard = "전체";
  let selectedTopic = "all";
  let pendingEditorPath = null;
  const postList = document.querySelector("#post-list");

  function persistPosts(updatedPosts) {
    try {
      window.NswerStore.write(storageKey, updatedPosts);
      posts = updatedPosts;
      return true;
    } catch {
      return false;
    }
  }

  function requestLogin(destination) {
    pendingEditorPath = destination || null;
    window.NswerAuth.openLogin();
    window.NswerStore.showToast("로그인 후 이용할 수 있어요.");
  }

  function appendAdminBadge(parent) {
    const badge = document.createElement("span");
    badge.className = "role-badge post-role-badge";
    badge.textContent = "ADMIN";
    parent.append(badge);
  }

  function renderPosts() {
    postList.replaceChildren();
    const filtered = posts
      .filter((post) => selectedBoard === "전체" || (selectedBoard === "공지" ? post.pinned : post.board === selectedBoard))
      .filter((post) => selectedTopic === "all" || (selectedTopic === "공지" ? post.pinned : post.topic === selectedTopic))
      .map((post, index) => ({ post, index }))
      .sort((a, b) =>
        Number(Boolean(b.post.topPinned)) - Number(Boolean(a.post.topPinned))
        || Number(Boolean(b.post.pinned)) - Number(Boolean(a.post.pinned))
        || a.index - b.index)
      .map(({ post }) => post);

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "empty-events";
      empty.textContent = "이 주제의 게시글이 아직 없어요. 첫 이야기를 남겨 주세요! ✦";
      postList.append(empty);
      return;
    }

    filtered.forEach((post, index) => {
      const article = document.createElement("article");
      article.className = `post-item${post.pinned ? " is-pinned" : ""}${post.topPinned ? " is-top-pinned" : ""}`;
      const avatar = document.createElement("div");
      avatar.className = `post-avatar${index % 3 === 1 ? " avatar-two" : index % 3 === 2 ? " avatar-three" : ""}`;
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = post.author.slice(0, 1);
      const content = document.createElement("div");
      content.className = "post-content";
      const tags = document.createElement("div");
      tags.className = "post-tags";
      if (post.pinned) {
        const notice = document.createElement("span");
        notice.className = "post-notice-tag";
        notice.textContent = "📌 공지";
        tags.append(notice);
      }
      if (post.topPinned) {
        const topPin = document.createElement("span");
        topPin.className = "post-pin-tag";
        topPin.textContent = "상단 고정";
        tags.append(topPin);
      }
      if (post.topic) {
        const topic = document.createElement("span");
        topic.className = "post-topic-tag";
        topic.textContent = post.topic;
        tags.append(topic);
      }
      const board = document.createElement("span");
      board.className = "post-board";
      board.textContent = post.board === "전체" ? "NSWER 라운지" : `${post.board} 게시판`;
      tags.append(board);
      const title = document.createElement("h3");
      title.textContent = post.title;
      const description = document.createElement("p");
      description.textContent = post.content;
      const detailsLink = document.createElement("a");
      detailsLink.className = "post-open-link";
      detailsLink.href = `post.html?id=${encodeURIComponent(post.id)}`;
      detailsLink.setAttribute("aria-label", `게시글 상세 보기: ${post.title}`);
      detailsLink.append(title, description);
      const images = Array.isArray(post.images)
        ? post.images.filter((image) => typeof image === "string" && /^data:image\/jpeg;base64,/i.test(image)).slice(0, 3)
        : [];
      if (images.length) {
        const imagePreview = document.createElement("span");
        imagePreview.className = "post-image-preview";
        const image = document.createElement("img");
        image.src = images[0];
        image.alt = "";
        imagePreview.append(image);
        if (images.length > 1) {
          const imageCount = document.createElement("span");
          imageCount.className = "post-image-count";
          imageCount.textContent = `+${images.length - 1}`;
          imagePreview.append(imageCount);
        }
        detailsLink.append(imagePreview);
      }
      const links = Array.isArray(post.links)
        ? post.links.filter((link) => typeof link === "string" && /^https?:\/\//i.test(link))
        : [];
      if (links.length) {
        const linkPreview = document.createElement("span");
        linkPreview.className = "post-links-preview";
        linkPreview.textContent = `↗ 링크 ${links.length}`;
        detailsLink.append(linkPreview);
      }
      const meta = document.createElement("div");
      meta.className = "post-meta";
      const authorLine = document.createElement("span");
      authorLine.className = "post-author-line";
      const author = document.createElement("span");
      author.className = "post-author-name";
      author.textContent = post.author;
      authorLine.append(author);
      if (post.authorRole === "admin") appendAdminBadge(authorLine);
      const date = document.createElement("span");
      date.textContent = post.date;
      meta.append(authorLine, date);
      const commentsToggle = document.createElement("a");
      commentsToggle.className = "comments-toggle";
      commentsToggle.href = `post.html?id=${encodeURIComponent(post.id)}#comments`;
      commentsToggle.textContent = post.commentsDisabled
        ? "댓글 사용 안 함 · 자세히 보기"
        : `댓글 ${post.comments.length} · 자세히 보기`;
      content.append(tags, detailsLink, meta, commentsToggle);
      const side = document.createElement("div");
      side.className = "post-side";
      const likes = document.createElement("span");
      likes.className = "post-heart";
      const heart = document.createElement("span");
      heart.setAttribute("aria-hidden", "true");
      heart.textContent = "♡";
      likes.append(heart, document.createTextNode(` ${Number(post.likes) || 0}`));
      side.append(likes);

      const isOwner = currentUser && post.ownerId === currentUser.id;
      const isAdmin = currentUser && currentUser.role === "admin";
      if (isOwner || isAdmin) {
        const actions = document.createElement("div");
        actions.className = "post-actions";
        if (isOwner) {
          const edit = document.createElement("a");
          edit.className = "delete-entry";
          edit.href = `editor.html?post=${encodeURIComponent(post.id)}`;
          edit.textContent = "수정";
          edit.setAttribute("aria-label", `게시글 수정: ${post.title}`);
          actions.append(edit);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-entry";
        remove.textContent = "삭제";
        remove.setAttribute("aria-label", `게시글 삭제: ${post.title}`);
        remove.addEventListener("click", async () => {
          const user = window.NswerAuth.getCurrentUser();
          if (!user || (post.ownerId !== user.id && user.role !== "admin")) {
            window.NswerStore.showToast("본인 게시글 또는 관리 권한이 있는 게시글만 삭제할 수 있어요.");
            return;
          }
          const warning = user.role === "admin" && post.ownerId !== user.id
            ? "관리자 권한으로 다른 회원의 게시글을 삭제합니다. 삭제 후에는 복구할 수 없습니다. 계속할까요?"
            : "게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.";
          if (!await window.NswerStore.showConfirm(warning, "게시글 삭제")) return;
          if (persistPosts(posts.filter((entry) => entry.id !== post.id))) {
            renderPosts();
            await window.NswerStore.showNotice("게시글을 삭제했어요.", "삭제 완료");
          } else {
            await window.NswerStore.showNotice("게시글을 삭제하지 못했어요. 브라우저 저장 공간을 확인해 주세요.", "삭제 실패");
          }
        });
        actions.append(remove);
        side.append(actions);
      }

      article.append(avatar, content, side);
      postList.append(article);
    });
  }

  document.querySelectorAll(".community-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      selectedBoard = tab.dataset.board;
      selectedTopic = "all";
      document.querySelectorAll(".community-tab").forEach((entry) => {
        const active = entry === tab;
        entry.classList.toggle("active", active);
        entry.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".topic-filter").forEach((entry) => {
        const active = entry.dataset.topic === selectedTopic;
        entry.classList.toggle("active", active);
        entry.setAttribute("aria-pressed", String(active));
      });
      renderPosts();
    });
  });
  document.querySelectorAll(".topic-filter").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTopic = button.dataset.topic;
      if (selectedBoard === "공지" && selectedTopic !== "공지") {
        selectedBoard = "전체";
        document.querySelectorAll(".community-tab").forEach((entry) => {
          const active = entry.dataset.board === selectedBoard;
          entry.classList.toggle("active", active);
          entry.setAttribute("aria-selected", String(active));
        });
      }
      document.querySelectorAll(".topic-filter").forEach((entry) => {
        const active = entry === button;
        entry.classList.toggle("active", active);
        entry.setAttribute("aria-pressed", String(active));
      });
      renderPosts();
    });
  });
  document.querySelector("#write-post").addEventListener("click", () => {
    const destination = "editor.html";
    if (!currentUser) {
      requestLogin(destination);
      return;
    }
    window.location.href = destination;
  });
  window.addEventListener("nswer-auth-change", (event) => {
    currentUser = event.detail.user;
    renderPosts();
    if (currentUser && pendingEditorPath) {
      const destination = pendingEditorPath;
      pendingEditorPath = null;
      window.location.href = destination;
    }
  });

  renderPosts();
})();
