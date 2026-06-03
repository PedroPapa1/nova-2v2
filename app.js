const STORAGE_KEY = "nova-2v2-admin-v3";
const isAdmin = document.body.dataset.mode === "admin";

const initialTeams = [
  "Brasil",
  "Argentina",
  "Alemanha",
  "Italia",
  "Inglaterra",
  "Franca",
  "Espanha",
  "Portugal",
  "Holanda",
  "Uruguai",
  "Mexico",
  "Belgica",
  "Croacia",
  "Marrocos",
  "Estados Unidos",
  "Japao",
  "Colombia",
  "Chile",
  "Polonia",
  "Dinamarca",
  "Suica",
  "Servia",
  "Suecia",
  "Noruega",
  "Turquia",
  "Coreia do Sul",
  "Camaroes",
  "Nigeria",
  "Egito",
  "Canada",
  "Australia",
  "Republica Tcheca",
];

const sideRoundNames = ["Primeira Fase", "Oitavas", "Quartas", "Semifinais"];
const sideMatchCounts = [8, 4, 2, 1];
const sideBestOf = [1, 1, 3, 3];
const sides = ["left", "right"];

let state;

const bracket = document.querySelector("#bracket");
const championName = document.querySelector("#championName");
const progressText = document.querySelector("#progressText");

boot();

async function boot() {
  state = await loadState();
  bindAdminActions();
  render();
}

function bindAdminActions() {
  if (!isAdmin) return;

  document.querySelector("#resetButton").addEventListener("click", () => {
    const confirmed = window.confirm("Resetar todos os placares e vencedores do Nova 2v2?");
    if (!confirmed) return;
    state = createState(initialTeams);
    saveState();
    render();
  });

  document.querySelector("#shuffleButton").addEventListener("click", () => {
    const confirmed = window.confirm("Embaralhar as selecoes e zerar o chaveamento?");
    if (!confirmed) return;
    state = createState(shuffle([...initialTeams]));
    saveState();
    render();
  });

  document.querySelector("#exportButton").addEventListener("click", () => {
    downloadJson(state, "data.json");
  });

  document.querySelector("#importFile").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;

    try {
      const nextState = JSON.parse(await file.text());
      validateState(nextState);
      state = nextState;
      saveState();
      render();
    } catch (error) {
      window.alert("Arquivo invalido para este chaveamento.");
    } finally {
      event.target.value = "";
    }
  });
}

async function loadState() {
  if (isAdmin) {
    const saved = readSavedState();
    if (saved) return saved;
  }

  try {
    const response = await fetch("./data.json", { cache: "no-store" });
    const data = await response.json();
    validateState(data);
    return data;
  } catch (error) {
    return createState(initialTeams);
  }
}

function readSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    validateState(saved);
    return saved;
  } catch (error) {
    return null;
  }
}

function createState(teams) {
  return {
    version: 3,
    title: "Nova 2v2",
    leftTeams: teams.slice(0, 16),
    rightTeams: teams.slice(16),
    sides: {
      left: createSideState(),
      right: createSideState(),
    },
    final: {
      bestOf: 5,
      score: [0, 0],
      winner: null,
    },
  };
}

function createSideState() {
  return {
    winners: sideMatchCounts.map((count) => Array(count).fill(null)),
    scores: sideMatchCounts.map((count) => Array.from({ length: count }, () => [0, 0])),
  };
}

function validateState(value) {
  if (!value || value.version !== 3) throw new Error("Invalid version");
  if (!Array.isArray(value.leftTeams) || value.leftTeams.length !== 16) throw new Error("Invalid left");
  if (!Array.isArray(value.rightTeams) || value.rightTeams.length !== 16) throw new Error("Invalid right");
  if (!value.sides || !value.final) throw new Error("Invalid bracket");

  sides.forEach((side) => {
    const sideState = value.sides[side];
    if (!sideState || !Array.isArray(sideState.winners) || !Array.isArray(sideState.scores)) {
      throw new Error("Invalid side");
    }

    sideMatchCounts.forEach((count, roundIndex) => {
      if (!Array.isArray(sideState.winners[roundIndex]) || sideState.winners[roundIndex].length !== count) {
        throw new Error("Invalid winners");
      }
      if (!Array.isArray(sideState.scores[roundIndex]) || sideState.scores[roundIndex].length !== count) {
        throw new Error("Invalid scores");
      }
    });
  });

  if (!Array.isArray(value.final.score) || value.final.score.length !== 2) {
    throw new Error("Invalid final score");
  }
}

