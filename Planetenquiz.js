// Dynamische Quizdaten aus quizData.json mit Mehrsprachigkeit
let quizData;
let currentLang = 'de';
let globalJokerUsed = false;
let draggedElement = null;

// localStorage ist bei file://-Aufrufen nicht in jedem Browser verfuegbar
function readStoredLang() {
    try {
        return localStorage.getItem('quiz_lang');
    } catch (e) {
        return null;
    }
}

function storeLang(lang) {
    try {
        localStorage.setItem('quiz_lang', lang);
    } catch (e) {
        /* ohne Speicher laeuft das Quiz trotzdem */
    }
}

function detectInitialLang() {
    const saved = readStoredLang();
    if (saved === 'de' || saved === 'en') return saved;
    const nav = (navigator.language || 'de').toLowerCase();
    return nav.startsWith('de') ? 'de' : 'en';
}

// In der Offline-Einzeldatei stecken die Quizdaten direkt im Dokument,
// weil fetch() auf file:// von der Same-Origin-Policy blockiert wird.
function loadQuizData() {
    const embedded = document.getElementById('quizDataEmbedded');
    if (embedded) {
        return Promise.resolve(JSON.parse(embedded.textContent));
    }
    return fetch('quizData.json').then(response => response.json());
}

function setLang(lang) {
    currentLang = (lang === 'en') ? 'en' : 'de';
    storeLang(currentLang);
    document.documentElement.setAttribute('lang', currentLang);
    // Reset states that depend on language rendering
    globalJokerUsed = false;
    // Re-render
    if (quizData) {
        applyLanguageToStaticUI();
        renderQuiz();
        initDragAndDrop();
    }
}

function applyLanguageToStaticUI() {
    const titleEl = document.getElementById('titleText');
    if (titleEl && quizData?.ui?.title) titleEl.textContent = quizData.ui.title[currentLang] || quizData.ui.title['de'];
    const evalBtn = document.getElementById('evaluateBtn');
    if (evalBtn && quizData?.ui?.submitButtonLabel) evalBtn.value = quizData.ui.submitButtonLabel[currentLang] || quizData.ui.submitButtonLabel['de'];
}

document.addEventListener('DOMContentLoaded', function() {
    currentLang = detectInitialLang();
    document.documentElement.setAttribute('lang', currentLang);
    const sel = document.getElementById('langSelect');
    if (sel) {
        sel.value = currentLang;
        sel.addEventListener('change', (e) => setLang(e.target.value));
    }
    loadQuizData()
        .then(data => {
            quizData = data;
            applyLanguageToStaticUI();
            renderQuiz();
            initDragAndDrop();
        });
});

// Baut eine einzelne Frage inklusive Joker-Button.
// jokerNr bleibt ueber beide Gruppen hinweg fortlaufend, weil useFiftyFifty()
// die Buttons ueber 'joker1'...'jokerN' wieder einsammelt.
function renderQuestion(q, jokerNr) {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'text-box';
    questionDiv.innerHTML = `<div class="question"><h2>${q.question[currentLang]}</h2>` +
        q.answers[currentLang].map((a, i) => `
                <label class="option">
                    <input type="radio" name="${q.id}" value="${i}" id="${q.id}${String.fromCharCode(97+i)}"> ${String.fromCharCode(97+i)}) ${a}
                </label>`).join('') +
        `</div>
            <button type="button" class="joker-button" onclick="useFiftyFifty('${q.id}', 'joker${jokerNr}')" id="joker${jokerNr}">${quizData.ui.jokerButtonLabel[currentLang]}</button>`;
    return questionDiv;
}

// Ueberschrift ueber einem Frageblock; fehlt der Text in quizData, entfaellt sie.
function renderSectionHeading(key) {
    const label = quizData.ui?.sections?.[key]?.[currentLang];
    if (!label) return null;
    const box = document.createElement('div');
    box.className = 'text-box section-heading';
    box.innerHTML = `<h2>${label}</h2>`;
    return box;
}

// Fragen ohne group gelten als allgemein, damit aeltere quizData.json weiter laufen.
function questionsOf(group) {
    return quizData.questions.filter(q => (q.group || 'general') === group);
}

function renderQuiz() {
    // Reihenfolge im Formular: allgemeine Fragen -> Sortieraufgabe -> Planetenfragen
    const order = ['general', 'planets'];
    const targets = {
        general: document.getElementById('quizContentGeneral'),
        planets: document.getElementById('quizContentPlanets'),
    };
    let jokerNr = 0;

    order.forEach(group => {
        const target = targets[group];
        target.innerHTML = '';
        const questions = questionsOf(group);
        if (questions.length === 0) return;

        const heading = renderSectionHeading(group);
        if (heading) target.appendChild(heading);
        questions.forEach(q => target.appendChild(renderQuestion(q, ++jokerNr)));
    });

    // Drag & Drop
    const dragDropContent = document.getElementById('dragDropContent');
    dragDropContent.innerHTML = `<div class="text-box"><h2>${quizData.dragDrop.title[currentLang]}</h2><p class="instruction">${quizData.dragDrop.instruction[currentLang]}</p><div id="planetButtons" class="planet-buttons-container"></div><div id="dropZones" class="drop-zones-container"></div></div>`;
    const planetButtonsContainer = document.getElementById('planetButtons');
    quizData.dragDrop.planets[currentLang].forEach(planet => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'planet-button';
        btn.draggable = true;
        btn.setAttribute('data-planet', planet);
        btn.textContent = planet;
        planetButtonsContainer.appendChild(btn);
    });
    const dropZonesContainer = document.getElementById('dropZones');
    for (let i = 1; i <= quizData.dragDrop.planets[currentLang].length; i++) {
        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.setAttribute('data-position', i);
        zone.innerHTML = `<span class="position-number">${i}.</span><input type="text" id="Text${i}" name="planetName${i}" readonly>`;
        dropZonesContainer.appendChild(zone);
    }
}

