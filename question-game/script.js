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
    },
    {
        question: "Which is hotter?",
        left: "Venus",
        right: "Mercury"
    },
    {
        question: "Which is longer?",
        left: "Nile",
        right: "Amazon"
    },
    {
        question: "Which has a larger population?",
        left: "Tokyo",
        right: "New York"
    },
    {
        question: "Which is bigger?",
        left: "Mount Everest",
        right: "K2"
    },
    {
        question: "Which is more dense?",
        left: "Gold",
        right: "Lead"
    },
    {
        question: "Which is harder?",
        left: "Diamond",
        right: "Corundum"
    },
    {
        question: "Which is older?",
        left: "Mona Lisa",
        right: "The Last Supper"
    },
    {
        question: "Which came first?",
        left: "Nintendo",
        right: "Sony"
    },
    {
        question: "Which is larger?",
        left: "Russia",
        right: "Canada"
    },
    {
        question: "Which has more records sold?",
        left: "The Beatles",
        right: "Elvis Presley"
    },
    {
        question: "Which is more common in the universe?",
        left: "Hydrogen",
        right: "Helium"
    },
    {
        question: "Which is faster?",
        left: "Light",
        right: "Sound"
    },
    {
        question: "Which is heavier?",
        left: "Blue Whale",
        right: "African Elephant"
    },
    {
        question: "Which has a longer lifespan?",
        left: "Tortoise",
        right: "Bowhead Whale"
    },
    {
        question: "Which is more popular?",
        left: "iPhone",
        right: "Android"
    },
    {
        question: "Which is higher?",
        left: "Burj Khalifa",
        right: "Shanghai Tower"
    },
    {
        question: "Which is deeper?",
        left: "Mariana Trench",
        right: "Grand Canyon"
    },
    {
        question: "Which is larger?",
        left: "Sahara Desert",
        right: "Antarctica"
    },
    {
        question: "Which came first?",
        left: "Internet",
        right: "World Wide Web"
    },
    {
        question: "Which has more calories?",
        left: "Avocado",
        right: "Apple"
    },
    {
        question: "Which is more common in the human body?",
        left: "Water",
        right: "Carbon"
    },
    {
        question: "Which is larger?",
        left: "Texas",
        right: "Alaska"
    },
    {
        question: "Which is older?",
        left: "Harvard",
        right: "Yale"
    },
    {
        question: "Which came first?",
        left: "Mickey Mouse",
        right: "Bugs Bunny"
    },
    {
        question: "Which is faster?",
        left: "Bullet Train",
        right: "Formula 1 Car"
    },
    {
        question: "Which has more letters in its alphabet?",
        left: "English",
        right: "Spanish"
    },
    {
        question: "Which is further south?",
        left: "Australia",
        right: "South Africa"
    },
    {
        question: "Which has more countries?",
        left: "Africa",
        right: "Asia"
    },
    {
        question: "Which is more expensive?",
        left: "Saffron",
        right: "Gold"
    },
    {
        question: "Which came first?",
        left: "The Bicycle",
        right: "The Train"
    },
    {
        question: "Which is larger?",
        left: "The Moon",
        right: "Pluto"
    },
    {
        question: "Which has more episodes?",
        left: "The Simpsons",
        right: "South Park"
    },
    {
        question: "Which is older?",
        left: "Rome",
        right: "Athens"
    },
    {
        question: "Which came first?",
        left: "The Telephone",
        right: "The Lightbulb"
    },
    {
        question: "Which is larger?",
        left: "The Sun",
        right: "Betelgeuse"
    },
    {
        question: "Which is faster?",
        left: "Cheetah",
        right: "Greyhound"
    },
    {
        question: "Which has more legs?",
        left: "Octopus",
        right: "Squid"
    },
    {
        question: "Which is more common in the earth's crust?",
        left: "Silicon",
        right: "Aluminum"
    },
    {
        question: "Which is older?",
        left: "Grand Canyon",
        right: "Mount Everest"
    },
    {
        question: "Which came first?",
        left: "Coca Cola",
        right: "Pepsi"
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
