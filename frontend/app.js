const API_BASE = localStorage.getItem("lhdApiBase") || window.LHD_API_BASE || "http://localhost:3000";
const route = parseRoute();

const state = {
  routeSiteSlug: route.siteSlug || "",
  clientToken: getStoredClientToken(route.siteSlug || new URLSearchParams(location.search).get("site") || localStorage.getItem("clientSlug") || ""),
  clientSlug: route.siteSlug || new URLSearchParams(location.search).get("site") || localStorage.getItem("clientSlug") || "",
  adminToken: localStorage.getItem("adminToken"),
  entries: [],
  adminEntries: [],
  currentDate: new Date(),
  adminCurrentDate: new Date(),
  selectedSite: null,
  adminSites: [],
  toastTimer: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  clientView: $("clientView"),
  adminView: $("adminView"),
  clientLoginForm: $("clientLoginForm"),
  clientLoginTitle: $("clientLoginTitle"),
  clientLoginMessage: $("clientLoginMessage"),
  clientSlugField: $("clientSlugField"),
  clientSlug: $("clientSlug"),
  clientPassword: $("clientPassword"),
  clientDashboard: $("clientDashboard"),
  siteName: $("siteName"),
  siteStatus: $("siteStatus"),
  siteNotice: $("siteNotice"),
  calendarTitle: $("calendarTitle"),
  calendarGrid: $("calendarGrid"),
  prevMonthBtn: $("prevMonthBtn"),
  nextMonthBtn: $("nextMonthBtn"),
  memoForm: $("memoForm"),
  memoAuthor: $("memoAuthor"),
  memoContent: $("memoContent"),
  memoList: $("memoList"),
  refreshMemosBtn: $("refreshMemosBtn"),
  photoDialog: $("photoDialog"),
  photoViewer: $("photoViewer"),
  closePhotoDialog: $("closePhotoDialog"),
  adminLoginForm: $("adminLoginForm"),
  adminLoginMessage: $("adminLoginMessage"),
  adminDashboard: $("adminDashboard"),
  siteForm: $("siteForm"),
  siteList: $("siteList"),
  loadSitesBtn: $("loadSitesBtn"),
  adminSitePanel: $("adminSitePanel"),
  adminSelectedSiteName: $("adminSelectedSiteName"),
  siteStatusSelect: $("siteStatusSelect"),
  adminNoticeEdit: $("adminNoticeEdit"),
  saveSiteBtn: $("saveSiteBtn"),
  entryDateInput: $("entryDateInput"),
  scheduleInput: $("scheduleInput"),
  detailTextInput: $("detailTextInput"),
  photoInput: $("photoInput"),
  uploadPhotosBtn: $("uploadPhotosBtn"),
  adminPhotoList: $("adminPhotoList"),
  saveScheduleBtn: $("saveScheduleBtn"),
  softDeleteSiteBtn: $("softDeleteSiteBtn"),
  purgeSiteBtn: $("purgeSiteBtn"),
  previewClientBtn: $("previewClientBtn"),
  toast: $("toast"),
  adminCalendarTitle: $("adminCalendarTitle"),
  adminCalendarGrid: $("adminCalendarGrid"),
  adminCalendarMessage: $("adminCalendarMessage"),
  adminPrevMonthBtn: $("adminPrevMonthBtn"),
  adminNextMonthBtn: $("adminNextMonthBtn"),
};

consumePreviewToken();
els.clientSlug.value = state.clientSlug;
configureClientEntry();

els.clientLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const slug = state.routeSiteSlug || els.clientSlug.value.trim();
  try {
    const data = await api(`/api/sites/${encodeURIComponent(slug)}/verify`, {
      method: "POST",
      body: { password: els.clientPassword.value },
    });
    state.clientToken = data.token;
    state.clientSlug = slug;
    storeClientToken(slug, data.token);
    localStorage.setItem("clientSlug", slug);
    await loadClientDashboard();
  } catch (error) {
    els.clientLoginMessage.textContent = error.message;
  }
});

els.prevMonthBtn.addEventListener("click", () => {
  state.currentDate.setMonth(state.currentDate.getMonth() - 1);
  renderCalendar();
});