function initDragAndDrop() {
    const planetButtons = document.querySelectorAll('.planet-button');
    const dropZones = document.querySelectorAll('.drop-zone');

    // Drag-Events für Planeten-Buttons
    planetButtons.forEach(button => {
        button.addEventListener('dragstart', handleDragStart);
        button.addEventListener('dragend', handleDragEnd);
    });

    // Drop-Events für Drop-Zonen
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragenter', handleDragEnter);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();

    this.classList.remove('drag-over');

    if (draggedElement) {
        const planetName = draggedElement.getAttribute('data-planet');
        const input = this.querySelector('input[type="text"]');
        
        if (input) {
            // Prüfe ob das Feld bereits einen Wert hat
            const existingValue = input.value;
            
            if (existingValue && existingValue !== '') {
                // Erstelle einen neuen Button für den vorherigen Planet und füge ihn zurück
                const planetButtonsContainer = document.getElementById('planetButtons');
                const newButton = document.createElement('button');
                newButton.type = 'button';
                newButton.className = 'planet-button';
                newButton.draggable = true;
                newButton.setAttribute('data-planet', existingValue);
                newButton.textContent = existingValue;
                
                // Füge Event-Listener hinzu
                newButton.addEventListener('dragstart', handleDragStart);
                newButton.addEventListener('dragend', handleDragEnd);
                
                // Füge den Button zurück zum Container
                planetButtonsContainer.appendChild(newButton);
            }
            
            // Setze den neuen Wert
            input.value = planetName;
        }

        // Entferne den gezogenen Button aus der Liste
        draggedElement.remove();
    }

    return false;
}

function useFiftyFifty(question, buttonId) {
    if (globalJokerUsed) {
        alert(quizData.questions.find(q => q.id === question).jokerText[currentLang]);
        return;
    }
    globalJokerUsed = true;
    let options = document.getElementsByName(question);
    let correctIdx = quizData.questions.find(q => q.id === question).correct;
    let wrongOptions = [];
    options.forEach(option => {
        if (parseInt(option.value) !== correctIdx) {
            wrongOptions.push(option);
        }
    });
    if (wrongOptions.length >= 2) {
        let shuffled = wrongOptions.sort(() => 0.5 - Math.random());
        shuffled[0].parentElement.style.opacity = '0.3';
        shuffled[1].parentElement.style.opacity = '0.3';
        shuffled[0].parentElement.style.pointerEvents = 'none';
        shuffled[1].parentElement.style.pointerEvents = 'none';
        shuffled[0].disabled = true;
        shuffled[1].disabled = true;
    }
    for (let i = 1; i <= quizData.questions.length; i++) {
        let jokerButton = document.getElementById('joker' + i);
        if (jokerButton) {
            jokerButton.disabled = true;
            jokerButton.textContent = quizData.ui.jokerUsedText[currentLang];
        }
    }
}

// Jede Frage zaehlt 2 Punkte, jede richtige Planetenposition 1 - mal 5 als Endwert.
function maxScore() {
    return 5 * (2 * quizData.questions.length + quizData.dragDrop.correctOrder[currentLang].length);
}

// Passenden Spruch zur erreichten Punktzahl suchen (Stufen absteigend sortiert).
function feedbackFor(score, max) {
    if (!Array.isArray(quizData.feedback) || max === 0) return '';
    const percent = (score / max) * 100;
    const tier = [...quizData.feedback]
        .sort((a, b) => b.minPercent - a.minPercent)
        .find(f => percent >= f.minPercent);
    return tier ? (tier[currentLang] || tier['de'] || '') : '';
}

function checkAnswers() {
    const antwort = document.getElementById("antwort");
    let unanswered = quizData.questions.filter(q => !document.querySelector(`input[name='${q.id}']:checked`));
    if (unanswered.length > 0) {
        antwort.innerHTML = quizData.resultTexts[currentLang][1];
        return;
    }
    antwort.innerHTML = '';
    let score = 0;
    quizData.questions.forEach(q => {
        let answer = document.querySelector(`input[name='${q.id}']:checked`);
        if (answer !== null && parseInt(answer.value) === q.correct) {
            score += 2;
            answer.parentElement.style.color = "green";
        } else if (answer !== null) {
            answer.parentElement.style.color = "red";
            document.querySelector(`input[name='${q.id}'][value='${q.correct}']`).parentElement.style.color = "green";
        }
    });
    // Drag & Drop
    quizData.dragDrop.correctOrder[currentLang].forEach((planet, idx) => {
        let input = document.getElementById(`Text${idx+1}`);
        if (input.value === planet) {
            score++;
            input.classList.add('correct-answer');
        } else {
            input.classList.add('incorrect-answer');
        }
    });
    let Newscore = 5 * score;
    let max = maxScore();
    let result = document.getElementById('result');
    const summary = quizData.resultTexts[currentLang][0]
        .replace('{score}', Newscore)
        .replace('{maxScore}', max)
        .replace('{restartUrl}', window.location.href);
    const praise = feedbackFor(Newscore, max);
    result.innerHTML = `<p class="result-score">${summary}</p>` +
        (praise ? `<p class="result-feedback">${praise}</p>` : '');
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


