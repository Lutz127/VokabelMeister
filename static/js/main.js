document.addEventListener("DOMContentLoaded", () => {

    const cards = document.querySelectorAll(".category-card");
    const quizContainer = document.getElementById("quiz-container");
    const home = document.querySelector(".home-content");

    fetch("/api/settings")
    .then(res => res.json())
    .then(s => {
        if (s.default_mode) quizMode = s.default_mode;
        updateModeButtons();
    });

    cards.forEach(card => {
        card.addEventListener("click", async () => {
            // Disable Failed Words card when empty
            if (card.dataset.disabled === "true") return;

            const category = card.dataset.category;

            // Failed Words mode
            if (category === "failed_words") {
                const response = await fetch("/api/failed_words");
                let failed = await response.json();

                // Convert DB rows → quiz format
                const words = failed.map(item => ({
                    german: item.german || "(unknown)",          // convert DB word → quiz german
                    english: item.english || "(missing)",      // convert DB english
                    gender: item.gender || null                // convert DB gender
                }));

                shuffle(words);
                home.classList.add("hidden");
                startQuiz(words, "failed_words");
                return;  // critical: stops normal category loader
            }

            // Load JSON data
            const response = await fetch(`/static/data/${category}.json`);
            const words = await response.json();

            // Shuffle the questions
            shuffle(words);

            // Hide homepage
            home.classList.add("hidden");

            startQuiz(words, category);
        });
    });

    // Mode button listeners
    const deButton = document.getElementById("mode-de-en");
    const enButton = document.getElementById("mode-en-de");

    if (deButton && enButton) {
        deButton.addEventListener("click", () => {
            quizMode = "de-to-en";
            updateModeButtons();

            // redraw current question if a quiz is running
            if (currentRedrawQuestion) currentRedrawQuestion();
        });

        enButton.addEventListener("click", () => {
            quizMode = "en-to-de";
            updateModeButtons();

            // redraw current question if a quiz is running
            if (currentRedrawQuestion) currentRedrawQuestion();
        });
    }
});

// Shuffles JSON file

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

let currentRedrawQuestion = null;  // holds the active showQuestion function
let quizMode = "de-to-en";  // default mode

function updateModeButtons() {
    const de = document.getElementById("mode-de-en");
    const en = document.getElementById("mode-en-de");
    if (!de || !en) return;

    if (quizMode === "de-to-en") {
        de.classList.add("bg-yellow-300", "text-black");
        de.classList.remove("bg-black/40", "text-white");

        en.classList.add("bg-black/40", "text-white");
        en.classList.remove("bg-yellow-300", "text-black");

    } else {
        en.classList.add("bg-yellow-300", "text-black");
        en.classList.remove("bg-black/40", "text-white");

        de.classList.add("bg-black/40", "text-white");
        de.classList.remove("bg-yellow-300", "text-black");
    }
}

function normalizeGerman(str) {
    return str
        .toLowerCase()
        .replace(/ä/g, "a")
        .replace(/ö/g, "o")
        .replace(/ü/g, "u")
        .replace(/ß/g, "ss")
}

function formatEnglishWithGender(item) {
    // If there's no gender field → just show the FIRST English synonym
    if (!item.gender) {
        return item.english.split("/")[0].trim();  
    }

    const first = item.english.split("/")[0].trim();
    const g = item.gender.toLowerCase();

    return `${first} (${g})`;
}


// Fake user progress until database is implemented
// Later this will be replaced with real DB values
const userProgress = JSON.parse(localStorage.getItem("userProgress")) || {
    a1_verbs: 0,
    a1_adjectives: 0,
    colors: 0,
    numbers: 0,
    time: 0,
    clothing: 0,
    family: 0,
    weather: 0,
    jobs: 0,
    test: 0
};