els.nextMonthBtn.addEventListener("click", () => {
  state.currentDate.setMonth(state.currentDate.getMonth() + 1);
  renderCalendar();
});

els.adminPrevMonthBtn.addEventListener("click", () => {
  state.adminCurrentDate.setMonth(state.adminCurrentDate.getMonth() - 1);
  renderAdminCalendar();
});

els.adminNextMonthBtn.addEventListener("click", () => {
  state.adminCurrentDate.setMonth(state.adminCurrentDate.getMonth() + 1);
  renderAdminCalendar();
});

els.entryDateInput.addEventListener("change", () => {
  const entry = findAdminEntry(els.entryDateInput.value);
  els.scheduleInput.value = entry?.schedule_text || "";
  els.detailTextInput.value = entry?.detail_text || "";
  renderAdminPhotoList(entry);
  renderAdminCalendar();
});

els.refreshMemosBtn.addEventListener("click", loadMemos);

els.memoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api(`/api/sites/${state.clientSlug}/memos`, {
    method: "POST",
    token: state.clientToken,
    body: {
      authorName: els.memoAuthor.value.trim() || "고객",
      content: els.memoContent.value.trim(),
    },
  });
  els.memoContent.value = "";
  await loadMemos();
});

els.closePhotoDialog.addEventListener("click", () => els.photoDialog.close());

els.adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: {
        username: $("adminEmail").value.trim(),
        password: $("adminPassword").value,
      },
    });
    state.adminToken = data.token;
    localStorage.setItem("adminToken", data.token);
    els.adminLoginForm.classList.add("hidden");
    els.adminDashboard.classList.remove("hidden");
    await loadAdminSites();
  } catch (error) {
    els.adminLoginMessage.textContent = error.message;
  }
});

els.loadSitesBtn.addEventListener("click", safeLoadAdminSites);

els.siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/admin/sites", {
    method: "POST",
    token: state.adminToken,
    body: {
      name: $("siteNameInput").value,
      slug: $("siteSlugInput").value,
      accessPassword: $("sitePasswordInput").value,
      notice: $("siteNoticeInput").value,
    },
  });
  event.target.reset();
  await loadAdminSites();
});

els.saveSiteBtn.addEventListener("click", async () => {
  if (!state.selectedSite) return;
  const data = await api(`/api/admin/sites/${state.selectedSite.id}`, {
    method: "PATCH",
    token: state.adminToken,
    body: {
      notice: els.adminNoticeEdit.value,
      status: els.siteStatusSelect.value,
    },
  });
  state.selectedSite = data.site;
  await loadAdminSites();
});

els.saveScheduleBtn.addEventListener("click", async () => {
  if (!state.selectedSite || !els.entryDateInput.value) return;
  const data = await api(`/api/admin/sites/${state.selectedSite.id}/calendar/${els.entryDateInput.value}`, {
    method: "PUT",
    token: state.adminToken,
    body: {
      scheduleText: els.scheduleInput.value,
      detailText: els.detailTextInput.value,
    },
  });
  upsertAdminEntry(data.entry);
  renderAdminCalendar();
  loadAdminCalendar().catch(showAdminCalendarError);
  showToast("일정을 저장했습니다.");
});

els.uploadPhotosBtn.addEventListener("click", async () => {
  if (!state.selectedSite || !els.entryDateInput.value || els.photoInput.files.length === 0) return;
  const files = [...els.photoInput.files];
  setUploadBusy(true);
  try {
    for (let start = 0; start < files.length; start += 5) {
      showToast(`사진 업로드 중 ${Math.min(start + 5, files.length)} / ${files.length}`);
      const form = new FormData();
      files.slice(start, start + 5).forEach((file) => form.append("photos", file));
      await fetch(`${API_BASE}/api/admin/sites/${state.selectedSite.id}/calendar/${els.entryDateInput.value}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${state.adminToken}` },
        body: form,
      }).then(handleFetch);
    }
    els.photoInput.value = "";
    await loadAdminCalendar();
    renderAdminPhotoList(findAdminEntry(els.entryDateInput.value));
    showToast(`사진 ${files.length}장을 업로드했습니다.`);
  } catch (error) {
    showToast(`사진 업로드 실패: ${error.message}`);
  } finally {
    setUploadBusy(false);
  }
});

