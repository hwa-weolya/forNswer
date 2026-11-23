(() => {
  const storageKey = "nswer-zone-posts";
  const postId = new URLSearchParams(window.location.search).get("post");
  const form = document.querySelector("#editor-form");
  const access = document.querySelector("#editor-access");
  const accessMessage = document.querySelector("#editor-access-message");
  const title = document.querySelector("#editor-title");
  const submit = document.querySelector("#editor-submit");
  const noticeSetting = document.querySelector("#notice-setting");
  const topPinSetting = document.querySelector("#top-pin-setting");
  const commentsSetting = document.querySelector("#comments-setting");
  const imageInput = document.querySelector("#post-images");
  const imageButton = document.querySelector("#insert-image");
  const linkButton = document.querySelector("#insert-link");
  const editor = document.querySelector("#post-content-editor");
  const linkDialog = document.querySelector("#link-dialog");
  const linkForm = document.querySelector("#link-form");
  const linkInput = document.querySelector("#link-url");
  const linkError = document.querySelector("#link-error");
  const maxImages = 3;
  const maxImageFileSize = 5 * 1024 * 1024;
  let savedRange = null;
  let currentUser = window.NswerAuth.getCurrentUser();

  function getSafeUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value.trim());
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

  function normalizeBlock(block) {
    if (!block || typeof block !== "object") return null;
    if (block.type === "text" && typeof block.text === "string") return { type: "text", text: block.text };
    if (block.type === "image" && typeof block.src === "string" && /^data:image\/jpeg;base64,/i.test(block.src)) {
      return { type: "image", src: block.src };
    }
    if (block.type === "link") {
      const url = getSafeUrl(block.url);
      return url ? { type: "link", url: url.href } : null;
    }
    if (block.type === "video") return getVideoDetails(block.url);
    return null;
  }

  function addEditorBlockRemoveButton(node, label) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "editor-inline-remove";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", label);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const trailingBreak = node.nextSibling;
      node.remove();
      if (trailingBreak && trailingBreak.nodeName === "BR") trailingBreak.remove();
      editor.focus();
    });
    node.append(remove);
  }

  function createEditorBlockNode(block) {
    const node = document.createElement("span");
    node.contentEditable = "false";
    if (block.type === "image") {
      node.className = "editor-inline-image";
      node.dataset.contentImage = "true";
      const image = document.createElement("img");
      image.src = block.src;
      image.alt = "첨부 이미지";
      node.append(image);
      addEditorBlockRemoveButton(node, "첨부 이미지 삭제");
      return node;
    }
    if (block.type === "video") {
      node.className = "editor-inline-video";
      node.dataset.contentVideo = block.provider;
      node.dataset.videoId = block.videoId;
      node.dataset.url = block.url;
      node.textContent = `▶ 영상 링크: ${block.url}`;
      addEditorBlockRemoveButton(node, "영상 링크 삭제");
      return node;
    }
    node.className = "editor-inline-link";
    node.dataset.contentLink = block.url;
    node.textContent = `↗ ${block.url}`;
    addEditorBlockRemoveButton(node, "링크 삭제");
    return node;
  }

  function rememberEditorSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function getInsertionRange() {
    const range = savedRange && editor.contains(savedRange.commonAncestorContainer)
      ? savedRange.cloneRange()
      : document.createRange();
    if (!savedRange || !editor.contains(savedRange.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    return range;
  }

  function insertEditorBlock(block) {
    const range = getInsertionRange();
    range.deleteContents();
    const node = createEditorBlockNode(block);
    range.insertNode(node);
    const trailingBreak = document.createElement("br");
    node.after(trailingBreak);
    range.setStartAfter(trailingBreak);
    range.collapse(true);
    editor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  function insertPlainText(value) {
    const range = getInsertionRange();
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    const lines = value.replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((line, index) => {
      if (index) fragment.append(document.createElement("br"));
      if (line) fragment.append(document.createTextNode(line));
    });
    const lastNode = fragment.lastChild;
    if (!lastNode) return;
    range.insertNode(fragment);
    range.setStartAfter(lastNode);
    range.collapse(true);
    editor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  }

  function appendTextWithBreaks(container, value) {
    String(value).split("\n").forEach((line, index) => {
      if (index) container.append(document.createElement("br"));
      if (line) container.append(document.createTextNode(line));
    });
  }

  function getExistingBlocks(post) {
    if (Array.isArray(post.contentBlocks)) {
      const blocks = post.contentBlocks.map(normalizeBlock).filter(Boolean);
      if (blocks.length) return blocks;
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

  function renderEditorBlocks(blocks) {
    editor.replaceChildren();
    blocks.forEach((block) => {
      if (block.type === "text") {
        appendTextWithBreaks(editor, block.text);
      } else {
        editor.append(createEditorBlockNode(block), document.createElement("br"));
      }
    });
  }

  function serializeEditorContent() {
    const blocks = [];
    const appendText = (value) => {
      if (!value) return;
      const previous = blocks[blocks.length - 1];
      if (previous && previous.type === "text") previous.text += value;
      else blocks.push({ type: "text", text: value });
    };
    const appendBlock = (block) => {
      const previous = blocks[blocks.length - 1];
      if (previous && previous.type === "text" && previous.text && !previous.text.endsWith("\n")) appendText("\n");
      blocks.push(block);
      appendText("\n");
    };
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node.nodeValue);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.dataset.contentImage === "true") {
        const image = node.querySelector("img");
        if (image && /^data:image\/jpeg;base64,/i.test(image.src)) appendBlock({ type: "image", src: image.src });
        return;
      }
      if (node.dataset.contentVideo) {
        const video = getVideoDetails(node.dataset.url);
        if (video) appendBlock(video);
        return;
      }
      if (node.dataset.contentLink) {
        const url = getSafeUrl(node.dataset.contentLink);
        if (url) appendBlock({ type: "link", url: url.href });
        return;
      }
      if (node.nodeName === "BR") {
        appendText("\n");
        return;
      }
      const children = Array.from(node.childNodes);
      children.forEach((child, index) => {
        visit(child);
        if (index < children.length - 1 && ["DIV", "P"].includes(node.nodeName)) appendText("\n");
      });
    };
    const children = Array.from(editor.childNodes);
    children.forEach((child, index) => {
      visit(child);
      const next = children[index + 1];
      if (next && (["DIV", "P"].includes(child.nodeName) || ["DIV", "P"].includes(next.nodeName))) appendText("\n");
    });
    if (blocks[0] && blocks[0].type === "text") blocks[0].text = blocks[0].text.replace(/^\n+/, "");
    const last = blocks[blocks.length - 1];
    if (last && last.type === "text") last.text = last.text.replace(/\n+$/, "");
    return blocks.filter((block) => block.type !== "text" || block.text.length > 0);
  }

  function getPlainText(blocks) {
    return blocks.map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "image") return "";
      return block.url;
    }).join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function processImageFile(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("JPG, PNG, WebP 형식의 이미지만 첨부할 수 있어요.");
    }
    if (file.size > maxImageFileSize) {
      throw new Error("이미지 파일은 한 장당 5MB 이하로 첨부해 주세요.");
    }
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지를 처리하지 못했어요. 다른 파일을 선택해 주세요.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
        throw new Error("이미지를 처리하지 못했어요. 다른 파일을 선택해 주세요.");
      }
      return dataUrl;
    } finally {
      bitmap.close();
    }
  }

  function showAccess(message) {
    form.hidden = true;
    access.hidden = false;
    accessMessage.textContent = message;
  }

  function updateTopicForNotice() {
    const isAdminNotice = currentUser && currentUser.role === "admin" && form.elements.pinned.checked;
    const topic = form.elements.topic;
    commentsSetting.hidden = !isAdminNotice;
    topPinSetting.hidden = !isAdminNotice;
    form.elements.topPinned.disabled = !isAdminNotice;
    if (!isAdminNotice) form.elements.topPinned.checked = false;
    if (isAdminNotice) {
      if (topic.value) topic.dataset.previousTopic = topic.value;
      topic.value = "";
      topic.disabled = true;
      return;
    }
    topic.disabled = false;
    if (!topic.value) topic.value = topic.dataset.previousTopic || "자유";
    delete topic.dataset.previousTopic;
  }

  function renderEditor() {
    const storedPosts = window.NswerStore.read(storageKey, window.NswerInitialPosts);
    const existingPost = Array.isArray(storedPosts) ? storedPosts.find((post) => post.id === postId) : null;
    if (!currentUser) {
      showAccess("게시글을 작성하거나 수정하려면 로그인이 필요해요.");
      return;
    }
    if (postId && !existingPost) {
      showAccess("게시글을 찾을 수 없어요. 커뮤니티 목록에서 다시 확인해 주세요.");
      return;
    }
    if (existingPost && existingPost.ownerId !== currentUser.id) {
      showAccess("본인이 작성한 게시글만 수정할 수 있어요.");
      return;
    }

    access.hidden = true;
    form.hidden = false;
    const isEditing = Boolean(existingPost);
    const titleAccent = document.createElement("span");
    titleAccent.textContent = isEditing ? "수정하기." : "작성하기.";
    title.replaceChildren(document.createTextNode(isEditing ? "게시글 " : "새 게시글 "), titleAccent);
    submit.textContent = isEditing ? "수정 내용 저장하기" : "게시글 등록하기";
    noticeSetting.hidden = currentUser.role !== "admin";
    if (existingPost) {
      form.elements.board.value = existingPost.board || "전체";
      form.elements.topic.value = existingPost.topic === "사진" ? "자유" : existingPost.topic || "자유";
      form.elements.title.value = existingPost.title;
      form.elements.pinned.checked = Boolean(existingPost.pinned);
      form.elements.topPinned.checked = Boolean(existingPost.pinned && existingPost.topPinned);
      form.elements.commentsEnabled.checked = existingPost.commentsDisabled !== true;
      renderEditorBlocks(getExistingBlocks(existingPost));
    } else {
      form.reset();
      form.elements.board.value = "전체";
      form.elements.topic.value = "자유";
      editor.replaceChildren();
      savedRange = null;
    }
    updateTopicForNotice();
  }

  function addUrlToEditor(value) {
    const url = getSafeUrl(value);
    if (!url) {
      window.NswerStore.showToast("http 또는 https 주소를 입력해 주세요.");
      return;
    }
    insertEditorBlock(getVideoDetails(url.href) || { type: "link", url: url.href });
  }

  document.querySelector("#editor-login").addEventListener("click", () => window.NswerAuth.openLogin());
  form.elements.pinned.addEventListener("change", updateTopicForNotice);
  editor.addEventListener("keyup", rememberEditorSelection);
  editor.addEventListener("mouseup", rememberEditorSelection);
  editor.addEventListener("input", rememberEditorSelection);
  document.addEventListener("selectionchange", rememberEditorSelection);
  imageButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    rememberEditorSelection();
  });
  imageButton.addEventListener("click", () => {
    rememberEditorSelection();
    imageInput.click();
  });
  linkButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    rememberEditorSelection();
  });
  linkButton.addEventListener("click", () => {
    rememberEditorSelection();
    linkError.textContent = "";
    linkForm.reset();
    linkDialog.showModal();
    linkInput.focus();
  });
  linkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = getSafeUrl(linkInput.value);
    if (!url) {
      linkError.textContent = "http 또는 https 주소를 입력해 주세요.";
      linkInput.focus();
      return;
    }
    addUrlToEditor(url.href);
    linkDialog.close();
  });
  document.querySelector("#link-cancel").addEventListener("click", () => linkDialog.close());
  linkDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      linkDialog.close();
    }
  });
  linkDialog.addEventListener("close", () => {
    linkForm.reset();
    linkError.textContent = "";
  });
  imageInput.addEventListener("change", async () => {
    const files = Array.from(imageInput.files || []);
    imageInput.value = "";
    if (!files.length) return;
    const imageCount = editor.querySelectorAll("[data-content-image='true']").length;
    if (imageCount + files.length > maxImages) {
      window.NswerStore.showToast("사진은 한 게시글에 최대 3장까지 첨부할 수 있어요.");
      return;
    }
    imageInput.disabled = true;
    imageButton.disabled = true;
    linkButton.disabled = true;
    submit.disabled = true;
    try {
      for (const file of files) {
        const src = await processImageFile(file);
        insertEditorBlock({ type: "image", src });
      }
    } catch (error) {
      window.NswerStore.showToast(error instanceof Error ? error.message : "이미지를 처리하지 못했어요.");
    } finally {
      imageInput.disabled = false;
      imageButton.disabled = false;
      linkButton.disabled = false;
      submit.disabled = false;
    }
  });
  editor.addEventListener("paste", (event) => {
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    rememberEditorSelection();
    const value = text.trim();
    if (value && getSafeUrl(value)) {
      addUrlToEditor(value);
      return;
    }
    insertPlainText(text);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = window.NswerAuth.getCurrentUser();
    const storedPosts = window.NswerStore.read(storageKey, window.NswerInitialPosts);
    const currentPosts = Array.isArray(storedPosts) ? storedPosts : [];
    const existingPost = currentPosts.find((post) => post.id === postId);
    if (!user) {
      showAccess("로그인이 만료되었어요. 다시 로그인해 주세요.");
      return;
    }
    if (postId && (!existingPost || existingPost.ownerId !== user.id)) {
      showAccess("본인이 작성한 게시글만 수정할 수 있어요.");
      return;
    }

    const data = new FormData(form);
    const postTitle = String(data.get("title")).trim();
    const contentBlocks = serializeEditorContent();
    const content = getPlainText(contentBlocks);
    if (!postTitle || (!content && !contentBlocks.some((block) => ["image", "link", "video"].includes(block.type)))) {
      window.NswerStore.showToast("제목과 내용 또는 첨부 항목을 입력해 주세요.");
      return;
    }
    const isPinned = user.role === "admin" && form.elements.pinned.checked;
    const isTopPinned = isPinned && form.elements.topPinned.checked;
    const commentsDisabled = isPinned && !form.elements.commentsEnabled.checked;
    const topic = isPinned ? null : String(data.get("topic") || "자유");
    const warning = existingPost
      ? "게시글 수정 내용을 저장할까요?"
      : "게시글을 등록할까요? 등록 후 커뮤니티에 공개됩니다.";
    if (!await window.NswerStore.showConfirm(warning, existingPost ? "게시글 수정" : "게시글 등록")) return;

    const images = contentBlocks.filter((block) => block.type === "image").map((block) => block.src);
    const links = contentBlocks.filter((block) => block.type === "link" || block.type === "video").map((block) => block.url);
    if (existingPost) {
      const updatedPost = {
        ...existingPost,
        board: String(data.get("board")),
        topic,
        title: postTitle,
        content,
        contentBlocks,
        images,
        links,
        pinned: isPinned,
        topPinned: isTopPinned,
        commentsDisabled,
        updatedAt: new Date().toISOString(),
        date: "수정됨"
      };
      try {
        window.NswerStore.write(storageKey, currentPosts.map((post) => post.id === postId ? updatedPost : post));
      } catch {
        await window.NswerStore.showNotice("저장 공간이 부족해 게시글을 저장하지 못했어요. 첨부 항목을 줄여 주세요.", "저장 실패");
        return;
      }
    } else {
      const newPost = {
        id: `post-${Date.now()}`,
        board: String(data.get("board")),
        topic,
        title: postTitle,
        content,
        contentBlocks,
        author: user.nickname,
        ownerId: user.id,
        authorRole: user.role,
        date: "방금 전",
        likes: 0,
        pinned: isPinned,
        topPinned: isTopPinned,
        commentsDisabled,
        images,
        links,
        comments: []
      };
      try {
        window.NswerStore.write(storageKey, [newPost, ...currentPosts]);
      } catch {
        await window.NswerStore.showNotice("저장 공간이 부족해 게시글을 저장하지 못했어요. 첨부 항목을 줄여 주세요.", "저장 실패");
        return;
      }
    }
    await window.NswerStore.showNotice(existingPost ? "게시글을 수정했어요." : "게시글을 등록했어요.");
    window.location.href = "index.html";
  });
  window.addEventListener("nswer-auth-change", (event) => {
    currentUser = event.detail.user;
    renderEditor();
  });

  renderEditor();
})();