function saveState() {
  if (isAdmin) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  bracket.replaceChildren(createSide("left"), createFinal(), createSide("right"));

  const champion = state.final.winner;
  championName.textContent = champion || "Aguardando final";
  const decided = sides.reduce((total, side) => total + state.sides[side].winners.flat().filter(Boolean).length, 0);
  const finalDecided = state.final.winner ? 1 : 0;
  progressText.textContent = `${decided + finalDecided} de 31 partidas definidas`;
  requestAnimationFrame(drawConnectors);
}

function createSide(side) {
  const sideElement = document.createElement("section");
  sideElement.className = `side side-${side}`;

  const order = side === "left" ? [0, 1, 2, 3] : [3, 2, 1, 0];
  order.forEach((roundIndex) => {
    const round = document.createElement("section");
    round.className = `round round-${roundIndex}`;
    round.dataset.round = roundIndex;

    const header = document.createElement("div");
    header.className = "round-header";
    header.textContent = `${sideRoundNames[roundIndex]} - MD${sideBestOf[roundIndex]}`;
    round.append(header);

    for (let matchIndex = 0; matchIndex < sideMatchCounts[roundIndex]; matchIndex += 1) {
      round.append(createMatch({ type: "side", side, roundIndex, matchIndex }));
    }

    sideElement.append(round);
  });

  return sideElement;
}

function createFinal() {
  const finalLane = document.createElement("section");
  finalLane.className = "final-lane";

  const title = document.createElement("div");
  title.className = "round-header final-header";
  title.textContent = "Grande Final - MD5";

  finalLane.append(title, createMatch({ type: "final" }));
  return finalLane;
}

function createMatch(context) {
  const template = document.querySelector("#matchTemplate");
  const match = template.content.firstElementChild.cloneNode(true);
  const teams = getMatchTeams(context);
  const winner = getWinner(context);
  const score = getScore(context);

  match.classList.toggle("final-match", context.type === "final");
  match.dataset.type = context.type;
  if (context.type === "side") {
    match.dataset.side = context.side;
    match.dataset.round = context.roundIndex;
    match.dataset.match = context.matchIndex;
  } else {
    match.dataset.side = "final";
    match.dataset.round = "final";
    match.dataset.match = "0";
  }
  match.querySelector(".match-title").textContent = getMatchTitle(context);

  [0, 1].forEach((slot) => {
    const row = match.querySelector(slot === 0 ? ".team-a" : ".team-b");
    row.append(createTeamButton(context, teams[slot], winner));
    row.append(createScoreControls(context, slot, teams[slot], score[slot]));
  });

  return match;
}

function drawConnectors() {
  bracket.querySelector(".connector-layer")?.remove();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("connector-layer");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  bracket.prepend(svg);

  const bounds = bracket.getBoundingClientRect();
  const paths = [];

  sides.forEach((side) => {
    for (let roundIndex = 0; roundIndex < sideMatchCounts.length - 1; roundIndex += 1) {
      for (let matchIndex = 0; matchIndex < sideMatchCounts[roundIndex]; matchIndex += 1) {
        const from = findMatch(side, roundIndex, matchIndex);
        const to = findMatch(side, roundIndex + 1, Math.floor(matchIndex / 2));
        if (from && to) paths.push(createPath(from, to, side, bounds));
      }
    }
  });

  const leftFinalist = findMatch("left", 3, 0);
  const rightFinalist = findMatch("right", 3, 0);
  const finalMatch = bracket.querySelector('.final-match[data-type="final"]');
  if (leftFinalist && finalMatch) paths.push(createPath(leftFinalist, finalMatch, "left", bounds));
  if (rightFinalist && finalMatch) paths.push(createPath(rightFinalist, finalMatch, "right", bounds));

  svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  svg.append(...paths);
}

function findMatch(side, roundIndex, matchIndex) {
  return bracket.querySelector(`.match[data-side="${side}"][data-round="${roundIndex}"][data-match="${matchIndex}"]`);
}