// Apply progress to homepage bars
function updateCategoryProgressBars() {
    for (const [category, percent] of Object.entries(userProgress)) {
        const outer = document.querySelector(`.progress-${category}`);
        const inner = outer?.querySelector('.progress-inner');
        if (!inner) continue;

        inner.style.width = percent + "%";

        let color = "#ff3b3b";
        if (percent < 20) color = "#ff3b3b";
        else if (percent < 40) color = "#f79046ff";
        else if (percent < 60) color = "#f7bf46ff";
        else if (percent < 80) color = "#daf746ff";
        else if (percent < 99) color = "#63de4aff";
        else if (percent >= 99) color = "#36ff54ff"; 

        inner.style.backgroundColor = color;

        // Glow only when > 99%
        if (percent >= 99) {
            outer.classList.add("pulse-glow");
        } else {
            outer.classList.remove("pulse-glow");
        }
    }
}

window.addEventListener("load", () => {
    updateCategoryProgressBars();
});


function returnHome() {

    // Only clear the dynamic quiz question area
    const quizContent = document.getElementById("quiz-content");
    if (quizContent) quizContent.innerHTML = "";

    // Reset timer & progress bar
    const timer = document.getElementById("live-timer");
    if (timer) timer.textContent = "Time: 0m 0.0s";

    const progressBar = document.getElementById("progress-bar");
    if (progressBar) progressBar.style.width = "0%";

    // Hide quiz wrapper (NOT deleting HTML)
    const quiz = document.getElementById("quiz-container");
    quiz.classList.add("hidden");

    // Show homepage
    const home = document.querySelector(".home-content");
    home.classList.remove("hidden");

    document.getElementById("live-timer").classList.remove("hidden");
    document.getElementById("progress-container").classList.remove("hidden");
    document.getElementById("mode-de-en").classList.remove("hidden");
    document.getElementById("mode-en-de").classList.remove("hidden");

    // Update progress bars after DOM reflow
    setTimeout(updateCategoryProgressBars, 50);
}

let activeTimers = [];

function clearAllQuizTimers() {
    for (const timer of activeTimers) clearInterval(timer);
    activeTimers = [];
}

const pulseStyle = document.createElement("style");
pulseStyle.textContent = `
@keyframes pulseGlow {
    0% {
        box-shadow:
            0 0 8px rgba(0,255,0,0.25),
            0 0 16px rgba(0,255,0,0.25),
            0 0 24px rgba(0,255,0,0.25);
    }
    50% {
        box-shadow:
            0 0 14px rgba(0,255,0,0.4),
            0 0 28px rgba(0,255,0,0.4),
            0 0 42px rgba(0,255,0,0.4);
    }
    100% {
        box-shadow:
            0 0 8px rgba(0,255,0,0.25),
            0 0 16px rgba(0,255,0,0.25),
            0 0 24px rgba(0,255,0,0.25);
    }
}
.pulse-glow {
    animation: pulseGlow 1.6s ease-in-out infinite;
}
`;
document.head.appendChild(pulseStyle);



