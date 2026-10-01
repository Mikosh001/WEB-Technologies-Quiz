"use strict";

const $ = id => document.getElementById(id);
const topicNames = new Map(QUIZ_TOPICS.map(topic => [topic.id, topic]));
let session = null;

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chooseQuestions() {
  const chosenTopic = $("topic-select").value;
  const length = $("length-select").value;
  let ordered;
  if (chosenTopic === "all") {
    const groups = QUIZ_TOPICS.map(topic => shuffled(QUIZ_QUESTIONS.filter(q => q.topic === topic.id)));
    ordered = [];
    while (groups.some(group => group.length)) {
      for (const group of shuffled(groups)) {
        if (group.length) ordered.push(group.pop());
      }
    }
  } else {
    ordered = shuffled(QUIZ_QUESTIONS.filter(q => q.topic === chosenTopic));
  }
  return length === "all" ? ordered : ordered.slice(0, Number(length));
}

function makeBilingual(en, kk, enTag = "strong") {
  const wrap = document.createElement("span");
  const primary = document.createElement(enTag);
  primary.textContent = en;
  const secondary = document.createElement("small");
  secondary.lang = "kk";
  secondary.textContent = kk;
  wrap.append(primary, secondary);
  return wrap;
}

function show(view) {
  document.body.dataset.view = view;
  $("setup").hidden = view !== "setup";
  $("quiz").hidden = view !== "quiz";
  $("result").hidden = view !== "result";
  window.scrollTo({top: 0, behavior: "instant"});
}

function start(questions = chooseQuestions()) {
  session = {
    questions,
    answers: new Map(),
    index: 0,
    mode: $("mode-select").value
  };
  show("quiz");
  renderQuestion();
}

function renderQuestion() {
  const {questions, answers, index, mode} = session;
  const q = questions[index];
  const selected = answers.get(q.id);
  const locked = mode === "practice" && selected !== undefined;
  const topic = topicNames.get(q.topic);

  $("question-topic").textContent = topic.en === topic.kk ? topic.en : `${topic.en} · ${topic.kk}`;
  $("question-source").textContent = `Source / Дереккөз: ${q.source}`;
  $("question-en").textContent = q.en;
  $("question-kk").textContent = q.kk;
  $("progress-label").textContent = `${index + 1} / ${questions.length} · ${answers.size} answered / жауап берілді`;
  const progress = Math.round(answers.size / questions.length * 100);
  $("progressbar").setAttribute("aria-valuenow", String(progress));
  $("progress-fill").style.width = `${progress}%`;

  const choices = q.choices.map((choice, choiceIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer";
    button.disabled = locked;
    button.setAttribute("aria-pressed", String(selected === choiceIndex));
    if (selected === choiceIndex) button.classList.add("selected");
    if (locked && choiceIndex === q.answer) button.classList.add("correct");
    if (locked && selected === choiceIndex && selected !== q.answer) button.classList.add("incorrect");
    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = "ABCD"[choiceIndex];
    const copy = makeBilingual(choice.en, choice.kk);
    copy.className = "answer-copy";
    button.append(letter, copy);
    button.addEventListener("click", () => answer(choiceIndex));
    return button;
  });
  $("answers").replaceChildren(...choices);

  $("feedback").hidden = !locked;
  if (locked) {
    const correct = selected === q.answer;
    $("feedback").className = `feedback ${correct ? "correct" : "incorrect"}`;
    $("feedback-title").textContent = correct ? "Correct · Дұрыс" : "Not quite · Қате";
    $("feedback-en").textContent = q.whyEn;
    $("feedback-kk").textContent = q.whyKk;
  }

  $("prev-button").disabled = index === 0;
  $("next-button").disabled = mode === "practice" && selected === undefined;
  const isLast = index === questions.length - 1;
  $("next-button").replaceChildren(makeBilingual(isLast ? "Finish quiz" : "Next →", isLast ? "Аяқтау" : "Келесі"));
}

function answer(choiceIndex) {
  const q = session.questions[session.index];
  if (session.mode === "practice" && session.answers.has(q.id)) return;
  session.answers.set(q.id, choiceIndex);
  renderQuestion();
}

function move(delta) {
  const nextIndex = session.index + delta;
  if (nextIndex < 0 || nextIndex >= session.questions.length) return;
  session.index = nextIndex;
  renderQuestion();
}