function createPath(fromElement, toElement, side, bounds) {
  const from = fromElement.getBoundingClientRect();
  const to = toElement.getBoundingClientRect();
  const fromX = side === "left" ? from.right - bounds.left : from.left - bounds.left;
  const toX = side === "left" ? to.left - bounds.left : to.right - bounds.left;
  const fromY = from.top + from.height / 2 - bounds.top;
  const toY = to.top + to.height / 2 - bounds.top;
  const midX = fromX + (toX - fromX) / 2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`);
  path.setAttribute("pathLength", "1");
  return path;
}

window.addEventListener("resize", () => {
  if (!state) return;
  requestAnimationFrame(drawConnectors);
});

function getMatchTitle(context) {
  if (context.type === "final") return "Final";
  return `Partida ${context.matchIndex + 1}`;
}

function getMatchTeams(context) {
  if (context.type === "final") {
    return [state.sides.left.winners[3][0], state.sides.right.winners[3][0]];
  }

  if (context.roundIndex === 0) {
    const teams = context.side === "left" ? state.leftTeams : state.rightTeams;
    return [teams[context.matchIndex * 2], teams[context.matchIndex * 2 + 1]];
  }

  const previous = state.sides[context.side].winners[context.roundIndex - 1];
  return [previous[context.matchIndex * 2], previous[context.matchIndex * 2 + 1]];
}

function getWinner(context) {
  if (context.type === "final") return state.final.winner;
  return state.sides[context.side].winners[context.roundIndex][context.matchIndex];
}

function getScore(context) {
  if (context.type === "final") return state.final.score;
  return state.sides[context.side].scores[context.roundIndex][context.matchIndex];
}

function getBestOf(context) {
  if (context.type === "final") return 5;
  return sideBestOf[context.roundIndex];
}

function winsNeeded(context) {
  return Math.ceil(getBestOf(context) / 2);
}

function createTeamButton(context, team, winner) {
  const button = document.createElement("button");
  button.className = "team";
  button.type = "button";
  button.disabled = !isAdmin || !team;
  button.innerHTML = team ? teamMarkup(team, winner === team) : emptyMarkup();
  button.classList.toggle("winner", Boolean(team && winner === team));
  button.classList.toggle("loser", Boolean(team && winner && winner !== team));

  if (isAdmin && team) {
    button.addEventListener("click", () => chooseWinner(context, team));
  }

  return button;
}

function createScoreControls(context, slot, team, value) {
  const controls = document.createElement("div");
  controls.className = "score-controls";

  if (!isAdmin) {
    const score = document.createElement("span");
    score.className = "score-value readonly";
    score.textContent = value;
    controls.append(score);
    return controls;
  }

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "score-button";
  minus.textContent = "-";
  minus.disabled = !team || value <= 0;
  minus.addEventListener("click", () => setScore(context, slot, value - 1));

  const score = document.createElement("span");
  score.className = "score-value";
  score.textContent = value;

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "score-button";
  plus.textContent = "+";
  plus.disabled = !team || value >= winsNeeded(context);
  plus.addEventListener("click", () => setScore(context, slot, value + 1));

  controls.append(minus, score, plus);
  return controls;
}

function chooseWinner(context, team) {
  const score = getScore(context);
  const teams = getMatchTeams(context);
  const slot = teams[0] === team ? 0 : 1;
  const otherSlot = slot === 0 ? 1 : 0;
  const needed = winsNeeded(context);

  score[slot] = needed;
  if (score[otherSlot] >= needed) score[otherSlot] = needed - 1;
  setWinner(context, team);
  saveState();
  render();
}

function setScore(context, slot, nextValue) {
  const score = getScore(context);
  const teams = getMatchTeams(context);
  const otherSlot = slot === 0 ? 1 : 0;
  const needed = winsNeeded(context);

  score[slot] = Math.max(0, Math.min(needed, nextValue));
  if (score[slot] === needed && score[otherSlot] >= needed) score[otherSlot] = needed - 1;

  if (score[0] === needed && teams[0]) {
    setWinner(context, teams[0]);
  } else if (score[1] === needed && teams[1]) {
    setWinner(context, teams[1]);
  } else {
    setWinner(context, null);
  }

  saveState();
  render();
}

function setWinner(context, winner) {
  if (context.type === "final") {
    state.final.winner = winner;
    return;
  }

  state.sides[context.side].winners[context.roundIndex][context.matchIndex] = winner;
  clearDownstream(context);
}

function clearDownstream(context) {
  const sideState = state.sides[context.side];
  let nextMatch = Math.floor(context.matchIndex / 2);

  for (let roundIndex = context.roundIndex + 1; roundIndex < sideState.winners.length; roundIndex += 1) {
    sideState.winners[roundIndex][nextMatch] = null;
    sideState.scores[roundIndex][nextMatch] = [0, 0];
    nextMatch = Math.floor(nextMatch / 2);
  }

  state.final.winner = null;
  state.final.score = [0, 0];
}

function teamMarkup(team, isWinner) {
  const badge = isWinner ? '<span class="winner-badge">OK</span>' : "";
  return `
    <span class="team-name">
      <span class="team-label">${team}</span>
    </span>
    ${badge}
  `;
}

function emptyMarkup() {
  return '<span class="team-name"><span class="team-label">Aguardando</span></span>';
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}
