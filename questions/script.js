let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;

const els = {
  categorySelect: document.getElementById('categorySelect'),
  questionText: document.getElementById('questionText'),
  categoryPill: document.getElementById('categoryPill'),
  counter: document.getElementById('counter'),
  subtitle: document.getElementById('subtitle'),
  nextButton: document.getElementById('nextButton'),
  copyButton: document.getElementById('copyButton'),
  shuffleButton: document.getElementById('shuffleButton'),
};

function safeCategory(q){
  return (q && q.category && String(q.category).trim()) ? String(q.category).trim() : 'General';
}

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function buildCategoryOptions(){
  const cats = new Set(['All']);
  allQuestions.forEach(q => cats.add(safeCategory(q)));

  els.categorySelect.innerHTML = '';
  [...cats].sort((a,b) => a.localeCompare(b)).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'All' ? 'All categories' : cat;
    els.categorySelect.appendChild(opt);
  });

  const saved = localStorage.getItem('qa_category');
  if (saved && [...cats].includes(saved)) els.categorySelect.value = saved;
}

function applyFilter(){
  const selected = els.categorySelect.value || 'All';
  localStorage.setItem('qa_category', selected);

  if (selected === 'All'){
    filteredQuestions = [...allQuestions];
  } else {
    filteredQuestions = allQuestions.filter(q => safeCategory(q) === selected);
  }

  currentIndex = 0;
  shuffle(filteredQuestions);
  showCurrent();
}

function showCurrent(){
  if (!filteredQuestions.length){
    els.questionText.textContent = 'No questions in this category';
    els.categoryPill.textContent = els.categorySelect.value || 'All';
    els.counter.textContent = '0/0';
    els.subtitle.textContent = 'Try another category';
    return;
  }

  const q = filteredQuestions[currentIndex];
  const cat = (els.categorySelect.value === 'All') ? safeCategory(q) : els.categorySelect.value;

  els.questionText.textContent = q.text;
  els.categoryPill.textContent = cat;
  els.counter.textContent = `${currentIndex + 1}/${filteredQuestions.length}`;
  els.subtitle.textContent = 'Tap Next for a new question';
}

function nextQuestion(){
  if (!filteredQuestions.length) return;
  currentIndex = (currentIndex + 1) % filteredQuestions.length;
  showCurrent();
}

async function copyQuestion(){
  const text = els.questionText.textContent || '';
  if (!text.trim()) return;

  try{
    await navigator.clipboard.writeText(text);
    const old = els.copyButton.textContent;
    els.copyButton.textContent = 'Copied';
    setTimeout(() => (els.copyButton.textContent = old), 900);
  } catch {
    const old = els.copyButton.textContent;
    els.copyButton.textContent = 'Select and copy';
    setTimeout(() => (els.copyButton.textContent = old), 1200);
  }
}

function reshuffle(){
  if (!filteredQuestions.length) return;
  shuffle(filteredQuestions);
  currentIndex = 0;
  showCurrent();
}

function wireEvents(){
  els.categorySelect.addEventListener('change', applyFilter);
  els.nextButton.addEventListener('click', nextQuestion);
  els.copyButton.addEventListener('click', copyQuestion);
  els.shuffleButton.addEventListener('click', reshuffle);

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'select' || tag === 'input' || tag === 'textarea') return;

    if (e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      nextQuestion();
    }
    if (e.key === 'ArrowRight'){
      nextQuestion();
    }
  });
}

async function init(){
  wireEvents();

  const response = await fetch('question_list.json', { cache: 'no-store' });
  const data = await response.json();

  allQuestions = (data && Array.isArray(data.questions)) ? data.questions : [];
  buildCategoryOptions();
  applyFilter();
}

init();
