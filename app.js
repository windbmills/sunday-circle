(() => {
  const cfg = window.SUNDAY_CIRCLE || {};
  const LS_TOPIC = "sc_topic";
  const LS_COVER = "sc_cover";
  const LS_THOUGHTS = "sc_thoughts";
  const OWNER_EMAIL = String(cfg.ownerEmail || "windmills34@gmail.com").toLowerCase();

  const $ = (id) => document.getElementById(id);

  let db = null;
  let auth = null;
  let live = false;
  let topic = null;
  let cover = null;
  let thoughts = [];
  let editors = [];
  let authUser = null;
  let view = "cover";

  function firebaseReady() {
    const f = cfg.firebase || {};
    return Boolean(f.apiKey && f.projectId);
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => (el.style.display = "none"), 2200);
  }

  function formatWhen(ts) {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paragraphs(text) {
    return escapeHtml(text)
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join("");
  }

  function parsePairs(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((s) => s.trim());
        if (parts.length >= 2) return { when: parts[0], what: parts.slice(1).join(" | "), who: parts.slice(1).join(" | ") };
        return { when: "", what: line, who: line };
      });
  }

  function authEmail() {
    return authUser && authUser.email ? String(authUser.email).toLowerCase() : "";
  }

  function isAnonymous() {
    return Boolean(authUser && authUser.isAnonymous);
  }

  function isOwner() {
    return Boolean(authUser && !authUser.isAnonymous && authEmail() === OWNER_EMAIL);
  }

  function isEditor() {
    if (isOwner()) return true;
    if (!authUser || authUser.isAnonymous || !authEmail()) return false;
    if (!authUser.emailVerified) return false;
    return editors.some((e) => e.email === authEmail());
  }

  function canPrepareLesson() {
    return isEditor();
  }

  function roleLabel(role) {
    if (role === "secretary" || role === "owner") return "Secretary";
    if (role === "teacher" || role === "editor") return "Teacher";
    return "Class";
  }

  function currentRole() {
    if (isOwner()) return "secretary";
    if (isEditor()) return "teacher";
    return "student";
  }

  function displayName() {
    if (!authUser || authUser.isAnonymous) return "";
    const match = editors.find((e) => e.email === authEmail());
    return (match && match.name) || authUser.displayName || authEmail();
  }

  function embedInfo(url) {
    if (!url) return null;
    const raw = String(url).trim();
    let m = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (m) return { type: "iframe", src: "https://www.youtube.com/embed/" + m[1] };
    m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { type: "iframe", src: "https://player.vimeo.com/video/" + m[1] };
    return { type: "link", src: raw };
  }

  function pairsToText(list, leftKey, rightKey) {
    return (list || [])
      .map((row) => {
        const left = row[leftKey] || row.when || "";
        const right = row[rightKey] || row.what || row.who || "";
        return left ? `${left} | ${right}` : right;
      })
      .filter(Boolean)
      .join("\n");
  }

  function setModePill() {
    $("modePill").innerHTML = live
      ? "Living board — bulletin, lesson, and thoughts update for everyone who scans the QR."
      : "Demo mode: notes stay on this device only. Add Firebase in config.js so the ward can share.";
  }

  function setView(next) {
    view = next === "lesson" ? "lesson" : "cover";
    $("view-cover").hidden = view !== "cover";
    $("view-lesson").hidden = view !== "lesson";
    $("navCover").classList.toggle("on", view === "cover");
    $("navLesson").classList.toggle("on", view === "lesson");
    const cta = $("primaryCta");
    if (view === "cover") {
      cta.textContent = "Open this week’s lesson";
      cta.dataset.action = "lesson";
    } else {
      cta.textContent = "Share a thought";
      cta.dataset.action = "share";
    }
    if (location.hash !== (view === "lesson" ? "#lesson" : "")) {
      history.replaceState(null, "", view === "lesson" ? "#lesson" : location.pathname + location.search);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCover() {
    const c = cover || cfg.starterCover || {};
    $("coverWeek").textContent = c.weekLabel || "This week";
    $("coverGreeting").textContent = c.greeting || "Welcome";
    $("coverWelcome").textContent = c.welcome || "";
    const happenings = c.happenings || [];
    $("happenings").innerHTML = happenings.length
      ? happenings
          .map(
            (ev) =>
              `<li><span class="when">${escapeHtml(ev.when || "")}</span><span>${escapeHtml(ev.what || ev.who || "")}</span></li>`
          )
          .join("")
      : '<li class="empty-line">Nothing posted yet.</li>';
    const needs = c.needs || [];
    $("needs").innerHTML = needs.length
      ? needs.map((n) => `<li>${escapeHtml(typeof n === "string" ? n : n.what || "")}</li>`).join("")
      : '<li class="empty-line">No needs listed this week.</li>';
    const bdays = c.birthdays || [];
    $("birthdays").innerHTML = bdays.length
      ? bdays
          .map(
            (b) =>
              `<li><span class="when">${escapeHtml(b.when || "")}</span><span>${escapeHtml(b.who || b.what || "")}</span></li>`
          )
          .join("")
      : '<li class="empty-line">No dates posted.</li>';
    $("thanks").innerHTML = paragraphs(c.thanks || "");
    $("thanksBlock").style.display = c.thanks ? "" : "none";

    $("cWeek").value = c.weekLabel || "";
    $("cGreeting").value = c.greeting || "";
    $("cWelcome").value = c.welcome || "";
    $("cHappenings").value = pairsToText(c.happenings, "when", "what");
    $("cNeeds").value = (c.needs || []).map((n) => (typeof n === "string" ? n : n.what || "")).join("\n");
    $("cBirthdays").value = pairsToText(c.birthdays, "when", "who");
    $("cThanks").value = c.thanks || "";
  }

  function renderTopic() {
    const t = topic || cfg.starterTopic || {};
    $("className").textContent = cfg.className || "Sunday Circle";
    $("tagline").textContent = cfg.tagline || "";
    $("weekLabel").textContent = t.weekLabel || "This week";
    $("topicTitle").textContent = t.title || "No lesson posted yet";
    $("scriptureText").textContent = t.scriptureText || "";
    $("scriptureRef").textContent = t.scriptureRef || "";
    $("scriptureBlock").style.display = t.scriptureText || t.scriptureRef ? "" : "none";
    $("topicBody").innerHTML = paragraphs(t.body || "");
    const qs = Array.isArray(t.questions) ? t.questions.filter(Boolean) : [];
    $("questions").innerHTML = qs.map((q) => `<li>${escapeHtml(q)}</li>`).join("");
    $("fWeek").value = t.weekLabel || "";
    $("fTitle").value = t.title || "";
    $("fRef").value = t.scriptureRef || "";
    $("fScripture").value = t.scriptureText || "";
    $("fBody").value = t.body || "";
    $("fVideo").value = t.videoUrl || "";
    $("fVideoLabel").value = t.videoLabel || "";
    $("fQuestions").value = qs.join("\n");
    const video = embedInfo(t.videoUrl);
    const block = $("videoBlock");
    const frame = $("videoFrame");
    const fallback = $("videoFallback");
    $("videoLabel").textContent = t.videoLabel || "This week’s talk";
    if (video && video.type === "iframe") {
      block.hidden = false;
      fallback.hidden = true;
      frame.innerHTML =
        '<iframe src="' +
        escapeHtml(video.src) +
        '" title="Talk video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    } else if (video) {
      block.hidden = false;
      frame.innerHTML = "";
      fallback.hidden = false;
      fallback.innerHTML =
        '<a class="btn primary" style="display:inline-block;text-decoration:none" href="' +
        escapeHtml(video.src) +
        '" target="_blank" rel="noopener">Open the talk</a>';
    } else {
      block.hidden = true;
      frame.innerHTML = "";
    }
    document.title = cfg.className || "Sunday Circle";
    renderSession();
  }

  function renderThoughts() {
    const list = $("thoughts");
    const sorted = [...thoughts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    $("thoughtCount").textContent = sorted.length === 1 ? "1 shared" : `${sorted.length} shared`;
    if (!sorted.length) {
      list.innerHTML =
        '<div class="empty">No thoughts yet. Be the first — even a single sentence helps the discussion on Sunday.</div>';
    } else {
      list.innerHTML = sorted
        .map(
          (th) => `
        <article class="thought">
          <header>
            <span class="who">${escapeHtml(th.author)} <em class="role-tag">${escapeHtml(roleLabel(th.role))}</em></span>
            <time>${escapeHtml(formatWhen(th.createdAt))}</time>
          </header>
          <p>${escapeHtml(th.text)}</p>
        </article>`
        )
        .join("");
    }

    const mod = $("modList");
    if (!sorted.length) {
      mod.innerHTML = '<p class="hint">Nothing to moderate yet.</p>';
    } else {
      mod.innerHTML = [...sorted]
        .reverse()
        .map(
          (th) => `
        <div class="mod-item">
          <strong>${escapeHtml(th.author)}</strong>
          <span style="color:var(--ink-soft);font-size:.8rem"> · ${escapeHtml(formatWhen(th.createdAt))}</span>
          <p>${escapeHtml(th.text)}</p>
          <button class="btn danger" type="button" data-del="${escapeHtml(th.id)}">Remove</button>
        </div>`
        )
        .join("");
    }
  }

  function readLocal(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  async function publishCover() {
    if (!canPrepareLesson()) {
      $("coverStatus").textContent = "Sign in as an approved editor to publish.";
      return;
    }
    const next = {
      weekLabel: $("cWeek").value.trim(),
      greeting: $("cGreeting").value.trim(),
      welcome: $("cWelcome").value.trim(),
      happenings: parsePairs($("cHappenings").value).map((r) => ({ when: r.when, what: r.what })),
      needs: $("cNeeds")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      birthdays: parsePairs($("cBirthdays").value).map((r) => ({ when: r.when, who: r.who })),
      thanks: $("cThanks").value.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (!next.greeting) {
      $("coverStatus").textContent = "Add a cover headline before publishing.";
      return;
    }
    $("publishCover").disabled = true;
    try {
      if (live) await db.collection("meta").doc("cover").set(next);
      else {
        localStorage.setItem(LS_COVER, JSON.stringify(next));
        cover = next;
        renderCover();
      }
      $("coverStatus").textContent = live
        ? "Cover published. Anyone with the link will see this bulletin."
        : "Saved on this device. Connect Firebase so the ward sees it too.";
      toast("Cover published");
    } catch (err) {
      $("coverStatus").textContent = "Could not publish: " + err.message;
    } finally {
      $("publishCover").disabled = false;
    }
  }

  async function publishTopic() {
    if (!canPrepareLesson()) {
      $("topicStatus").textContent = "Sign in as an approved editor to publish.";
      return;
    }
    const next = {
      weekLabel: $("fWeek").value.trim(),
      title: $("fTitle").value.trim(),
      scriptureRef: $("fRef").value.trim(),
      scriptureText: $("fScripture").value.trim(),
      body: $("fBody").value.trim(),
      videoUrl: $("fVideo").value.trim(),
      videoLabel: $("fVideoLabel").value.trim(),
      questions: $("fQuestions")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    if (!next.title) {
      $("topicStatus").textContent = "Add a title before publishing.";
      return;
    }
    $("publishTopic").disabled = true;
    try {
      if (live) await db.collection("meta").doc("topic").set(next);
      else {
        localStorage.setItem(LS_TOPIC, JSON.stringify(next));
        topic = next;
        renderTopic();
      }
      $("topicStatus").textContent = live
        ? "Lesson published."
        : "Saved on this device. Connect Firebase so the class sees it too.";
      toast("Lesson published");
    } catch (err) {
      $("topicStatus").textContent = "Could not publish: " + err.message;
    } finally {
      $("publishTopic").disabled = false;
    }
  }

  function renderSession() {
    const btn = $("openLogin");
    if (authUser && !isAnonymous()) {
      btn.textContent = isEditor() ? "Sign out" : authEmail();
      $("shareHint").textContent = "Posting as " + (displayName() || authEmail()) + " (" + roleLabel(currentRole()) + ").";
      $("author").value = displayName() || authEmail();
    } else {
      btn.textContent = "Editor sign in";
      $("shareHint").textContent = "Quorum members do not need an account. Add your name and a thought anytime this week.";
    }
    $("openTeacher").style.display = "";
    document.querySelectorAll('.admin-tabs button[data-tab="people"]').forEach((el) => {
      el.style.display = isOwner() ? "" : "none";
    });
  }

  function renderPeople() {
    const list = $("peopleList");
    if (!editors.length) {
      list.innerHTML = '<p class="hint">No approved editors yet. Add a teacher email.</p>';
      return;
    }
    list.innerHTML = editors
      .map(
        (u) =>
          `<div class="mod-item"><strong>${escapeHtml(u.name || u.email)}</strong>
          <span style="color:var(--ink-soft);font-size:.8rem"> · ${escapeHtml(u.email)}</span>
          <button class="btn danger" type="button" data-un="${escapeHtml(u.email)}">Remove</button></div>`
      )
      .join("");
  }

  function authError(err) {
    const code = err && err.code;
    if (code === "auth/invalid-email") return "That email does not look valid.";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password")
      return "That email or password does not match.";
    if (code === "auth/email-already-in-use") return "That email already has an account. Sign in instead.";
    if (code === "auth/weak-password") return "Use a password with at least 6 characters.";
    if (code === "auth/too-many-requests") return "Too many tries. Wait a minute and try again.";
    return (err && err.message) || "Could not complete that.";
  }

  async function ensureAnonymous() {
    if (!auth) return;
    if (auth.currentUser) return;
    await auth.signInAnonymously();
  }

  async function signIn() {
    const email = $("loginEmail").value.trim();
    const password = $("loginPass").value;
    if (!email || !password) {
      $("loginStatus").textContent = "Email and password are required.";
      return;
    }
    if (!auth) {
      $("loginStatus").textContent = "Firebase Auth is not connected yet.";
      return;
    }
    $("submitLogin").disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      $("loginPass").value = "";
      $("loginStatus").textContent = "";
      closeOverlay("loginOverlay");
      toast("Signed in");
    } catch (err) {
      $("loginStatus").textContent = authError(err);
    } finally {
      $("submitLogin").disabled = false;
    }
  }

  async function createAccount() {
    const email = $("loginEmail").value.trim();
    const password = $("loginPass").value;
    if (!email || password.length < 6) {
      $("loginStatus").textContent = "Use your email and a password of at least 6 characters.";
      return;
    }
    if (!auth) {
      $("loginStatus").textContent = "Firebase Auth is not connected yet.";
      return;
    }
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (cred.user) await cred.user.sendEmailVerification();
      $("loginStatus").textContent =
        "Account created. Check your email to verify, then sign in. Teachers also need the owner to approve their email.";
      toast("Check your email");
    } catch (err) {
      $("loginStatus").textContent = authError(err);
    }
  }

  async function resetPassword() {
    const email = $("loginEmail").value.trim();
    if (!email) {
      $("loginStatus").textContent = "Enter your email first, then tap Reset password.";
      return;
    }
    if (!auth) {
      $("loginStatus").textContent = "Firebase Auth is not connected yet.";
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      $("loginStatus").textContent = "Password reset email sent.";
    } catch (err) {
      $("loginStatus").textContent = authError(err);
    }
  }

  async function signOut() {
    if (!auth) return;
    await auth.signOut();
    try {
      await auth.signInAnonymously();
    } catch (err) {
      console.warn(err);
    }
    toast("Signed out");
  }

  async function addPerson() {
    if (!isOwner()) {
      $("peopleStatus").textContent = "Only the owner can approve editors.";
      return;
    }
    const name = $("pName").value.trim();
    const email = $("pEmail").value.trim().toLowerCase();
    if (name.length < 2 || !email.includes("@")) {
      $("peopleStatus").textContent = "Display name and a valid email are required.";
      return;
    }
    if (email === OWNER_EMAIL) {
      $("peopleStatus").textContent = "The owner is already an editor.";
      return;
    }
    try {
      await db.collection("editors").doc(email).set({
        email,
        name,
        addedAt: new Date().toISOString(),
      });
      $("pName").value = "";
      $("pEmail").value = "";
      $("peopleStatus").textContent = "Approved. They create their own account with that email, then sign in.";
      toast("Editor approved");
    } catch (err) {
      $("peopleStatus").textContent = err.message;
    }
  }

  async function removePerson(email) {
    if (!email || !isOwner()) return;
    if (!confirm("Remove editor " + email + "?")) return;
    await db.collection("editors").doc(email).delete();
  }

  async function addThought() {
    const author = (displayName() || $("author").value.trim());
    const text = $("thoughtText").value.trim();
    $("shareStatus").textContent = "";
    if (author.length < 2) {
      $("shareStatus").textContent = "Please add your name.";
      return;
    }
    if (text.length < 3) {
      $("shareStatus").textContent = "Write a little more so the class can follow.";
      return;
    }
    const thought = {
      author,
      role: currentRole(),
      username: authEmail(),
      text,
      createdAt: new Date().toISOString(),
    };
    $("submitShare").disabled = true;
    try {
      if (live) {
        await ensureAnonymous();
        await db.collection("thoughts").add(thought);
      } else {
        thought.id = "local-" + Date.now();
        thoughts = [...readLocal(LS_THOUGHTS, []), thought];
        localStorage.setItem(LS_THOUGHTS, JSON.stringify(thoughts));
        renderThoughts();
      }
      localStorage.setItem("sc_author", author);
      $("thoughtText").value = "";
      closeOverlay("shareOverlay");
      toast("Thought shared");
    } catch (err) {
      $("shareStatus").textContent = "Could not post: " + err.message;
    } finally {
      $("submitShare").disabled = false;
    }
  }

  async function removeThought(id) {
    if (!id) return;
    if (!canPrepareLesson()) {
      toast("Only approved editors can remove thoughts.");
      return;
    }
    if (!confirm("Remove this thought from the class board?")) return;
    try {
      if (live) await db.collection("thoughts").doc(id).delete();
      else {
        thoughts = readLocal(LS_THOUGHTS, []).filter((t) => t.id !== id);
        localStorage.setItem(LS_THOUGHTS, JSON.stringify(thoughts));
        renderThoughts();
      }
      toast("Removed");
    } catch (err) {
      toast(err.message);
    }
  }

  function openOverlay(id) {
    $(id).classList.add("open");
  }
  function closeOverlay(id) {
    $(id).classList.remove("open");
  }

  function paintQr() {
    const box = $("qrcode");
    box.innerHTML = "";
    const url = location.href.split("#")[0];
    $("shareLink").value = url;
    $("qrCaption").textContent = cfg.className || "Sunday Circle";
    if (window.QRCode) {
      new QRCode(box, {
        text: url,
        width: 200,
        height: 200,
        colorDark: "#1c1914",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    }
  }

  function openAdminIfAllowed() {
    if (!canPrepareLesson()) return false;
    openOverlay("adminOverlay");
    paintQr();
    renderSession();
    return true;
  }

  function startFirebase() {
    firebase.initializeApp(cfg.firebase);
    db = firebase.firestore();
    auth = firebase.auth();
    live = true;

    let lastEditorUid = null;
    auth.onAuthStateChanged(async (user) => {
      authUser = user;
      renderSession();
      if (user && !user.isAnonymous && canPrepareLesson() && user.uid !== lastEditorUid) {
        lastEditorUid = user.uid;
        openAdminIfAllowed();
      }
      if (!user || user.isAnonymous) lastEditorUid = null;
    });

    ensureAnonymous().catch((err) => console.warn(err));

    db.collection("meta")
      .doc("topic")
      .onSnapshot((snap) => {
        topic = snap.exists ? snap.data() : cfg.starterTopic;
        renderTopic();
      });
    db.collection("meta")
      .doc("cover")
      .onSnapshot((snap) => {
        cover = snap.exists ? snap.data() : cfg.starterCover;
        renderCover();
      });
    db.collection("editors").onSnapshot(
      (snap) => {
        editors = snap.docs.map((d) => ({ id: d.id, ...d.data(), email: String(d.id).toLowerCase() }));
        renderPeople();
        renderSession();
      },
      () => {
        editors = [];
        renderPeople();
        renderSession();
      }
    );
    db.collection("thoughts")
      .orderBy("createdAt")
      .onSnapshot(
        (snap) => {
          thoughts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          renderThoughts();
        },
        () => {
          db.collection("thoughts").onSnapshot((snap) => {
            thoughts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderThoughts();
          });
        }
      );
  }

  function startLocal() {
    topic = readLocal(LS_TOPIC, null) || cfg.starterTopic;
    cover = readLocal(LS_COVER, null) || cfg.starterCover;
    thoughts = readLocal(LS_THOUGHTS, []);
    editors = [];
    renderTopic();
    renderCover();
    renderThoughts();
    renderPeople();
    renderSession();
  }

  function wire() {
    $("className").textContent = cfg.className || "Sunday Circle";
    $("tagline").textContent = cfg.tagline || "";
    $("navCover").addEventListener("click", () => setView("cover"));
    $("navLesson").addEventListener("click", () => setView("lesson"));
    $("primaryCta").addEventListener("click", () => {
      if ($("primaryCta").dataset.action === "share") {
        openOverlay("shareOverlay");
      } else setView("lesson");
    });
    $("openLogin").addEventListener("click", () => {
      if (authUser && !isAnonymous()) signOut();
      else openOverlay("loginOverlay");
    });
    $("cancelLogin").addEventListener("click", () => closeOverlay("loginOverlay"));
    $("submitLogin").addEventListener("click", signIn);
    $("createAccount").addEventListener("click", createAccount);
    $("resetPassword").addEventListener("click", resetPassword);
    $("addPerson").addEventListener("click", addPerson);
    $("peopleList").addEventListener("click", (e) => {
      const un = e.target && e.target.getAttribute("data-un");
      if (un) removePerson(un);
    });
    $("cancelShare").addEventListener("click", () => closeOverlay("shareOverlay"));
    $("submitShare").addEventListener("click", addThought);

    $("openTeacher").addEventListener("click", () => {
      if (!openAdminIfAllowed()) openOverlay("loginOverlay");
    });
    $("closeAdmin").addEventListener("click", () => closeOverlay("adminOverlay"));
    $("closeAdmin2").addEventListener("click", () => closeOverlay("adminOverlay"));
    $("publishCover").addEventListener("click", publishCover);
    $("publishTopic").addEventListener("click", publishTopic);
    $("copyLink").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("shareLink").value);
        toast("Link copied");
      } catch {
        $("shareLink").select();
        toast("Copy the highlighted link");
      }
    });
    $("printQr").addEventListener("click", () => {
      closeOverlay("adminOverlay");
      window.print();
    });

    document.querySelectorAll(".admin-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tabs button").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("on"));
        $("panel-" + btn.dataset.tab).classList.add("on");
        if (btn.dataset.tab === "qr") paintQr();
      });
    });

    $("modList").addEventListener("click", (e) => {
      const id = e.target && e.target.getAttribute("data-del");
      if (id) removeThought(id);
    });

    ["shareOverlay", "adminOverlay", "loginOverlay"].forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target.id === id) closeOverlay(id);
      });
    });

    window.addEventListener("hashchange", () => {
      setView(location.hash === "#lesson" ? "lesson" : "cover");
    });

    const savedAuthor = localStorage.getItem("sc_author");
    if (savedAuthor) $("author").value = savedAuthor;
  }

  wire();
  if (firebaseReady() && window.firebase) {
    try {
      startFirebase();
    } catch (err) {
      console.warn(err);
      startLocal();
    }
  } else {
    startLocal();
  }
  setModePill();
  setView(location.hash === "#lesson" ? "lesson" : "cover");
})();
