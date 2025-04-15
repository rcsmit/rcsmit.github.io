let currentQuestionIndex = 0;
let filteredQuestions = [];

// Function to fetch questions from the JSON file
async function fetchQuestions() {
  const response = await fetch('question_list.json');
  const data = await response.json();
  filteredQuestions = data.questions;
  shuffleQuestions();  // Shuffle the questions after fetching them
  showQuestion();
}

// Function to shuffle questions randomly
function shuffleQuestions() {
  for (let i = filteredQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filteredQuestions[i], filteredQuestions[j]] = [filteredQuestions[j], filteredQuestions[i]];
  }
}

// Function to show the current question
function showQuestion() {
  const questionText = document.getElementById('questionText');
  questionText.textContent = filteredQuestions[currentQuestionIndex].text;
}

// Function to move to the next question
function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= filteredQuestions.length) {
    currentQuestionIndex = 0; // Loop back to the first question
  }
  showQuestion();
}

// Function to filter questions based on category
function filterQuestions() {
  const categorySelect = document.getElementById('categorySelect');
  const selectedCategory = categorySelect.value;

  if (selectedCategory === 'All') {
    filteredQuestions = [...data.questions];
  } else {
    filteredQuestions = data.questions.filter(q => q.category === selectedCategory);
  }

  shuffleQuestions();  // Shuffle the questions after filtering
  currentQuestionIndex = 0; // Reset to the first question after filtering
  showQuestion();
}

// Initial fetch and display of the questions
fetchQuestions();
