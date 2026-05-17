async function fetchJSON(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('無法連線到伺服器，請稍後再試。');
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message);
  }
  return res.json();
}

async function readErrorMessage(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    return '請求失敗，請稍後再試。';
  }

  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return '輸入資料格式不正確，請檢查後再送出。';
  return '請求失敗，請稍後再試。';
}

function showError(message) {
  const error = document.getElementById('error-message');
  error.textContent = message;
  error.hidden = false;
}

function clearError() {
  const error = document.getElementById('error-message');
  error.textContent = '';
  error.hidden = true;
}

async function runWithErrorHandling(action) {
  try {
    clearError();
    await action();
  } catch (err) {
    showError(err.message || '發生未預期的錯誤，請稍後再試。');
  }
}

const PAGE_SIZE = 5;

const noteState = {
  page: 0,
  pageSize: PAGE_SIZE,
  q: '',
};

const actionState = {
  page: 0,
  pageSize: PAGE_SIZE,
  completed: null,
};

function buildURL(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, value);
  }

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function updatePagination(prefix, state, total) {
  const prev = document.getElementById(`${prefix}-prev`);
  const next = document.getElementById(`${prefix}-next`);
  const pageInfo = document.getElementById(`${prefix}-page-info`);
  const count = document.getElementById(`${prefix}-count`);
  const totalPages = total > 0 ? Math.ceil(total / state.pageSize) : 0;

  prev.disabled = state.page === 0;
  next.disabled = total === 0 || state.page >= totalPages - 1;
  pageInfo.textContent =
    total === 0 ? '目前無資料' : `第 ${state.page + 1} / ${totalPages} 頁`;
  count.textContent = `共 ${total} 筆資料`;
}

async function loadNotes() {
  const list = document.getElementById('notes');
  list.innerHTML = '';
  const listParams = {
    q: noteState.q,
    skip: noteState.page * noteState.pageSize,
    limit: noteState.pageSize,
  };
  const countParams = { q: noteState.q };
  const [notes, noteCount] = await Promise.all([
    fetchJSON(buildURL('/notes/', listParams)),
    fetchJSON(buildURL('/notes/count', countParams)),
  ]);

  if (notes.length === 0 && noteCount.total > 0 && noteState.page > 0) {
    noteState.page -= 1;
    return loadNotes();
  }

  for (const n of notes) {
    const li = document.createElement('li');
    li.textContent = `${n.title}: ${n.content}`;
    list.appendChild(li);
  }

  updatePagination('notes', noteState, noteCount.total);
}

async function loadActions() {
  const list = document.getElementById('actions');
  list.innerHTML = '';
  const listParams = {
    completed: actionState.completed,
    skip: actionState.page * actionState.pageSize,
    limit: actionState.pageSize,
  };
  const countParams = { completed: actionState.completed };
  const [items, actionCount] = await Promise.all([
    fetchJSON(buildURL('/action-items/', listParams)),
    fetchJSON(buildURL('/action-items/count', countParams)),
  ]);

  if (items.length === 0 && actionCount.total > 0 && actionState.page > 0) {
    actionState.page -= 1;
    return loadActions();
  }

  for (const a of items) {
    const li = document.createElement('li');
    li.textContent = `${a.description} [${a.completed ? '已完成' : '未完成'}]`;
    if (!a.completed) {
      const btn = document.createElement('button');
      btn.textContent = '完成';
      btn.onclick = async () => {
        await runWithErrorHandling(async () => {
          await fetchJSON(`/action-items/${a.id}/complete`, { method: 'PUT' });
          await loadActions();
        });
      };
      li.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.textContent = '重新開啟';
      btn.onclick = async () => {
        await runWithErrorHandling(async () => {
          await fetchJSON(`/action-items/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: false }),
          });
          await loadActions();
        });
      };
      li.appendChild(btn);
    }
    list.appendChild(li);
  }

  updatePagination('actions', actionState, actionCount.total);
}

window.addEventListener('DOMContentLoaded', () => {
  for (const input of document.querySelectorAll('[data-required-message]')) {
    input.addEventListener('invalid', () => {
      input.setCustomValidity(input.dataset.requiredMessage);
    });
    input.addEventListener('input', () => {
      input.setCustomValidity('');
    });
  }

  document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await runWithErrorHandling(async () => {
      const title = document.getElementById('note-title').value;
      const content = document.getElementById('note-content').value;
      await fetchJSON('/notes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      e.target.reset();
      noteState.page = 0;
      await loadNotes();
    });
  });

  document.getElementById('note-search-btn').addEventListener('click', async () => {
    await runWithErrorHandling(async () => {
      noteState.q = document.getElementById('note-search').value.trim();
      noteState.page = 0;
      await loadNotes();
    });
  });

  document.getElementById('action-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await runWithErrorHandling(async () => {
      const description = document.getElementById('action-desc').value;
      await fetchJSON('/action-items/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      e.target.reset();
      actionState.page = 0;
      await loadActions();
    });
  });

  document.getElementById('filter-completed').addEventListener('change', (e) => {
    runWithErrorHandling(async () => {
      actionState.completed = e.target.checked ? true : null;
      actionState.page = 0;
      await loadActions();
    });
  });

  document.getElementById('notes-prev').addEventListener('click', () => {
    if (noteState.page === 0) return;
    runWithErrorHandling(async () => {
      noteState.page -= 1;
      await loadNotes();
    });
  });

  document.getElementById('notes-next').addEventListener('click', () => {
    runWithErrorHandling(async () => {
      noteState.page += 1;
      await loadNotes();
    });
  });

  document.getElementById('actions-prev').addEventListener('click', () => {
    if (actionState.page === 0) return;
    runWithErrorHandling(async () => {
      actionState.page -= 1;
      await loadActions();
    });
  });

  document.getElementById('actions-next').addEventListener('click', () => {
    runWithErrorHandling(async () => {
      actionState.page += 1;
      await loadActions();
    });
  });

  runWithErrorHandling(async () => {
    await loadNotes();
    await loadActions();
  });
});
