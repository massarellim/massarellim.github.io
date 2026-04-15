const questions = [
    {
        question: "Which gets Googled more?",
        left: "YouTube",
        right: "Amazon",
        leftScore: 185000000,
        rightScore: 124000000
    },
    {
        question: "Which gets Googled more?",
        left: "Facebook",
        right: "Google",
        leftScore: 101000000,
        rightScore: 83100000
    },
    {
        question: "Which gets Googled more?",
        left: "Gmail",
        right: "ChatGPT",
        leftScore: 55600000,
        rightScore: 45500000
    },
    {
        question: "Which gets Googled more?",
        left: "Wordle",
        right: "News",
        leftScore: 55600000,
        rightScore: 37200000
    },
    {
        question: "Which gets Googled more?",
        left: "Weather",
        right: "Translate",
        leftScore: 37200000,
        rightScore: 30400000
    },
    {
        question: "Which gets Googled more?",
        left: "Home Depot",
        right: "NBA",
        leftScore: 30400000,
        rightScore: 24900000
    },
    {
        question: "Which gets Googled more?",
        left: "Ebay",
        right: "Instagram",
        leftScore: 24900000,
        rightScore: 20400000
    },
    {
        question: "Which gets Googled more?",
        left: "ESPN",
        right: "Lowes",
        leftScore: 20400000,
        rightScore: 16600000
    },
    {
        question: "Which gets Googled more?",
        left: "Zillow",
        right: "Google Maps",
        leftScore: 16600000,
        rightScore: 13600000
    },
    {
        question: "Which gets Googled more?",
        left: "Canva",
        right: "Netflix",
        leftScore: 20400000,
        rightScore: 13600000
    }
];

let currentQuestionIndex = 0;
let isAnimating = false;

const questionTextEl = document.getElementById('question-text');
const leftTextEl = document.getElementById('left-text');
const rightTextEl = document.getElementById('right-text');
const leftScoreEl = document.getElementById('left-score');
const rightScoreEl = document.getElementById('right-score');
const leftPane = document.getElementById('left-choice');
const rightPane = document.getElementById('right-choice');

function loadQuestion(index) {
    const currentQuestion = questions[index];
    
    questionTextEl.innerText = currentQuestion.question;
    leftTextEl.innerText = currentQuestion.left;
    rightTextEl.innerText = currentQuestion.right;
    
    // Reset scores
    leftScoreEl.innerText = "0";
    rightScoreEl.innerText = "0";
    leftScoreEl.classList.remove('visible');
    rightScoreEl.classList.remove('visible');
    
    isAnimating = false;
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex >= questions.length) {
        currentQuestionIndex = 0; // Loop back to the beginning
    }
    
    // Add a small scale down/up animation to indicate change
    document.querySelector('.game-container').style.opacity = 0.5;
    
    setTimeout(() => {
        loadQuestion(currentQuestionIndex);
        document.querySelector('.game-container').style.opacity = 1;
    }, 200);
}

function handleChoice(selectedPane) {
    if (isAnimating) return;
    isAnimating = true;
    
    const currentQuestion = questions[currentQuestionIndex];
    
    // Reveal scores with formatting
    leftScoreEl.innerText = currentQuestion.leftScore.toLocaleString();
    rightScoreEl.innerText = currentQuestion.rightScore.toLocaleString();
    
    leftScoreEl.classList.add('visible');
    rightScoreEl.classList.add('visible');
    
    // Wait 2 seconds to show scores, then go to next question
    setTimeout(() => {
        nextQuestion();
    }, 2000);
}

leftPane.addEventListener('click', () => {
    handleChoice('left');
});

rightPane.addEventListener('click', () => {
    handleChoice('right');
});

// Initialize
loadQuestion(currentQuestionIndex);