// Quiz logic
function startQuiz(words, category) {

    // FULL RESET
    currentRedrawQuestion = null;  // clear previous redraw function
    clearAllQuizTimers();          // stop leftover timers


    const quizContainer = document.getElementById("quiz-container");
    quizContainer.classList.remove("hidden");
    document.getElementById("progress-bar").style.width = "0%";

    let index = 0;
    let score = 0;
    let startTime = Date.now();
    let timerInterval = setInterval(updateTimer, 100);
    activeTimers.push(timerInterval);

    // Reset UI
    document.getElementById("quiz-content").innerHTML = "";
    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("live-timer").textContent = "Time: 0m 0.0s";

    function showQuestion() {
        const item = words[index];

        const displayGerman = item.german.split("/").map(s => s.trim())[0];

        document.getElementById("quiz-content").innerHTML = `
            <div class="bg-black/60 p-6 rounded-xl shadow text-center mb-4">
                <p class="text-white text-xl mb-2">
                    ${quizMode === "de-to-en" ? "What is the meaning of:" : "Was bedeutet:"}
                </p>

                <p class="text-yellow-300 text-3xl font-bold">
                    ${quizMode === "de-to-en"
                        ? item.german.split("/")[0].trim()   // ONLY FIRST FORM
                        : formatEnglishWithGender(item)
                    }
                </p>

            </div>

            <input id="answer-input"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                class="w-full p-4 rounded-xl bg-black/60 text-yellow-300 font-bold text-2xl shadow-inner 
                        placeholder:text-yellow-500/40 outline-none focus:ring-2 focus:ring-yellow-300 text-center caret-transparent"
                placeholder="${quizMode === 'de-to-en' ? 'Type the English meaning...' : 'Type the German meaning...'}">

            <p id="feedback" class="text-lg mt-4"></p>
        `;

        document.getElementById("answer-input").focus();

        const answerInput = document.getElementById("answer-input");
        answerInput.disabled = false;

        let lastTypeTime = 0;

        answerInput.addEventListener("input", () => {
            const now = Date.now();

            // Remove this delay entirely or increase it slightly
            if (now - lastTypeTime > 2) {

                // Instead of reusing the same <audio>, CLONE it
                const original = document.getElementById("type-sound");
                const clone = original.cloneNode(true);

                clone.volume = original.volume;   // keep same volume
                if (window.userSettings?.sound) {
                    clone.play();
                }
                lastTypeTime = now;
                setTimeout(() => clone.remove(), 200);
            }
        });

        document.getElementById("answer-input").addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                checkAnswer();
            }
        });

        updateProgressBar();
    }

    currentRedrawQuestion = showQuestion;

    function checkAnswer() {

        const answer = document.getElementById("answer-input");

        if (answer.value.trim() === "") {
            answer.focus();
            return;
        }

        answer.disabled = true;

        let userInput = answer.value.trim().toLowerCase();

        // Choose correct answer depending on mode
        let correctRaw = (
            quizMode === "de-to-en"
                ? words[index].english.toLowerCase()
                : words[index].german.toLowerCase()
        );

        // Normalize correct answers
        userInput = userInput.replace(/^to\s+/, "");
        correctRaw = correctRaw.replace(/to\s+/g, "");
        let correctList = correctRaw.split("/").map(s => s.trim());

        let isCorrect;
        const articleStrict = window.userSettings?.strict === true;

        if (quizMode === "en-to-de") {

            let germanForms = correctList; // already split

            if (articleStrict) {
                // strict: full match including article
                const normalizedUser = normalizeGerman(userInput);
                const normalizedCorrect = germanForms.map(c =>
                    normalizeGerman(c)
                );
                isCorrect = normalizedCorrect.includes(normalizedUser);

            } else {
                // non-strict: strip articles + normalize
                const stripArticle = word =>
                    word.replace(/^(der|die|das)\s+/i, "");

                const normalizedUser = normalizeGerman(
                    stripArticle(
                        userInput.replace(/\(.*?\)/g, "")
                    )
                );

                const normalizedCorrect = germanForms.map(c =>
                    normalizeGerman(
                        stripArticle(
                            c.replace(/\(.*?\)/g, "")
                        )
                    )
                );

                isCorrect = normalizedCorrect.includes(normalizedUser);
            }
        } else {
            isCorrect = correctList.includes(userInput);
        }

        // Apply styling + sounds
        if (isCorrect) {
            answer.style.color = "#36ff54ff";
            answer.style.caretColor = "#36ff54ff";
            answer.style.boxShadow = "0 0 0 2px #36ff54ff inset";
            if (window.userSettings?.sound) {
                document.getElementById("correct-sound").play();
            }
            score++;
        } else {
            answer.style.color = "#ff1515ff";
            answer.style.caretColor = "#ff1515ff";
            answer.style.boxShadow = "0 0 0 2px #ff1515ff inset";
            if (window.userSettings?.sound) {
                document.getElementById("wrong-sound").play();
            }
            answer.value = correctList[0];

            // Save failed word to backend
            fetch("/save_failure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: category,
                    word: words[index].german,
                    english: words[index].english,
                    gender: words[index].gender || null
                })
            });
        }

        index++;

        let delay;

        if (window.userSettings && window.userSettings.speedrun === true) {
            delay = 0;  // Instant transition
        } else {
            delay = isCorrect ? 1000 : 3000;
        }

        if (index < words.length) {
            if (delay === 0) {
                showQuestion();
            } else {
                setTimeout(showQuestion, delay);
            }
        } else {
            if (delay === 0) {
                showResults();
            } else {
                setTimeout(showResults, delay);
            }
            clearInterval(timerInterval);
        }
    }


    function updateTimer() {
        let now = Date.now();
        let elapsed = (now - startTime) / 1000; // seconds

        let minutes = Math.floor(elapsed / 60);
        let seconds = (elapsed % 60).toFixed(2); // keep decimals properly

        let timerDisplay = document.getElementById("live-timer");
        if (timerDisplay) {
            timerDisplay.textContent = `Time: ${minutes}m ${seconds}s`;
        }
    }

    function updateProgressBar() {
        const progress = (index / words.length) * 100;
        document.getElementById("progress-bar").style.width = `${progress}%`;
    }

