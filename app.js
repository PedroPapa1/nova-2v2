const STORAGE_KEY = "nova-2v2-admin-v3";
const isAdmin = document.body.dataset.mode === "admin";

const initialTeams = [
  "Brasil",
  "Argentina",
  "Alemanha",
  "Itália",
  "Inglaterra",
  "França",
  "Espanha",
  "Portugal",
  "Holanda",
  "Uruguai",
  "México",
  "Bélgica",
  "Croácia",
  "Marrocos",
  "Estados Unidos",
  "Japão",
  "Colômbia",
  "Chile",
  "Polônia",
  "Dinamarca",
  "Suíça",
  "Sérvia",
  "Suécia",
  "Noruega",
  "Turquia",
  "Coreia do Sul",
  "Camarões",
  "Nigéria",
  "Egito",
  "Canadá",
  "Austrália",
  "República Tcheca",
];

const sideRoundNames = ["Primeira Fase", "Oitavas", "Quartas", "Semifinais"];
const sideMatchCounts = [8, 4, 2, 1];
const sideBestOf = [1, 1, 3, 3];
const sides = ["left", "right"];
const accentMap = {
  Italia: "Itália",
  Franca: "França",
  Mexico: "México",
  Belgica: "Bélgica",
  Croacia: "Croácia",
  Japao: "Japão",
  Colombia: "Colômbia",
  Polonia: "Polônia",
  Suica: "Suíça",
  Servia: "Sérvia",
  Suecia: "Suécia",
  Camaroes: "Camarões",
  Nigeria: "Nigéria",
  Canada: "Canadá",
  Australia: "Austrália",
  "Republica Tcheca": "República Tcheca",
};

let state;

const bracket = document.querySelector("#bracket");
const championName = document.querySelector("#championName");
const progressText = document.querySelector("#progressText");
const championPanel = document.querySelector(".champion-panel");

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
    const confirmed = window.confirm("Embaralhar as seleções e zerar o chaveamento?");
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
      const nextState = normalizeState(upgradeState(JSON.parse(await file.text())));
      validateState(nextState);
      state = nextState;
      saveState();
      render();
    } catch (error) {
      window.alert("Arquivo inválido para este chaveamento.");
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
    const data = upgradeState(await response.json());
    validateState(data);
    return normalizeState(data);
  } catch (error) {
    return createState(initialTeams);
  }
}

function readSavedState() {
  try {
    const saved = upgradeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    validateState(saved);
    return normalizeState(saved);
  } catch (error) {
    return null;
  }
}

function upgradeState(value) {
  if (value && value.version === 3 && !value.bronze) {
    value.bronze = {
      bestOf: 5,
      score: [0, 0],
      winner: null,
    };
  }
  if (value?.bronze) value.bronze.bestOf = 5;
  return value;
}

function normalizeState(value) {
  value.leftTeams = value.leftTeams.map(normalizeTeamName);
  value.rightTeams = value.rightTeams.map(normalizeTeamName);
  sides.forEach((side) => {
    value.sides[side].winners = value.sides[side].winners.map((round) => round.map(normalizeTeamName));
  });
  value.final.winner = normalizeTeamName(value.final.winner);
  value.bronze.winner = normalizeTeamName(value.bronze.winner);
  return value;
}

