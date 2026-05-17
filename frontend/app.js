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

async function loadNotes(params = {}) {
  const list = document.getElementById('notes');
  list.innerHTML = '';
  const query = new URLSearchParams(params);
  const notes = await fetchJSON('/notes/?' + query.toString());
  for (const n of notes) {
    const li = document.createElement('li');
    li.textContent = `${n.title}: ${n.content}`;
    list.appendChild(li);
  }
}

async function loadActions(params = {}) {
  const list = document.getElementById('actions');
  list.innerHTML = '';
  const query = new URLSearchParams(params);
  const items = await fetchJSON('/action-items/?' + query.toString());
  for (const a of items) {
    const li = document.createElement('li');
    li.textContent = `${a.description} [${a.completed ? '已完成' : '未完成'}]`;
    if (!a.completed) {
      const btn = document.createElement('button');
      btn.textContent = '完成';
      btn.onclick = async () => {
        await runWithErrorHandling(async () => {
          await fetchJSON(`/action-items/${a.id}/complete`, { method: 'PUT' });
          await loadActions(params);
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
          await loadActions(params);
        });
      };
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
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
      await loadNotes();
    });
  });

  document.getElementById('note-search-btn').addEventListener('click', async () => {
    await runWithErrorHandling(async () => {
      const q = document.getElementById('note-search').value;
      await loadNotes({ q });
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
      await loadActions();
    });
  });

  document.getElementById('filter-completed').addEventListener('change', (e) => {
    runWithErrorHandling(async () => {
      const checked = e.target.checked;
      await loadActions(checked ? { completed: true } : {});
    });
  });

  runWithErrorHandling(async () => {
    await loadNotes();
    await loadActions();
  });
});