els.previewClientBtn.addEventListener("click", openClientPreview);

els.softDeleteSiteBtn.addEventListener("click", async () => {
  if (!state.selectedSite || !confirm("고객 접근을 종료할까요? 데이터는 보관됩니다.")) return;
  await api(`/api/admin/sites/${state.selectedSite.id}`, { method: "DELETE", token: state.adminToken });
  state.selectedSite = null;
  await loadAdminSites();
});

els.purgeSiteBtn.addEventListener("click", async () => {
  if (!state.selectedSite || !confirm("DB와 사진 파일을 완전히 삭제할까요? 되돌릴 수 없습니다.")) return;
  await api(`/api/admin/sites/${state.selectedSite.id}?mode=purge`, { method: "DELETE", token: state.adminToken });
  state.selectedSite = null;
  await loadAdminSites();
});

async function loadClientDashboard() {
  const data = await api(`/api/sites/${state.clientSlug}/calendar`, {
    token: state.clientToken,
  });
  state.entries = data.entries;
  els.clientLoginForm.classList.add("hidden");
  els.clientDashboard.classList.remove("hidden");
  els.siteName.textContent = data.site.name;
  els.siteStatus.textContent = data.site.status === "completed" ? "완료" : "진행중";
  if (data.site.notice) {
    els.siteNotice.textContent = data.site.notice;
    els.siteNotice.classList.remove("hidden");
  } else {
    els.siteNotice.classList.add("hidden");
  }
  renderCalendar();
  if (!els.memoForm.closest(".memo-panel")?.classList.contains("hidden")) {
    await loadMemos();
  }
}

function configureClientEntry() {
  if (state.routeSiteSlug) {
    els.clientSlug.value = state.routeSiteSlug;
    els.clientSlugField.classList.add("hidden");
    loadClientLoginTitle(state.routeSiteSlug).catch(() => {});
  } else {
    els.clientSlugField.classList.remove("hidden");
  }
}

async function loadClientLoginTitle(slug) {
  if (!slug || !els.clientLoginTitle) return;
  const data = await api(`/api/sites/${encodeURIComponent(slug)}`);
  els.clientLoginTitle.textContent = `'${data.site.name}' 현장 일정 캘린더입니다.`;
}

async function loadMemos() {
  const data = await api(`/api/sites/${state.clientSlug}/memos`, { token: state.clientToken });
  els.memoList.innerHTML = data.memos
    .map(
      (memo) => `
        <article class="memo-item">
          <div class="memo-meta">
            <strong>${escapeHtml(memo.author_name)}</strong>
            <time>${escapeHtml(formatMemoTime(memo.created_at))}</time>
          </div>
          <p>${escapeHtml(memo.content)}</p>
        </article>
      `,
    )
    .join("");
}

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  els.calendarTitle.textContent = `${year}년 ${month + 1}월`;
  els.calendarGrid.innerHTML = "";

  const byDate = new Map(state.entries.map((entry) => [entry.entry_date.slice(0, 10), entry]));
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    const entry = byDate.get(key);
    const scheduleText = entry?.schedule_text || "";
    const showScheduleText = scheduleText && visibleTextLength(scheduleText) <= 4;
    const hasPopupContent = Boolean(entry?.schedule_text || entry?.photos?.length || entry?.detail_text);
    const cell = document.createElement(hasPopupContent ? "button" : "article");
    if (hasPopupContent) {
      cell.type = "button";
      cell.setAttribute("aria-label", `${formatDate(entry.entry_date)} 내용 보기`);
      cell.addEventListener("click", () => openEntryPopup(entry));
    }
    cell.className = `day-cell ${date.getMonth() === month ? "" : "muted"} ${entry ? "has-entry" : ""}`;
    cell.innerHTML = `<span class="day-number">${date.getDate()}</span>`;
    if (showScheduleText) {
      cell.insertAdjacentHTML("beforeend", `<span class="schedule-text short-schedule-text">${escapeHtml(scheduleText)}</span>`);
    }
    if (hasPopupContent) {
      const actions = document.createElement("div");
      actions.className = "entry-actions";
      if (scheduleText && !showScheduleText) {
        actions.appendChild(createEntryIndicator("일정", "schedule"));
      }
      if (entry.photos?.length) {
        actions.appendChild(createEntryIndicator("사진", "photo"));
      }
      if (entry.detail_text) {
        actions.appendChild(createEntryIndicator("글", "text"));
      }
      cell.appendChild(actions);
    }
    els.calendarGrid.appendChild(cell);
  }
}

