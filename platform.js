const resultBox = document.querySelector('#resultBox');

document.querySelector('#integrateBtn').addEventListener('click', async () => {
  const payload = {
    title: document.querySelector('#title').value.trim(),
    tmdb_id: document.querySelector('#tmdbId').value ? Number(document.querySelector('#tmdbId').value) : null,
  };

  try {
    const res = await fetch('/api/platform/integrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    resultBox.textContent = `Ошибка: ${e.message}`;
  }
});