function normalizeTeamName(team) {
  if (!team) return team;
  return accentMap[team] || team;
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
    bronze: {
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
  if (!value.sides || !value.final || !value.bronze) throw new Error("Invalid bracket");

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
  if (!Array.isArray(value.bronze.score) || value.bronze.score.length !== 2) {
    throw new Error("Invalid bronze score");
  }
}

function saveState() {
  if (isAdmin) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  bracket.replaceChildren(createSide("left"), createFinal(), createSide("right"));

  const champion = state.final.winner;
  championName.textContent = champion || "Aguardando final";
  championPanel.classList.toggle("has-champion", Boolean(champion));
  const decided = sides.reduce((total, side) => total + state.sides[side].winners.flat().filter(Boolean).length, 0);
  const finalDecided = state.final.winner ? 1 : 0;
  const bronzeDecided = state.bronze.winner ? 1 : 0;
  progressText.textContent = `${decided + finalDecided + bronzeDecided} de 32 partidas definidas`;
  requestAnimationFrame(syncBracketLayout);
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

  finalLane.append(
    createCenterMatch("Grande Final - MD5", { type: "final" }, "final-header"),
    createCenterMatch("3º e 4º Lugar - MD5", { type: "bronze" }, "placement-header"),
  );
  return finalLane;
}

function createCenterMatch(titleText, context, headerClass) {
  const block = document.createElement("section");
  block.className = "center-match-block";

  const title = document.createElement("div");
  title.className = `round-header ${headerClass}`;
  title.textContent = titleText;

  block.append(title, createMatch(context));
  return block;
}

function createMatch(context) {
  const template = document.querySelector("#matchTemplate");
  const match = template.content.firstElementChild.cloneNode(true);
  const teams = getMatchTeams(context);
  const winner = getWinner(context);
  const score = getScore(context);
  const homeTeam = getHomeTeam(context, teams);

  match.classList.toggle("final-match", context.type === "final");
  match.classList.toggle("bronze-match", context.type === "bronze");
  match.dataset.type = context.type;
  if (context.type === "side") {
    match.dataset.side = context.side;
    match.dataset.round = context.roundIndex;
    match.dataset.match = context.matchIndex;
  } else {
    match.dataset.side = context.type;
    match.dataset.round = context.type;
    match.dataset.match = "0";
  }
  match.querySelector(".match-title").textContent = getMatchTitle(context);

  [0, 1].forEach((slot) => {
    const row = match.querySelector(slot === 0 ? ".team-a" : ".team-b");
    row.append(createTeamButton(context, teams[slot], winner, homeTeam));
    row.append(createScoreControls(context, slot, teams[slot], score[slot], winner));
  });

  return match;
}

function syncBracketLayout() {
  positionRoundHeaders();
  drawConnectors();
}

function positionRoundHeaders() {
  bracket.querySelectorAll(".round, .center-match-block").forEach((column) => {
    const header = column.querySelector(".round-header");
    const firstMatch = column.querySelector(".match");
    if (!header || !firstMatch) return;

    const top = firstMatch.offsetTop - header.offsetHeight - 7;
    header.style.top = `${Math.max(0, top)}px`;
  });
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
  const bronzeMatch = bracket.querySelector('.bronze-match[data-type="bronze"]');
  if (leftFinalist && finalMatch) paths.push(createPath(leftFinalist, finalMatch, "left", bounds));
  if (rightFinalist && finalMatch) paths.push(createPath(rightFinalist, finalMatch, "right", bounds));
  if (leftFinalist && bronzeMatch) paths.push(createPath(leftFinalist, bronzeMatch, "left", bounds));
  if (rightFinalist && bronzeMatch) paths.push(createPath(rightFinalist, bronzeMatch, "right", bounds));

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
  requestAnimationFrame(syncBracketLayout);
});

function getMatchTitle(context) {
  if (context.type === "final") return "Final";
  if (context.type === "bronze") return "Disputa de 3º lugar";
  return `Partida ${context.matchIndex + 1}`;
}

function getMatchTeams(context) {
  if (context.type === "final") {
    return [state.sides.left.winners[3][0], state.sides.right.winners[3][0]];
  }
  if (context.type === "bronze") {
    return [getSemifinalLoser("left"), getSemifinalLoser("right")];
  }

  if (context.roundIndex === 0) {
    const teams = context.side === "left" ? state.leftTeams : state.rightTeams;
    return [teams[context.matchIndex * 2], teams[context.matchIndex * 2 + 1]];
  }

  const previous = state.sides[context.side].winners[context.roundIndex - 1];
  return [previous[context.matchIndex * 2], previous[context.matchIndex * 2 + 1]];
}

function getSemifinalLoser(side) {
  const teams = getSideMatchTeams(side, 3, 0);
  const winner = state.sides[side].winners[3][0];
  if (!winner || !teams[0] || !teams[1]) return null;
  return teams[0] === winner ? teams[1] : teams[0];
}

function getHomeTeam(context, teams) {
  const [firstTeam, secondTeam] = teams;
  if (!firstTeam || !secondTeam) return null;

  const first = getHomePerformance(context, firstTeam);
  const second = getHomePerformance(context, secondTeam);

  if (first.previousMargin !== second.previousMargin) {
    return first.previousMargin > second.previousMargin ? firstTeam : secondTeam;
  }

  if (first.totalBalance !== second.totalBalance) {
    return first.totalBalance > second.totalBalance ? firstTeam : secondTeam;
  }

  return firstTeam.localeCompare(secondTeam, "pt-BR", { sensitivity: "base" }) <= 0 ? firstTeam : secondTeam;
}