function createEntryAction(label, type, entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `entry-action ${type}`;
  button.setAttribute("aria-label", `${formatDate(entry.entry_date)} ${label} 보기`);
  button.innerHTML = `${entryIcon(type)}<span>${label}</span>`;
  button.addEventListener("click", () => openEntryPopup(entry));
  return button;
}

function createEntryIndicator(label, type) {
  const indicator = document.createElement("span");
  indicator.className = `entry-action entry-indicator ${type}`;
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `${entryIcon(type)}<span>${label}</span>`;
  return indicator;
}

function entryIcon(type) {
  if (type === "photo") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2.1l1.2-1.5h4.4L15.4 5h2.1A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>';
  }
  if (type === "schedule") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10ZM6 8h12V6H6v2Zm2 4h3v3H8v-3Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm8 1.8V7h2.2L14 4.8ZM8 10v1.6h8V10H8Zm0 3.2v1.6h8v-1.6H8Zm0 3.2V18h5v-1.6H8Z"/></svg>';
}

function renderAdminCalendar() {
  if (!state.selectedSite) return;
  els.adminCalendarMessage.textContent = "";
  const year = state.adminCurrentDate.getFullYear();
  const month = state.adminCurrentDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  els.adminCalendarTitle.textContent = `${year}년 ${month + 1}월`;
  els.adminCalendarGrid.innerHTML = "";

  const selectedDate = els.entryDateInput.value;
  const byDate = new Map(state.adminEntries.map((entry) => [entry.entry_date.slice(0, 10), entry]));
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    const entry = byDate.get(key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-cell admin-day ${date.getMonth() === month ? "" : "muted"} ${selectedDate === key ? "selected-day" : ""}`;
    button.innerHTML = `<span class="day-number">${date.getDate()}</span>`;
    if (entry?.schedule_text) {
      button.insertAdjacentHTML("beforeend", `<span class="schedule-text">${escapeHtml(entry.schedule_text)}</span>`);
    }
    if (entry?.detail_text) {
      button.insertAdjacentHTML("beforeend", '<span class="detail-dot">글</span>');
    }
    if (entry?.photos?.length) {
      button.insertAdjacentHTML("beforeend", `<span class="photo-count">사진 ${entry.photos.length}</span>`);
    }
    button.addEventListener("click", () => selectAdminDate(key, entry));
    els.adminCalendarGrid.appendChild(button);
  }
}

function selectAdminDate(dateKey, entry) {
  els.entryDateInput.value = dateKey;
  els.scheduleInput.value = entry?.schedule_text || "";
  els.detailTextInput.value = entry?.detail_text || "";
  renderAdminPhotoList(entry);
  renderAdminCalendar();
}

function findAdminEntry(dateKey) {
  return state.adminEntries.find((entry) => entry.entry_date.slice(0, 10) === dateKey);
}

function upsertAdminEntry(entry) {
  const dateKey = entry.entry_date.slice(0, 10);
  const existingIndex = state.adminEntries.findIndex((item) => item.entry_date.slice(0, 10) === dateKey);
  const normalized = {
    ...entry,
    photos: state.adminEntries[existingIndex]?.photos || entry.photos || [],
  };
  if (existingIndex >= 0) {
    state.adminEntries.splice(existingIndex, 1, normalized);
  } else {
    state.adminEntries.push(normalized);
  }
}

function openEntryPopup(entry) {
  const photos = entry.photos || [];
  const photoHtml = photos.length
    ? photos.map((photo) => `<img src="${API_BASE}${photo.file_path}" alt="${escapeHtml(photo.original_name)}">`).join("")
    : "";
  const scheduleHtml = entry.schedule_text
    ? `<article class="photo-detail"><strong>${escapeHtml(formatDate(entry.entry_date))} 일정</strong><p>${escapeHtml(entry.schedule_text)}</p></article>`
    : "";
  const detailHtml = entry.detail_text
    ? `<article class="photo-detail"><strong>${escapeHtml(formatDate(entry.entry_date))} 글</strong><p>${escapeHtml(entry.detail_text)}</p></article>`
    : "";
  const emptyHtml = photoHtml || scheduleHtml || detailHtml ? "" : '<p class="empty-detail">등록된 내용이 없습니다.</p>';
  els.photoViewer.innerHTML = `${photoHtml}${scheduleHtml}${detailHtml}${emptyHtml}`;
  els.photoDialog.showModal();
}

async function loadAdminSites() {
  const data = await api("/api/admin/sites", { token: state.adminToken });
  state.adminSites = data.sites;
  els.siteList.innerHTML = "";
  data.sites.forEach((site) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `site-card ${state.selectedSite?.id === site.id ? "selected" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(site.name)}</strong><br><small>${escapeHtml(site.slug)} · ${statusLabel(site.status)}</small>`;
    button.addEventListener("click", () => selectAdminSite(site));
    els.siteList.appendChild(button);
  });
  if (!state.selectedSite) els.adminSitePanel.classList.add("hidden");
}

async function safeLoadAdminSites() {
  try {
    await loadAdminSites();
  } catch (error) {
    if (isAdminAuthError(error)) {
      clearAdminSession("관리자 로그인이 만료됐습니다. 다시 로그인해주세요.");
      return;
    }
    els.siteList.innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
  }
}

function selectAdminSite(site) {
  state.selectedSite = site;
  els.adminSitePanel.classList.remove("hidden");
  els.adminSelectedSiteName.textContent = site.name;
  els.siteStatusSelect.value = site.status === "completed" ? "completed" : "active";
  els.adminNoticeEdit.value = site.notice || "";
  els.entryDateInput.value = toDateKey(new Date());
  els.scheduleInput.value = "";
  els.detailTextInput.value = "";
  renderAdminPhotoList();
  loadAdminCalendar().catch(showAdminCalendarError);
  loadAdminSites();
}

async function loadAdminCalendar() {
  if (!state.selectedSite) return;
  const data = await api(`/api/admin/sites/${state.selectedSite.id}/calendar`, { token: state.adminToken });
  state.adminEntries = data.entries;
  const currentEntry = state.adminEntries.find((entry) => entry.entry_date.slice(0, 10) === els.entryDateInput.value);
  if (currentEntry) {
    els.scheduleInput.value = currentEntry.schedule_text || "";
    els.detailTextInput.value = currentEntry.detail_text || "";
  }
  renderAdminPhotoList(currentEntry);
  renderAdminCalendar();
}

function renderAdminPhotoList(entry = findAdminEntry(els.entryDateInput.value)) {
  const photos = entry?.photos || [];
  if (!photos.length) {
    els.adminPhotoList.innerHTML = '<p class="empty-detail">선택한 날짜에 업로드된 사진이 없습니다.</p>';
    return;
  }
  els.adminPhotoList.innerHTML = `
    <strong class="photo-list-title">업로드된 사진</strong>
    <div class="photo-thumb-grid">
      ${photos
        .map(
          (photo) => `
            <article class="photo-thumb-card">
              <img src="${API_BASE}${photo.file_path}" alt="${escapeHtml(photo.original_name)}">
              <div>
                <span>${escapeHtml(photo.original_name)}</span>
                <button class="outline delete-photo-btn" type="button" data-photo-id="${escapeHtml(photo.id)}">삭제</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
  els.adminPhotoList.querySelectorAll(".delete-photo-btn").forEach((button) => {
    button.addEventListener("click", () => deleteAdminPhoto(button.dataset.photoId));
  });
}

async function deleteAdminPhoto(photoId) {
  if (!photoId || !confirm("이 사진을 삭제할까요?")) return;
  await api(`/api/admin/photos/${encodeURIComponent(photoId)}`, {
    method: "DELETE",
    token: state.adminToken,
  });
  await loadAdminCalendar();
}

async function openClientPreview() {
  if (!state.selectedSite) return;
  const data = await api(`/api/admin/sites/${state.selectedSite.id}/preview-token`, {
    method: "POST",
    token: state.adminToken,
  });
  const url = new URL(`/${encodeURIComponent(data.slug)}`, location.origin);
  url.searchParams.set("previewToken", data.token);
  window.open(url.toString(), "_blank", "noopener");
}

function showAdminCalendarError(error) {
  els.adminCalendarMessage.textContent = `${error.message} API 컨테이너를 재빌드했는지 확인해주세요.`;
}

function setMode(mode) {
  const admin = mode === "admin";
  els.adminView.classList.toggle("hidden", !admin);
  els.clientView.classList.toggle("hidden", admin);
  if (admin && state.adminToken) {
    els.adminLoginForm.classList.add("hidden");
    els.adminDashboard.classList.remove("hidden");
    safeLoadAdminSites();
  }
  if (!admin && state.clientSlug && state.clientToken) {
    loadClientDashboard().catch(() => {
      clearClientToken(state.clientSlug);
      state.clientToken = "";
      els.clientLoginForm.classList.remove("hidden");
      els.clientDashboard.classList.add("hidden");
    });
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return handleFetch(response);
}

async function handleFetch(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `요청에 실패했습니다. (${response.status})`);
  }
  return data;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusLabel(status) {
  if (status === "completed") return "완료";
  if (status === "deleted") return "삭제됨";
  return "진행중";
}

function formatDate(value) {
  return String(value || "").slice(0, 10);
}

function formatMemoTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}일 ${hours}:${minutes}`;
}

function visibleTextLength(value) {
  return String(value || "").replace(/\s+/g, "").length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clientTokenKey(slug) {
  return `clientToken:${slug}`;
}

function getStoredClientToken(slug) {
  if (!slug) return "";
  return localStorage.getItem(clientTokenKey(slug)) || "";
}

function storeClientToken(slug, token) {
  localStorage.setItem(clientTokenKey(slug), token);
}

function clearClientToken(slug) {
  localStorage.removeItem(clientTokenKey(slug));
}

function clearAdminSession(message = "") {
  state.adminToken = "";
  localStorage.removeItem("adminToken");
  els.adminDashboard.classList.add("hidden");
  els.adminLoginForm.classList.remove("hidden");
  els.adminLoginMessage.textContent = message;
  els.siteList.innerHTML = "";
}

function isAdminAuthError(error) {
  return String(error?.message || "").includes("관리자 인증");
}

function consumePreviewToken() {
  const params = new URLSearchParams(location.search);
  const previewToken = params.get("previewToken");
  if (!previewToken || !state.clientSlug) return;
  state.clientToken = previewToken;
  storeClientToken(state.clientSlug, previewToken);
  localStorage.setItem("clientSlug", state.clientSlug);
  params.delete("previewToken");
  const query = params.toString();
  const cleanUrl = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", cleanUrl);
}

function showToast(message) {
  if (!els.toast) return;
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.requestAnimationFrame(() => els.toast.classList.add("show"));
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
    window.setTimeout(() => els.toast.classList.add("hidden"), 180);
  }, 1500);
}

function setUploadBusy(busy) {
  els.uploadPhotosBtn.disabled = busy;
  els.uploadPhotosBtn.textContent = busy ? "사진 업로드 중..." : "사진 올리기";
}

if (state.clientSlug) {
  els.clientSlug.value = state.clientSlug;
}

setMode(route.mode);

window.addEventListener("hashchange", () => {
  const nextRoute = parseRoute();
  setMode(nextRoute.mode);
});

function parseRoute() {
  const firstPath = decodeURIComponent(location.pathname.split("/").filter(Boolean)[0] || "");
  if (firstPath === "admin" || location.hash === "#admin") {
    return { mode: "admin", siteSlug: "" };
  }
  return {
    mode: "client",
    siteSlug: firstPath,
  };
}
