(() => {
  const storageKey = "nswer-zone-posts";
  const postId = new URLSearchParams(window.location.search).get("id");
  const postElement = document.querySelector("#post-detail");
  const commentsSection = document.querySelector("#comments");
  const commentList = document.querySelector("#comment-list");
  const commentForm = document.querySelector("#comment-form");
  const commentsDisabledNote = document.querySelector("#comments-disabled-note");
  const commentsCount = document.querySelector("#comments-count");
  let currentUser = window.NswerAuth.getCurrentUser();

  function readPosts() {
    const storedPosts = window.NswerStore.read(storageKey, window.NswerInitialPosts);
    return Array.isArray(storedPosts) ? storedPosts : window.NswerInitialPosts;
  }

  function getPost() {
    const post = readPosts().find((entry) => entry.id === postId);
    if (!post) return null;
    return {
      ...post,
      topPinned: Boolean(post.pinned && post.topPinned),
      topic: post.pinned || post.topic === "공지" ? null : post.topic === "사진" ? "자유" : post.topic || "자유",
      comments: Array.isArray(post.comments) ? post.comments : []
    };
  }

  function appendAdminBadge(parent) {
    const badge = document.createElement("span");
    badge.className = "role-badge post-role-badge";
    badge.textContent = "ADMIN";
    parent.append(badge);
  }

  function getSafeUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      return url;
    } catch {
      return null;
    }
  }

  function getVideoDetails(value) {
    const url = getSafeUrl(value);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let provider;
    let videoId;
    if (host === "youtu.be") {
      provider = "youtube";
      videoId = url.pathname.split("/").filter(Boolean)[0];
    } else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      provider = "youtube";
      videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    } else if (host === "vimeo.com" || host === "player.vimeo.com") {
      provider = "vimeo";
      videoId = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
    }
    if (provider === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(videoId || "")) {
      return { type: "video", provider, videoId, url: url.href };
    }
    if (provider === "vimeo" && /^\d{5,12}$/.test(videoId || "")) {
      return { type: "video", provider, videoId, url: url.href };
    }
    return null;
  }

  function getContentBlocks(post) {
    if (Array.isArray(post.contentBlocks)) {
      return post.contentBlocks.flatMap((block) => {
        if (!block || typeof block !== "object") return [];
        if (block.type === "text" && typeof block.text === "string") return [{ type: "text", text: block.text }];
        if (block.type === "image" && typeof block.src === "string" && /^data:image\/jpeg;base64,/i.test(block.src)) {
          return [{ type: "image", src: block.src }];
        }
        if (block.type === "link") {
          const url = getSafeUrl(block.url);
          return url ? [{ type: "link", url: url.href }] : [];
        }
        if (block.type === "video") {
          const video = getVideoDetails(block.url);
          return video ? [video] : [];
        }
        return [];
      });
    }
    const blocks = [];
    if (typeof post.content === "string" && post.content) blocks.push({ type: "text", text: post.content });
    if (Array.isArray(post.images)) {
      post.images.forEach((src) => {
        if (typeof src === "string" && /^data:image\/jpeg;base64,/i.test(src)) blocks.push({ type: "image", src });
      });
    }
    if (Array.isArray(post.links)) {
      post.links.forEach((value) => {
        const video = getVideoDetails(value);
        const url = getSafeUrl(value);
        if (video) blocks.push(video);
        else if (url) blocks.push({ type: "link", url: url.href });
      });
    }
    return blocks;
  }

  function renderContentBlocks(post) {
    const container = document.createElement("div");
    container.className = "post-rich-content";
    getContentBlocks(post).forEach((block, index) => {
      if (block.type === "text") {
        const paragraph = document.createElement("p");
        paragraph.className = "post-detail-text";
        paragraph.textContent = block.text;
        container.append(paragraph);
      } else if (block.type === "image") {
        const image = document.createElement("img");
        image.className = "post-rich-image";
        image.src = block.src;
        image.alt = `${post.title} 첨부 이미지 ${index + 1}`;
        image.loading = "lazy";
        container.append(image);
      } else if (block.type === "video") {
        const frame = document.createElement("div");
        frame.className = "post-video-embed";
        const video = document.createElement("iframe");
        video.src = block.provider === "youtube"
          ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(block.videoId)}`
          : `https://player.vimeo.com/video/${encodeURIComponent(block.videoId)}`;
        video.title = `${post.title} 영상`;
        video.loading = "lazy";
        video.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        video.referrerPolicy = "strict-origin-when-cross-origin";
        video.allowFullscreen = true;
        frame.append(video);
        container.append(frame);
      } else {
        const link = document.createElement("a");
        link.className = "post-detail-link";
        link.href = block.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = block.url;
        container.append(link);
      }
    });
    return container;
  }

  function createComment(comment, post) {
    const item = document.createElement("article");
    item.className = "comment-item";
    const meta = document.createElement("div");
    meta.className = "comment-meta";
    const authorLine = document.createElement("span");
    authorLine.className = "post-author-line";
    const author = document.createElement("strong");
    author.className = "post-author-name";
    author.textContent = comment.author;
    authorLine.append(author);
    if (comment.authorRole === "admin") appendAdminBadge(authorLine);
    const date = document.createElement("span");
    date.textContent = comment.date || "방금 전";
    meta.append(authorLine, date);
    const content = document.createElement("p");
    content.textContent = comment.content;
    item.append(meta, content);

    if (currentUser && (comment.ownerId === currentUser.id || currentUser.role === "admin")) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-entry comment-delete";
      remove.textContent = "삭제";
      remove.setAttribute("aria-label", `댓글 삭제: ${comment.content}`);
      remove.addEventListener("click", () => {
        const user = window.NswerAuth.getCurrentUser();
        const latestPost = getPost();
        if (!user || !latestPost || (comment.ownerId !== user.id && user.role !== "admin")) {
          window.NswerStore.showToast("본인 댓글 또는 관리 권한이 있는 댓글만 삭제할 수 있어요.");
          return;
        }
        if (savePost({
          ...latestPost,
          comments: latestPost.comments.filter((entry) => entry.id !== comment.id)
        })) window.NswerStore.showToast("댓글을 삭제했어요.");
      });
      item.append(remove);
    }
    return item;
  }

  function savePost(updatedPost) {
    const posts = readPosts();
    try {
      window.NswerStore.write(storageKey, posts.map((entry) => entry.id === updatedPost.id ? updatedPost : entry));
      render();
      return true;
    } catch {
      return false;
    }
  }

  function render() {
    const post = getPost();
    postElement.replaceChildren();
    commentList.replaceChildren();
    if (!post) {
      const message = document.createElement("p");
      message.className = "empty-events post-not-found";
      message.textContent = "게시글을 찾을 수 없어요. 커뮤니티 목록에서 다시 확인해 주세요.";
      postElement.append(message);
      commentsSection.hidden = true;
      document.title = "게시글 — NSWER ZONE";
      return;
    }

    commentsSection.hidden = false;
    const commentsDisabled = Boolean(post.commentsDisabled);
    commentForm.hidden = commentsDisabled;
    commentsDisabledNote.hidden = !commentsDisabled;
    document.title = `${post.title} — NSWER ZONE`;
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
    const title = document.createElement("h1");
    title.textContent = post.title;
    const meta = document.createElement("div");
    meta.className = "post-meta post-detail-meta";
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
    postElement.append(tags, title, meta, renderContentBlocks(post));

    const isOwner = currentUser && post.ownerId === currentUser.id;
    const isAdmin = currentUser && currentUser.role === "admin";
    if (isOwner || isAdmin) {
      const actions = document.createElement("div");
      actions.className = "post-detail-actions";
      if (isOwner) {
        const edit = document.createElement("a");
        edit.className = "delete-entry";
        edit.href = `editor.html?post=${encodeURIComponent(post.id)}`;
        edit.textContent = "게시글 수정";
        actions.append(edit);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-entry";
      remove.textContent = "게시글 삭제";
      remove.addEventListener("click", async () => {
        const user = window.NswerAuth.getCurrentUser();
        const latestPosts = readPosts();
        const latestPost = latestPosts.find((entry) => entry.id === post.id);
        if (!user || !latestPost || (latestPost.ownerId !== user.id && user.role !== "admin")) {
          window.NswerStore.showToast("본인 게시글 또는 관리 권한이 있는 게시글만 삭제할 수 있어요.");
          return;
        }
        const warning = user.role === "admin" && latestPost.ownerId !== user.id
          ? "관리자 권한으로 다른 회원의 게시글을 삭제합니다. 삭제 후에는 복구할 수 없습니다. 계속할까요?"
          : "게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.";
        if (!await window.NswerStore.showConfirm(warning, "게시글 삭제")) return;
        try {
          window.NswerStore.write(storageKey, latestPosts.filter((entry) => entry.id !== post.id));
        } catch {
          await window.NswerStore.showNotice("게시글을 삭제하지 못했어요. 브라우저 저장 공간을 확인해 주세요.", "삭제 실패");
          return;
        }
        await window.NswerStore.showNotice("게시글을 삭제했어요.", "삭제 완료");
        window.location.href = "index.html";
      });
      actions.append(remove);
      postElement.append(actions);
    }

    commentsCount.textContent = String(post.comments.length);
    if (!post.comments.length) {
      const empty = document.createElement("p");
      empty.className = "comments-empty";
      empty.textContent = "아직 댓글이 없어요. 첫 댓글을 남겨 보세요.";
      commentList.append(empty);
    } else {
      post.comments.forEach((comment) => commentList.append(createComment(comment, post)));
    }
  }

  commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = window.NswerAuth.getCurrentUser();
    if (!user) {
      window.NswerAuth.openLogin();
      window.NswerStore.showToast("로그인 후 댓글을 남길 수 있어요.");
      return;
    }
    const post = getPost();
    const content = commentForm.elements.content.value.trim();
    if (!post || !content) return;
    if (post.commentsDisabled) {
      window.NswerStore.showToast("이 게시글은 댓글 작성이 비활성화되어 있어요.");
      return;
    }
    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: user.id,
      author: user.nickname,
      authorRole: user.role,
      content,
      date: "방금 전"
    };
    if (savePost({ ...post, comments: [...post.comments, comment] })) {
      commentForm.reset();
      window.NswerStore.showToast("댓글을 등록했어요.");
    }
  });
  window.addEventListener("nswer-auth-change", (event) => {
    currentUser = event.detail.user;
    render();
  });

  render();
})();
