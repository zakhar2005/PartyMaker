const resultBox = document.querySelector('#resultBox');

document.querySelector('#integrateBtn').addEventListener('click', async () => {
  const payload = {
    title: document.querySelector('#title').value.trim(),
    date: document.querySelector('#date').value.trim(),
    movie_link: document.querySelector('#movieLink').value.trim(),
    classmate_api_url: document.querySelector('#classmateUrl').value.trim(),
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
