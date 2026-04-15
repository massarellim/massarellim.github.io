const questions = [
    {
        question: "Which is taller?",
        left: "Eiffel Tower",
        right: "Statue of Liberty"
    },
    {
        question: "Which is faster?",
        left: "Cheetah",
        right: "Peregrine Falcon"
    },
    {
        question: "Which is larger?",
        left: "Pacific Ocean",
        right: "Atlantic Ocean"
    },
    {
        question: "Which came first?",
        left: "Star Wars",
        right: "Indiana Jones"
    },
    {
        question: "Which is heavier?",
        left: "A Ton of Feathers",
        right: "A Ton of Bricks"
    },
    {
        question: "Which is more popular on Google?",
        left: "Pizza",
        right: "Burgers"
    },
    {
        question: "Which has more moons?",
        left: "Jupiter",
        right: "Saturn"
    },
    {
        question: "Which is older?",
        left: "The Pyramids",
        right: "Stonehenge"
    },
    {
        question: "Which is further from the Sun?",
        left: "Neptune",
        right: "Pluto"
    },
    {
        question: "Which is more common?",
        left: "Oxygen",
        right: "Nitrogen"
    }
];

let currentQuestionIndex = 0;

const questionTextEl = document.getElementById('question-text');
const leftTextEl = document.getElementById('left-text');
const rightTextEl = document.getElementById('right-text');
const leftPane = document.getElementById('left-choice');
const rightPane = document.getElementById('right-choice');

function loadQuestion(index) {
    const currentQuestion = questions[index];
    
    // Add a fade-out effect or similar if desired, but for simplicity and speed:
    questionTextEl.innerText = currentQuestion.question;
    leftTextEl.innerText = currentQuestion.left;
    rightTextEl.innerText = currentQuestion.right;
    
    // Reset any active states if needed
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

leftPane.addEventListener('click', () => {
    console.log('Selected Left:', questions[currentQuestionIndex].left);
    nextQuestion();
});

rightPane.addEventListener('click', () => {
    console.log('Selected Right:', questions[currentQuestionIndex].right);
    nextQuestion();
});

// Initialize
loadQuestion(currentQuestionIndex);