function showResults() {

    let endTime = Date.now();
    let totalTime = (endTime - startTime) / 1000; // full decimal precision
    totalTime = Number(totalTime.toFixed(2));     // keep 2 decimals
    let minutes = Math.floor(totalTime / 60);
    let seconds = (totalTime % 60).toFixed(2);

    // Save progress (percentage correct)
    const percent = Math.floor((score / words.length) * 100);
    userProgress[category] = percent;

    // Store in localStorage
    localStorage.setItem("userProgress", JSON.stringify(userProgress));

    // Send the score + time to the backend
    fetch("/save_score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            category: category,
            score: score,
            time: totalTime
        })
    });

    // Save leaderboard entry
    fetch("/save_leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            category: category,
            score: score,
            time: totalTime
        })
    });


    document.getElementById("live-timer").classList.add("hidden");
    document.getElementById("progress-container").classList.add("hidden");
    document.getElementById("mode-de-en").classList.add("hidden");
    document.getElementById("mode-en-de").classList.add("hidden");


    let leaderboardHTML = "";

    if (category !== "failed_words") {
        leaderboardHTML = `
            <h3 class="text-white text-2xl font-bold mt-6">Leaderboard</h3>
            <div id="leaderboard" class="bg-black/40 rounded-xl p-4 w-full max-w-md text-white text-center">
                <p class="text-white/60">Loading...</p>
            </div>
        `;
    }

    document.getElementById("quiz-content").innerHTML = `
        <div class="flex flex-col items-center gap-2">
            <h2 class="text-6xl font-bold text-white text-center">Finished!</h2>
            <p class="text-white text-center text-xl">Your score: <b>${score}/${words.length}</b></p>
            <p class="text-white text-center text-lg">Time: <b>${minutes}m ${seconds}s</b></p>

            ${leaderboardHTML}

            <button id="return-home"
                class="mt-6 bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-500 transition">
                Back to Home
            </button>
        </div>
    `;


    fetch(`/api/leaderboard/${category}`)
    .then(res => res.json())
    .then(rows => {
        const div = document.getElementById("leaderboard");

        if (rows.length === 0) {
            div.innerHTML = "<p class='text-white/60'>No scores yet. Be the first!</p>";
            return;
        }

        div.innerHTML = rows.map((r, i) => `
            <div class="flex justify-between py-1">
                <span class="text-yellow-300">${i + 1}.</span>
                <span>${r.username}</span>
                <span>${r.time.toFixed(2)}s</span>
            </div>
        `).join("");
    });

    document.getElementById("return-home").addEventListener("click", returnHome);
}
    showQuestion();
}