(() => {
  const cfg = window.SUNDAY_CIRCLE || {};
  const LS_TOPIC = "sc_topic";
  const LS_COVER = "sc_cover";
  const LS_THOUGHTS = "sc_thoughts";
  const LS_USERS = "sc_users";
  const LS_SESSION = "sc_session";
  const LS_UNLOCK = "sc_teacher";

  const $ = (id) => document.getElementById(id);

  let db = null;
  let live = false;
  let topic = null;
  let cover = null;
  let thoughts = [];
  let users = [];
  let session = null;
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

  function roleLabel(role) {
    if (role === "secretary") return "Secretary";
    if (role === "teacher") return "Teacher";
    return "Class";
  }

  function allUsers() {
    const extras = users && users.length ? users : [];
    const starters = cfg.users || [];
    const map = new Map();
    starters.concat(extras).forEach((u) => {
      if (u && u.username) map.set(String(u.username).toLowerCase(), u);
    });
    return Array.from(map.values());
  }

  function currentSession() {
    if (session) return session;
    session = readLocal(LS_SESSION, null);
    return session;
  }

  function isSecretary() {
    const s = currentSession();
    return Boolean(s && s.role === "secretary") || sessionStorage.getItem(LS_UNLOCK) === "1";
  }

  function canPrepareLesson() {
    const s = currentSession();
    return isSecretary() || Boolean(s && s.role === "teacher");
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
    const s = currentSession();
    const btn = $("openLogin");
    if (s) {
      btn.textContent = s.name || s.username;
      $("shareHint").textContent = "Posting as " + (s.name || s.username) + " (" + roleLabel(s.role) + ").";
      $("author").value = s.name || s.username;
    } else {
      btn.textContent = "Teacher sign in";
      $("shareHint").textContent = "Students do not need an account. Add your name and a thought anytime this week.";
    }
    $("openTeacher").style.display = canPrepareLesson() || !s ? "" : "none";
    document.querySelectorAll('.admin-tabs button[data-tab="cover"], .admin-tabs button[data-tab="people"]').forEach((el) => {
      el.style.display = isSecretary() ? "" : "none";
    });
  }

  function renderPeople() {
    const list = $("peopleList");
    const rows = allUsers();
    if (!rows.length) {
      list.innerHTML = '<p class="hint">No people yet.</p>';
      return;
    }
    list.innerHTML = rows
      .map(
        (u) =>
          `<div class="mod-item"><strong>${escapeHtml(u.name || u.username)}</strong>
          <span style="color:var(--ink-soft);font-size:.8rem"> · ${escapeHtml(u.username)} · ${escapeHtml(roleLabel(u.role))}</span>
          <button class="btn danger" type="button" data-un="${escapeHtml(u.username)}">Remove</button></div>`
      )
      .join("");
  }

  function signIn() {
    const username = $("loginUser").value.trim();
    const password = $("loginPass").value;
    const found = allUsers().find(
      (u) => String(u.username).toLowerCase() === username.toLowerCase() && String(u.password) === password
    );
    if (!found) {
      $("loginStatus").textContent = "That username or password does not match.";
      return;
    }
    session = { username: found.username, name: found.name || found.username, role: found.role };
    localStorage.setItem(LS_SESSION, JSON.stringify(session));
    if (found.role === "secretary") sessionStorage.setItem(LS_UNLOCK, "1");
    $("loginPass").value = "";
    $("loginStatus").textContent = "";
    closeOverlay("loginOverlay");
    renderSession();
    toast("Signed in as " + session.name);
    if (found.role === "secretary" || found.role === "teacher") {
      openOverlay("adminOverlay");
      document.querySelectorAll(".admin-tabs button").forEach((b) => b.classList.remove("on"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("on"));
      const tab = found.role === "teacher" ? "topic" : "cover";
      const btn = document.querySelector('.admin-tabs button[data-tab="' + tab + '"]');
      if (btn) btn.classList.add("on");
      const panel = $("panel-" + tab);
      if (panel) panel.classList.add("on");
      paintQr();
    } else setView("lesson");
  }

  function signOut() {
    session = null;
    localStorage.removeItem(LS_SESSION);
    sessionStorage.removeItem(LS_UNLOCK);
    renderSession();
    toast("Signed out");
  }

  async function saveUsers(next) {
    users = next;
    if (live) await db.collection("meta").doc("users").set({ list: next });
    else localStorage.setItem(LS_USERS, JSON.stringify(next));
    renderPeople();
  }

  async function addPerson() {
    const name = $("pName").value.trim();
    const username = $("pUser").value.trim();
    const password = $("pPass").value.trim();
    const role = $("pRole").value;
    if (name.length < 2 || username.length < 2 || password.length < 3) {
      $("peopleStatus").textContent = "Name, username, and a short password are required.";
      return;
    }
    const existing = allUsers();
    if (existing.some((u) => String(u.username).toLowerCase() === username.toLowerCase())) {
      $("peopleStatus").textContent = "That username is already used.";
      return;
    }
    const extras = (users && users.length ? users : []).concat([{ name, username, password, role }]);
    try {
      await saveUsers(extras);
      $("pName").value = "";
      $("pUser").value = "";
      $("pPass").value = "";
      $("peopleStatus").textContent = "Added. Give them the username and password.";
      toast("Person added");
    } catch (err) {
      $("peopleStatus").textContent = err.message;
    }
  }

  async function removePerson(username) {
    if (!username) return;
    if (!confirm("Remove " + username + "?")) return;
    const extras = (users || []).filter((u) => String(u.username).toLowerCase() !== String(username).toLowerCase());
    await saveUsers(extras);
  }

  async function addThought() {
    const s = currentSession();
    const author = (s && (s.name || s.username)) || $("author").value.trim();
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
      role: (s && s.role) || "student",
      username: (s && s.username) || "",
      text,
      createdAt: new Date().toISOString(),
    };
    $("submitShare").disabled = true;
    try {
      if (live) await db.collection("thoughts").add(thought);
      else {
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

  function startFirebase() {
    firebase.initializeApp(cfg.firebase);
    db = firebase.firestore();
    live = true;
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
    db.collection("meta")
      .doc("users")
      .onSnapshot((snap) => {
        users = snap.exists && Array.isArray(snap.data().list) ? snap.data().list : [];
        renderPeople();
      });
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
    users = readLocal(LS_USERS, []);
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
      if (currentSession()) signOut();
      else openOverlay("loginOverlay");
    });
    $("cancelLogin").addEventListener("click", () => closeOverlay("loginOverlay"));
    $("submitLogin").addEventListener("click", signIn);
    $("addPerson").addEventListener("click", addPerson);
    $("peopleList").addEventListener("click", (e) => {
      const un = e.target && e.target.getAttribute("data-un");
      if (un) removePerson(un);
    });
    $("cancelShare").addEventListener("click", () => closeOverlay("shareOverlay"));
    $("submitShare").addEventListener("click", addThought);

    $("openTeacher").addEventListener("click", () => {
      if (canPrepareLesson()) {
        openOverlay("adminOverlay");
        paintQr();
        renderSession();
      } else openOverlay("loginOverlay");
    });
    $("cancelPin").addEventListener("click", () => closeOverlay("pinOverlay"));
    $("submitPin").addEventListener("click", () => {
      if ($("pinInput").value === String(cfg.adminPin || "")) {
        sessionStorage.setItem(LS_UNLOCK, "1");
        $("pinStatus").textContent = "";
        $("pinInput").value = "";
        closeOverlay("pinOverlay");
        openOverlay("adminOverlay");
        paintQr();
      } else {
        $("pinStatus").textContent = "That PIN is not right.";
      }
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

    ["shareOverlay", "pinOverlay", "adminOverlay", "loginOverlay"].forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target.id === id) closeOverlay(id);
      });
    });

    window.addEventListener("hashchange", () => {
      setView(location.hash === "#lesson" ? "lesson" : "cover");
    });
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