function getHomePerformance(context, team) {
  const side = getPerformanceSide(context, team);
  const isCenterMatch = context.type === "final" || context.type === "bronze";
  const previousRound = isCenterMatch ? 3 : context.roundIndex - 1;
  const beforeRound = isCenterMatch ? sideMatchCounts.length : context.roundIndex;

  if (!side || previousRound < 0) {
    return { previousMargin: 0, totalBalance: 0 };
  }

  return {
    previousMargin: getTeamMarginInRound(side, previousRound, team),
    totalBalance: getTeamBalanceBeforeRound(side, beforeRound, team),
  };
}

function getPerformanceSide(context, team) {
  if (context.type === "side") return context.side;
  if (state.leftTeams.includes(team) || state.sides.left.winners.flat().includes(team)) return "left";
  if (state.rightTeams.includes(team) || state.sides.right.winners.flat().includes(team)) return "right";
  return null;
}

function getTeamMarginInRound(side, roundIndex, team) {
  for (let matchIndex = 0; matchIndex < sideMatchCounts[roundIndex]; matchIndex += 1) {
    const teams = getSideMatchTeams(side, roundIndex, matchIndex);
    const slot = teams.indexOf(team);
    if (slot === -1) continue;

    const score = state.sides[side].scores[roundIndex][matchIndex];
    return score[slot] - score[slot === 0 ? 1 : 0];
  }

  return 0;
}

function getTeamBalanceBeforeRound(side, beforeRound, team) {
  let balance = 0;

  for (let roundIndex = 0; roundIndex < beforeRound; roundIndex += 1) {
    for (let matchIndex = 0; matchIndex < sideMatchCounts[roundIndex]; matchIndex += 1) {
      const teams = getSideMatchTeams(side, roundIndex, matchIndex);
      const slot = teams.indexOf(team);
      if (slot === -1) continue;

      const score = state.sides[side].scores[roundIndex][matchIndex];
      balance += score[slot] - score[slot === 0 ? 1 : 0];
    }
  }

  return balance;
}

function getSideMatchTeams(side, roundIndex, matchIndex) {
  if (roundIndex === 0) {
    const teams = side === "left" ? state.leftTeams : state.rightTeams;
    return [teams[matchIndex * 2], teams[matchIndex * 2 + 1]];
  }

  const previous = state.sides[side].winners[roundIndex - 1];
  return [previous[matchIndex * 2], previous[matchIndex * 2 + 1]];
}

function getWinner(context) {
  if (context.type === "final") return state.final.winner;
  if (context.type === "bronze") return state.bronze.winner;
  return state.sides[context.side].winners[context.roundIndex][context.matchIndex];
}

function getScore(context) {
  if (context.type === "final") return state.final.score;
  if (context.type === "bronze") return state.bronze.score;
  return state.sides[context.side].scores[context.roundIndex][context.matchIndex];
}

function getBestOf(context) {
  if (context.type === "final") return 5;
  if (context.type === "bronze") return 5;
  return sideBestOf[context.roundIndex];
}

function winsNeeded(context) {
  return Math.ceil(getBestOf(context) / 2);
}

function createTeamButton(context, team, winner, homeTeam) {
  const button = document.createElement("button");
  button.className = "team";
  button.type = "button";
  button.disabled = !isAdmin || !team;
  button.innerHTML = team ? teamMarkup(team, winner === team, homeTeam === team) : emptyMarkup();
  button.classList.toggle("winner", Boolean(team && winner === team));
  button.classList.toggle("loser", Boolean(team && winner && winner !== team));
  button.classList.toggle("home-team", Boolean(team && homeTeam === team));

  if (isAdmin && team) {
    button.addEventListener("click", () => chooseWinner(context, team));
  }

  return button;
}

function createScoreControls(context, slot, team, value, winner) {
  const controls = document.createElement("div");
  controls.className = "score-controls";
  controls.classList.toggle("score-winner", Boolean(team && winner === team));
  controls.classList.toggle("score-loser", Boolean(team && winner && winner !== team));

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
  if (context.type === "bronze") {
    state.bronze.winner = winner;
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
  state.bronze.winner = null;
  state.bronze.score = [0, 0];
}

function teamMarkup(team, isWinner, isHome) {
  const homeBadge = isHome ? '<span class="home-badge">Mando</span>' : "";
  const winnerBadge = isWinner ? '<span class="winner-badge">OK</span>' : "";
  return `
    <span class="team-name">
      <span class="team-label">${team}</span>
    </span>
    <span class="team-badges">${homeBadge}${winnerBadge}</span>
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
