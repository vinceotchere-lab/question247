let dataset = [];
let progress = { score: 0, answers: {} };
let currentIndex = 0;

const headerEl = document.getElementById('header');
const mainEl = document.getElementById('main');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const summaryEl = document.getElementById('summary');
const scoreDisplay = document.getElementById('scoreDisplay');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progress-bar');
const fallbackBox = document.getElementById('fallback');

const LS_KEY = 'AS352_LOCAL_DATA';

function showError(msg, extra='') {
  errorEl.innerHTML = `<strong>Dataset load failed.</strong><br/>${msg}${extra?'<br/>'+extra:''}`;
  errorEl.style.display = 'block';
  loadingEl.style.display = 'none';
  fallbackBox.style.display = 'block';
  // Pre-fill paste box with a tiny valid sample so you can test
  const sample = [
    {"number":1,"question":"Sample: Which breed has large litters?","options":["Landrace","Duroc","Hampshire","Large White"],"answer":3},
    {"number":2,"question":"Sample: Which is prone to PSE?","options":["Berkshire","Chester White","Pietrain","Tamworth"],"answer":2}
  ];
  document.getElementById('pastebox').value = JSON.stringify(sample, null, 2);
}

function normalize(arr){
  return (arr||[]).map((x,k)=>({
    number: x.number ?? (k+1),
    question: (x.question||'').trim(),
    options: x.options || [x.A,x.B,x.C,x.D].filter(Boolean),
    answer: (typeof x.answer==='number') ? x.answer : (typeof x.correct_index==='number' ? x.correct_index : 0)
  })).filter(x => x.question && x.options && x.options.length >= 2);
}

function loadProgress() {
  const saved = localStorage.getItem('AS352Progress');
  if (saved) { try { progress = JSON.parse(saved); } catch { progress = { score:0, answers:{} }; } }
}
function saveProgress() { localStorage.setItem('AS352Progress', JSON.stringify(progress)); }

function updateProgressDisplay() {
  const total = dataset.length;
  const answered = Object.keys(progress.answers).length;
  scoreDisplay.textContent = `Score: ${progress.score}`;
  progressText.textContent = `Progress: ${answered}/${total}`;
  progressBar.style.width = `${(answered/total)*100}%`;
}

function showQuestion(index) {
  currentIndex = index;
  const q = dataset[index];
  questionEl.textContent = `Q${index + 1}. ${q.question}`;
  optionsEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    if (progress.answers[index] !== undefined) {
      const chosen = progress.answers[index];
      const correct = (typeof q.answer === 'number') ? q.answer : q.options.indexOf(q.answer);
      if (i === chosen && chosen === correct) { btn.classList.add('correct'); btn.textContent += ' ✅'; }
      else if (i === chosen && chosen !== correct) { btn.classList.add('wrong'); btn.textContent += ' ❌'; }
      if (i === correct && i !== chosen) { btn.classList.add('correct'); btn.textContent += ' ✅'; }
      btn.disabled = true;
    } else {
      btn.onclick = () => handleAnswer(i);
    }
    optionsEl.appendChild(btn);
  });
  prevBtn.disabled = (index === 0);
  nextBtn.textContent = (index === dataset.length - 1) ? 'Finish' : 'Next';
  nextBtn.disabled = (progress.answers[index] === undefined);
  document.getElementById('card').style.display = 'block';
  summaryEl.style.display = 'none';
  updateProgressDisplay();
}

function handleAnswer(selected) {
  const idx = currentIndex; const q = dataset[idx];
  const correct = (typeof q.answer === 'number') ? q.answer : q.options.indexOf(q.answer);
  if (progress.answers[idx] === undefined) {
    progress.answers[idx] = selected;
    if (selected === correct) progress.score += 1;
    saveProgress();
  }
  const buttons = optionsEl.querySelectorAll('button');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) { btn.classList.add('correct'); btn.textContent += ' ✅'; }
    if (i === selected && selected !== correct) { btn.classList.add('wrong'); btn.textContent += ' ❌'; }
  });
  updateProgressDisplay();
  nextBtn.disabled = false;
}

function showSummary() {
  summaryEl.innerHTML = `<h2>Quiz Completed!</h2>
    <p>Your score: <strong>${progress.score} / ${dataset.length}</strong></p>
    <button id="restartBtn">Restart Quiz</button>`;
  document.getElementById('card').style.display = 'none';
  summaryEl.style.display = 'block';
  document.getElementById('restartBtn').onclick = () => {
    localStorage.removeItem('AS352Progress');
    progress = { score: 0, answers: {} };
    window.location.hash = '1';
  };
}

function handleRoute() {
  const h = window.location.hash;
  if (h === '#complete') {
    showSummary();
  } else {
    const n = parseInt(h.replace('#', ''));
    if (!isNaN(n) && n >= 1 && n <= dataset.length) showQuestion(n - 1);
  }
}

function bootWithData(arr){
  dataset = normalize(arr);
  if (!dataset.length) throw new Error('Dataset array is empty after normalize');
  loadProgress();
  loadingEl.style.display = 'none';
  headerEl.style.display = 'block';
  mainEl.style.display = 'block';

  const answered = Object.keys(progress.answers).length;
  if (answered >= dataset.length) { window.location.hash = 'complete'; }
  else if (answered > 0) {
    let next = 0; while (progress.answers[next] !== undefined && next < dataset.length) next++;
    window.location.hash = String(next + 1);
  } else { window.location.hash = '1'; }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  prevBtn.onclick = () => { if (currentIndex > 0) window.location.hash = String(currentIndex); };
  nextBtn.onclick = () => {
    if (currentIndex < dataset.length - 1) window.location.hash = String(currentIndex + 2);
    else window.location.hash = 'complete';
  };
}

// Try LocalStorage first (if user pasted dataset previously)
try {
  const localData = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  if (Array.isArray(localData) && localData.length) bootWithData(localData);
  else {
    // Fetch dataset.json with cache-busting
    const url = 'dataset.json?cb=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for dataset.json`);
        return r.json();
      })
      .then(arr => bootWithData(arr))
      .catch(e => {
        const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
        const ds = base + 'dataset.json';
        showError(e.message, `Expected dataset at <code>${ds}</code>. Open that URL directly to confirm it loads JSON (not <code>[]</code>).`);
        console.error('Failed to load dataset.json', e);
      });
  }
} catch (e) {
  showError(e.message || 'Unknown error parsing local dataset');
}

// Fallback editor handlers
document.getElementById('usePasted').onclick = () => {
  try {
    const raw = document.getElementById('pastebox').value;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) throw new Error('Provide a non-empty array');
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    location.reload();
  } catch (e) {
    alert('Invalid JSON: ' + e.message);
  }
};
document.getElementById('clearLocal').onclick = () => {
  localStorage.removeItem(LS_KEY);
  alert('Local dataset cleared. Reloading...');
  location.reload();
};