function showResult() {
  const {questions, answers} = session;
  const mistakes = questions.filter(q => answers.get(q.id) !== q.answer);
  const correct = questions.length - mistakes.length;
  const percent = Math.round(correct / questions.length * 100);
  $("score-value").textContent = `${correct} / ${questions.length}`;
  $("score-percent").textContent = `${percent}%`;
  let message;
  if (percent === 100) message = ["Excellent! Every answer is correct.", "Керемет! Барлық жауап дұрыс."];
  else if (percent >= 80) message = ["Strong result. Review the remaining mistakes.", "Жақсы нәтиже. Қалған қателерді қайтала."];
  else message = ["Read the explanations, then try the missed questions again.", "Түсіндірмелерді оқып, қате сұрақтарды қайта орында."];
  $("result-message").textContent = message[0];
  $("result-message-kk").textContent = message[1];
  $("retry-wrong").hidden = mistakes.length === 0;
  $("review-count").textContent = `${mistakes.length} to review · ${mistakes.length} қайталау`;

  const cards = mistakes.map(q => {
    const selected = answers.get(q.id);
    const card = document.createElement("article");
    card.className = "review-card";
    const heading = document.createElement("h3");
    heading.textContent = q.en;
    const translation = document.createElement("p");
    translation.className = "translation";
    translation.lang = "kk";
    translation.textContent = q.kk;
    const chosen = document.createElement("p");
    chosen.className = "wrong";
    chosen.textContent = selected === undefined
      ? "Your answer: not answered · Жауап берілмеді"
      : `Your answer: ${q.choices[selected].en} · ${q.choices[selected].kk}`;
    const right = document.createElement("p");
    right.className = "right";
    right.textContent = `Correct answer: ${q.choices[q.answer].en} · ${q.choices[q.answer].kk}`;
    const explanation = document.createElement("p");
    explanation.className = "explanation";
    explanation.textContent = q.whyEn;
    const explanationKk = document.createElement("p");
    explanationKk.className = "translation";
    explanationKk.lang = "kk";
    explanationKk.textContent = q.whyKk;
    card.append(heading, translation, chosen, right, explanation, explanationKk);
    return card;
  });
  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No mistakes to review. · Қайталайтын қате жоқ.";
    cards.push(empty);
  }
  $("review-list").replaceChildren(...cards);
  show("result");
}

function init() {
  $("bank-count").textContent = String(QUIZ_QUESTIONS.length);
  const topicOptions = [
    {id: "all", en: "All topics", kk: "Барлығы", count: QUIZ_QUESTIONS.length},
    ...QUIZ_TOPICS.map(topic => ({...topic, count: QUIZ_QUESTIONS.filter(q => q.topic === topic.id).length}))
  ];
  $("topic-select").replaceChildren(...topicOptions.map(topic => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = `${topic.en === topic.kk ? topic.en : `${topic.en} · ${topic.kk}`} (${topic.count})`;
    return option;
  }));
  $("mode-select").addEventListener("change", () => {
    $("mode-hint").replaceChildren();
    if ($("mode-select").value === "practice") {
      $("mode-hint").append("Practice shows an explanation after each answer. ", makeHint("Жаттығу режимінде әр жауаптан кейін түсіндірме шығады."));
    } else {
      $("mode-hint").append("Exam shows answers after you finish. You may skip and revisit questions. ", makeHint("Емтихан режимінде жауаптар соңында көрінеді. Сұрақты өткізіп, кейін орала аласың."));
    }
  });
  $("start-button").addEventListener("click", () => start());
  $("back-to-setup").addEventListener("click", () => show("setup"));
  $("prev-button").addEventListener("click", () => move(-1));
  $("next-button").addEventListener("click", () => {
    if (session.index === session.questions.length - 1) showResult();
    else move(1);
  });
  $("new-quiz").addEventListener("click", () => show("setup"));
  $("retry-wrong").addEventListener("click", () => {
    const mistakes = session.questions.filter(q => session.answers.get(q.id) !== q.answer);
    if (mistakes.length) start(shuffled(mistakes));
  });
  document.addEventListener("keydown", event => {
    if ($("quiz").hidden || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const choice = Number(event.key) - 1;
    if (choice >= 0 && choice < 4) answer(choice);
  });
}

function makeHint(text) {
  const small = document.createElement("small");
  small.lang = "kk";
  small.textContent = text;
  return small;
}

init();
