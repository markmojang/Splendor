/* Splendor: Gem District — a self-contained two-player board-game implementation */
const COLORS = ["white", "blue", "green", "red", "black"];
const COLOR_GLYPHS = { white: "◆", blue: "●", green: "✦", red: "♦", black: "⬟", gold: "★" };
const COLOR_NAMES = { white: "เพชร", blue: "ไพลิน", green: "มรกต", red: "ทับทิม", black: "นิล", gold: "ทองคำ" };

const rawCards = {
  1: [
    ["white",0,{blue:1,green:1,red:1,black:1}], ["white",0,{blue:2,black:1}], ["white",1,{green:4}], ["white",0,{red:2,black:2}],
    ["blue",0,{white:1,green:1,red:1,black:1}], ["blue",0,{white:2,green:1}], ["blue",1,{black:4}], ["blue",0,{red:2,black:2}],
    ["green",0,{white:1,blue:1,red:1,black:1}], ["green",0,{blue:2,red:1}], ["green",1,{white:4}], ["green",0,{white:2,blue:2}],
    ["red",0,{white:1,blue:1,green:1,black:1}], ["red",0,{white:2,black:1}], ["red",1,{blue:4}], ["red",0,{white:2,green:2}],
    ["black",0,{white:1,blue:1,green:1,red:1}], ["black",0,{white:2,red:1}], ["black",1,{red:4}], ["black",0,{blue:2,green:2}]
  ],
  2: [
    ["white",1,{blue:3,green:2,red:2}], ["white",2,{green:5,red:3}], ["white",2,{blue:1,green:4,red:2}], ["white",1,{blue:2,green:2,red:3}],
    ["blue",1,{green:3,red:2,black:2}], ["blue",2,{red:5,black:3}], ["blue",2,{green:1,red:4,black:2}], ["blue",1,{green:2,red:2,black:3}],
    ["green",1,{white:2,red:3,black:2}], ["green",2,{white:5,black:3}], ["green",2,{white:2,red:1,black:4}], ["green",1,{white:3,red:2,black:2}],
    ["red",1,{white:2,blue:2,black:3}], ["red",2,{white:3,blue:5}], ["red",2,{white:4,blue:2,green:1}], ["red",1,{white:2,blue:3,black:2}],
    ["black",1,{white:3,blue:2,green:2}], ["black",2,{blue:3,green:5}], ["black",2,{white:1,blue:2,green:4}], ["black",1,{white:2,blue:2,green:3}]
  ],
  3: [
    ["white",3,{blue:3,green:3,red:5,black:3}], ["white",4,{blue:7,green:3}], ["white",4,{red:3,black:6}], ["white",5,{blue:3,green:3,red:3,black:3}],
    ["blue",3,{white:3,green:3,red:3,black:5}], ["blue",4,{white:7,red:3}], ["blue",4,{green:3,black:6}], ["blue",5,{white:3,green:3,red:3,black:3}],
    ["green",3,{white:5,blue:3,red:3,black:3}], ["green",4,{white:3,black:7}], ["green",4,{white:6,blue:3}], ["green",5,{white:3,blue:3,red:3,black:3}],
    ["red",3,{white:3,blue:5,green:3,black:3}], ["red",4,{blue:3,green:7}], ["red",4,{blue:6,black:3}], ["red",5,{white:3,blue:3,green:3,black:3}],
    ["black",3,{white:3,blue:3,green:5,red:3}], ["black",4,{green:3,red:7}], ["black",4,{white:3,green:6}], ["black",5,{white:3,blue:3,green:3,red:3}]
  ]
};

const noblePool = [
  ["ดยุกแห่งทัสคานี", {white:3, blue:3, green:3}], ["เคานต์แห่งลียง", {blue:3, green:3, red:3}],
  ["เจ้าหญิงแห่งอารากอน", {green:3, red:3, black:3}], ["เจ้าเมืองฟลอเรนซ์", {red:3, black:3, white:3}],
  ["ราชินีแห่งราเวนนา", {black:3, white:3, blue:3}], ["เจ้าชายแห่งเบอร์กันดี", {white:4, red:4}],
  ["เคาน์เตสแห่งอาวีญง", {blue:4, green:4}], ["มาร์ควิสแห่งเจนัว", {green:4, black:4}],
  ["ดยุคแห่งนีซ", {red:4, blue:4}], ["เลดี้แห่งเซบียา", {black:4, white:4}]
];

let state = null;
let selectedMode = "solo";
let roomPoller = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function localPlayer() { return state[state.localPlayerId || "human"]; }
function rivalPlayer() { return state[localPlayer().id === "human" ? "bot" : "human"]; }
function otherPlayerId(id) { return id === "human" ? "bot" : "human"; }
function isOnline() { return state?.mode === "online"; }
function isLocalTurn() { return !!state && state.turn === localPlayer().id && !state.gameOver && state.roomReady; }

function makeCards() {
  const decks = { 1: [], 2: [], 3: [] };
  Object.entries(rawCards).forEach(([tier, cards]) => {
    decks[tier] = cards.map(([bonus, points, cost], index) => ({ id: `t${tier}-${index}`, tier: Number(tier), bonus, points, cost: {...cost} }));
    shuffle(decks[tier]);
  });
  return decks;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function makePlayer(id, name) {
  return { id, name, score: 0, tokens: {white:0, blue:0, green:0, red:0, black:0, gold:0}, bonuses: {white:0, blue:0, green:0, red:0, black:0}, reserved: [], nobles: [] };
}

function initGame(name = "คุณ") {
  const decks = makeCards();
  state = {
    decks,
    market: { 1: [], 2: [], 3: [] },
    bank: {white:4, blue:4, green:4, red:4, black:4, gold:5},
    nobles: shuffle(noblePool.map(([name, req], id) => ({id:`n${id}`, name, req:{...req}, points:3}))).slice(0, 3),
    human: makePlayer("human", name.trim() || "คุณ"),
    bot: makePlayer("bot", "Amélie"),
    turn: "human",
    selected: [],
    roundClosing: false,
    gameOver: false,
    waitingForNoble: null,
    discarding: null,
    mode: "solo",
    localPlayerId: "human",
    roomReady: true,
    roomCode: null,
    roomToken: null,
    remoteVersion: 0
  };
  [1,2,3].forEach((tier) => { for (let count = 0; count < 4; count += 1) dealCard(tier); });
  render();
}

function dealCard(tier) {
  const next = state.decks[tier].pop();
  if (next) state.market[tier].push(next);
}

function getPlayer(id) { return state[id]; }
function tokenTotal(player) { return Object.values(player.tokens).reduce((sum, amount) => sum + amount, 0); }
function classFor(color) { return `c-${color}`; }
function colorText(color) { return COLOR_NAMES[color]; }
function showModal(id) { $("#overlay").classList.remove("hidden"); $(`#${id}`).classList.remove("hidden"); }
function hideModal(id) { $(`#${id}`).classList.add("hidden"); if (!$$(".modal:not(.hidden)").length) $("#overlay").classList.add("hidden"); }

function render() {
  if (!state) return;
  const local = localPlayer();
  const rival = rivalPlayer();
  $("#human-name").textContent = local.name;
  $("#final-human-name").textContent = local.name;
  $("#rival-name").textContent = rival.name;
  $("#rival-subtitle").textContent = isOnline() ? "พ่อค้าในห้องเดียวกัน" : "พ่อค้าแห่งมาร์แซย์";
  $("#human-score").textContent = local.score;
  $("#bot-score").textContent = rival.score;
  renderPlayerBonuses(local, $("#human-bonuses"));
  renderPlayerBonuses(rival, $("#bot-bonuses"), true);
  renderHumanTokens();
  $("#bot-reserved span").textContent = rival.reserved.length;
  $("#reserved-info").textContent = `${local.reserved.length} / 3`;
  renderMarket();
  renderNobles();
  renderBank();
  renderReserved();
  $("#human-panel").classList.toggle("is-active", isLocalTurn());
  $("#bot-panel").classList.toggle("is-active", state.turn === rival.id && !state.gameOver && state.roomReady);
  $("#room-button").classList.toggle("hidden", !isOnline());
}

function renderPlayerBonuses(player, host, compact = false) {
  host.innerHTML = "";
  COLORS.forEach((color) => {
    const chip = document.createElement("span");
    chip.className = `bonus-chip ${classFor(color)} ${player.bonuses[color] ? "" : "zero"}`;
    chip.title = `${colorText(color)}: โบนัส ${player.bonuses[color]}`;
    chip.textContent = compact && !player.bonuses[color] ? "" : player.bonuses[color];
    host.append(chip);
  });
}

function renderHumanTokens() {
  const host = $("#human-tokens");
  host.innerHTML = "";
  const player = localPlayer();
  [...COLORS, "gold"].forEach((color) => {
    const count = player.tokens[color];
    if (!count) return;
    const token = document.createElement(state.discarding ? "button" : "span");
    token.className = `token ${classFor(color)}`;
    token.textContent = count;
    token.title = state.discarding ? `คืน${colorText(color)} 1 เหรียญ` : `${colorText(color)} ${count} เหรียญ`;
    if (state.discarding) token.addEventListener("click", () => discardToken(color));
    host.append(token);
  });
  if (!host.children.length) host.innerHTML = '<span class="empty-hand">ยังไม่มีอัญมณี</span>';
}

function renderBank() {
  const host = $("#bank-tokens");
  host.innerHTML = "";
  const active = isLocalTurn() && !state.discarding && !state.waitingForNoble;
  [...COLORS, "gold"].forEach((color) => {
    const button = document.createElement("button");
    const isGold = color === "gold";
    button.className = `token ${classFor(color)} ${isGold ? "gold static" : ""} ${state.selected.includes(color) ? "selected" : ""} ${(!active || isGold || state.bank[color] === 0) ? "disabled" : ""}`;
    button.disabled = !active || isGold || state.bank[color] === 0;
    button.innerHTML = `<span>${state.bank[color]}</span>`;
    button.title = isGold ? `ทองคำเหลือ ${state.bank.gold}` : `${colorText(color)} เหลือ ${state.bank[color]}`;
    if (!isGold) button.addEventListener("click", () => toggleSelectedToken(color));
    host.append(button);
  });
  const valid = isTokenSelectionValid(state.selected);
  $("#take-tokens").disabled = !active || !valid;
  $("#clear-tokens").disabled = !active || !state.selected.length;
  $("#token-selection").textContent = state.selected.length === 2 && state.selected[0] === state.selected[1]
    ? `เลือกแล้ว 2 เหรียญสีเดียว · ${colorText(state.selected[0])}`
    : `เลือกแล้ว ${state.selected.length} / 3`;
}

function renderNobles() {
  const host = $("#nobles");
  host.innerHTML = "";
  state.nobles.forEach((noble) => host.append(makeNoble(noble)));
}

function makeNoble(noble, choice = false) {
  const card = document.createElement(choice ? "button" : "article");
  card.className = "noble";
  card.innerHTML = `<span class="noble-points">3</span><span class="noble-name">${noble.name}</span><div class="requirements">${Object.entries(noble.req).map(([color, amount]) => `<span class="req ${classFor(color)}">${amount}</span>`).join("")}</div>`;
  if (choice) card.addEventListener("click", () => chooseNoble(noble.id));
  return card;
}

function renderMarket() {
  const host = $("#market");
  host.innerHTML = "";
  [3,2,1].forEach((tier) => {
    const row = document.createElement("div");
    row.className = "tier-row";
    row.dataset.tier = tier;
    const deck = document.createElement("button");
    deck.className = "deck-stack";
    deck.title = `จองไพ่คว่ำระดับ ${tier}`;
    deck.innerHTML = `<span class="tier-label">ชั้น ${tier}</span><span class="deck-count">${state.decks[tier].length}</span>`;
    deck.disabled = !state.decks[tier].length || !canHumanReserve();
    deck.addEventListener("click", () => reserveTopCard(tier));
    row.append(deck);
    state.market[tier].forEach((card) => row.append(makeDevCard(card, "market")));
    for (let empty = state.market[tier].length; empty < 4; empty += 1) {
      const placeholder = document.createElement("div"); placeholder.className = "dev-card dimmed"; row.append(placeholder);
    }
    host.append(row);
  });
}

function makeDevCard(card, location) {
  const template = $("#card-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.dataset.tier = card.tier;
  node.querySelector(".points").textContent = card.points || "";
  const bonus = node.querySelector(".gem-bonus"); bonus.classList.add(classFor(card.bonus)); bonus.textContent = COLOR_GLYPHS[card.bonus];
  node.querySelector(".card-cost").innerHTML = Object.entries(card.cost).map(([color, amount]) => `<span class="cost ${classFor(color)}" title="${colorText(color)}">${amount}</span>`).join("");
  const buy = node.querySelector(".buy-card");
  const reserve = node.querySelector(".reserve-card");
  const active = isLocalTurn() && !state.discarding && !state.waitingForNoble;
  buy.disabled = !active || !canBuy(localPlayer(), card);
  buy.addEventListener("click", (event) => { event.stopPropagation(); buyCard(localPlayer().id, card.id, location); });
  reserve.disabled = !active || !canHumanReserve();
  reserve.addEventListener("click", (event) => { event.stopPropagation(); reserveCard("human", card.id, location); });
  if (location === "reserved") reserve.classList.add("hidden");
  node.title = cardTitle(card);
  return node;
}

function renderReserved() {
  const host = $("#human-reserved");
  host.innerHTML = "";
  const player = localPlayer();
  if (!player.reserved.length) { host.innerHTML = '<p class="empty-hand">ยังไม่มีไพ่ที่จอง</p>'; return; }
  player.reserved.forEach((card) => host.append(makeDevCard(card, "reserved")));
}

function cardTitle(card) { return `ไพ่ระดับ ${card.tier}: โบนัส${colorText(card.bonus)}${card.points ? ` · ${card.points} ศักดิ์ศรี` : ""}`; }
function canHumanReserve() { return isLocalTurn() && localPlayer().reserved.length < 3 && !state.discarding && !state.waitingForNoble; }

function toggleSelectedToken(color) {
  if (!isLocalTurn() || state.discarding || state.gameOver) return;
  const selected = state.selected;
  const sameColorCount = selected.filter((item) => item === color).length;

  // A second click on the only selected colour means "take two of this colour",
  // not "unselect". This is the special Splendor double-token action.
  if (sameColorCount === 1 && selected.length === 1) {
    if (state.bank[color] < 4) return setStatus("รับสีเดียว 2 เหรียญได้เมื่อกองเหลืออย่างน้อย 4", "warn");
    selected.push(color);
    renderBank();
    return;
  }
  if (sameColorCount === 2) { state.selected = []; renderBank(); return; }
  if (sameColorCount === 1) { selected.splice(selected.indexOf(color), 1); renderBank(); return; }
  if (selected.length >= 3) return setStatus("เลือกรับได้สูงสุด 3 เหรียญ", "warn");
  if (new Set(selected).size !== selected.length) {
    return setStatus("ไม่สามารถผสมหลังเลือก 2 เหรียญสีเดียว", "warn");
  } else if (selected.length === 2 && selected[0] === selected[1]) {
    return setStatus("ไม่สามารถผสมหลังเลือก 2 เหรียญสีเดียว", "warn");
  }
  selected.push(color);
  renderBank();
}

function isTokenSelectionValid(selection) {
  if (!selection.length || selection.length > 3) return false;
  const same = selection.length === 2 && selection[0] === selection[1];
  if (selection.length > 1 && !same && new Set(selection).size !== selection.length) return false;
  return same ? state.bank[selection[0]] >= 4 : true;
}

function takeSelectedTokens() {
  if (!isLocalTurn() || !isTokenSelectionValid(state.selected)) return;
  const player = localPlayer();
  state.selected.forEach((color) => { state.bank[color] -= 1; player.tokens[color] += 1; });
  const names = state.selected.map(colorText).join(" · ");
  state.selected = [];
  setStatus(`${player.name} รับ ${names}`, "ok");
  finishAction(player);
}

function clearSelectedTokens() { state.selected = []; renderBank(); setStatus("ล้างอัญมณีที่เลือกแล้ว"); }

function findCard(id, location) {
  if (location === "reserved") return state.human.reserved.find((card) => card.id === id);
  for (const tier of [1,2,3]) { const card = state.market[tier].find((marketCard) => marketCard.id === id); if (card) return card; }
  return null;
}

function paymentFor(player, card) {
  const colored = {};
  let goldNeeded = 0;
  COLORS.forEach((color) => {
    const amount = Math.max(0, (card.cost[color] || 0) - player.bonuses[color]);
    colored[color] = Math.min(player.tokens[color], amount);
    goldNeeded += Math.max(0, amount - colored[color]);
  });
  return { colored, gold: goldNeeded };
}

function canBuy(player, card) { return !!card && paymentFor(player, card).gold <= player.tokens.gold; }

function buyCard(playerId, cardId, location = "market") {
  const player = getPlayer(playerId);
  if (playerId === state.localPlayerId && (!isLocalTurn() || state.discarding || state.waitingForNoble)) return;
  let card = location === "reserved" ? player.reserved.find((item) => item.id === cardId) : null;
  let tier = null;
  if (!card) {
    for (const number of [1,2,3]) { const found = state.market[number].find((item) => item.id === cardId); if (found) { card = found; tier = number; break; } }
  }
  if (!card || !canBuy(player, card)) return;
  const payment = paymentFor(player, card);
  COLORS.forEach((color) => { player.tokens[color] -= payment.colored[color]; state.bank[color] += payment.colored[color]; });
  player.tokens.gold -= payment.gold; state.bank.gold += payment.gold;
  player.bonuses[card.bonus] += 1;
  player.score += card.points;
  if (location === "reserved") player.reserved = player.reserved.filter((item) => item.id !== card.id);
  else { state.market[tier] = state.market[tier].filter((item) => item.id !== card.id); dealCard(tier); }
  setStatus(`${player.name} ซื้อไพ่${colorText(card.bonus)}${card.points ? ` +${card.points} ศักดิ์ศรี` : ""}`, "ok");
  afterPurchase(player);
}

function reserveCard(playerId, cardId, location = "market") {
  const player = getPlayer(playerId);
  if (player.reserved.length >= 3 || (playerId === state.localPlayerId && (!isLocalTurn() || state.discarding || state.waitingForNoble))) return;
  let card = null, tier = null;
  for (const number of [1,2,3]) { const found = state.market[number].find((item) => item.id === cardId); if (found) { card = found; tier = number; break; } }
  if (!card) return;
  state.market[tier] = state.market[tier].filter((item) => item.id !== card.id); dealCard(tier);
  player.reserved.push(card);
  giveGoldForReservation(player);
  setStatus(`${player.name} จองไพ่ระดับ ${tier}`, "ok");
  finishAction(player);
}

function reserveTopCard(tier) {
  if (!canHumanReserve() || !state.decks[tier].length) return;
  const card = state.decks[tier].pop();
  const player = localPlayer();
  player.reserved.push(card);
  giveGoldForReservation(player);
  setStatus(`${player.name} จองไพ่คว่ำระดับ ${tier}`, "ok");
  finishAction(player);
}

function giveGoldForReservation(player) {
  if (state.bank.gold > 0) { state.bank.gold -= 1; player.tokens.gold += 1; }
}

function afterPurchase(player) {
  const eligible = state.nobles.filter((noble) => COLORS.every((color) => player.bonuses[color] >= (noble.req[color] || 0)));
  if (!eligible.length) return finishAction(player);
  if (player.id === state.localPlayerId && eligible.length > 1) {
    state.waitingForNoble = { player, choices: eligible };
    const host = $("#noble-choices"); host.innerHTML = ""; eligible.forEach((noble) => host.append(makeNoble(noble, true)));
    render(); showModal("noble-modal"); setStatus("เลือกขุนนางผู้เยี่ยมเยียน", "warn");
    return;
  }
  awardNoble(player, eligible[0]);
  finishAction(player);
}

function chooseNoble(nobleId) {
  if (!state.waitingForNoble) return;
  const noble = state.nobles.find((item) => item.id === nobleId);
  const player = state.waitingForNoble.player;
  if (!noble) return;
  awardNoble(player, noble);
  state.waitingForNoble = null;
  hideModal("noble-modal");
  finishAction(player);
}

function awardNoble(player, noble) {
  player.nobles.push(noble); player.score += noble.points;
  state.nobles = state.nobles.filter((item) => item.id !== noble.id);
  setStatus(`${player.name} ได้รับการเยี่ยมเยียนจาก ${noble.name} +3 ศักดิ์ศรี`, "ok");
}

function finishAction(player) {
  render();
  if (tokenTotal(player) > 10) {
    if (player.id === state.localPlayerId) {
      state.discarding = { player, count: tokenTotal(player) - 10 };
      render();
      $("#discard-count").textContent = state.discarding.count;
      showModal("discard-modal");
      setStatus(`อัญมณีเกิน 10 — คืนอีก ${state.discarding.count} เหรียญ`, "warn");
      return;
    }
    botDiscardToLimit(player);
  }
  advanceTurn(player);
}

function discardToken(color) {
  const player = localPlayer();
  if (!state.discarding || !player.tokens[color]) return;
  player.tokens[color] -= 1; state.bank[color] += 1; state.discarding.count -= 1;
  $("#discard-count").textContent = state.discarding.count;
  if (state.discarding.count > 0) { render(); return; }
  state.discarding = null; hideModal("discard-modal"); setStatus("คืนอัญมณีครบแล้ว", "ok"); advanceTurn(player);
}

function botDiscardToLimit(player) {
  while (tokenTotal(player) > 10) {
    const color = [...COLORS, "gold"].sort((a,b) => player.tokens[b] - player.tokens[a])[0];
    player.tokens[color] -= 1; state.bank[color] += 1;
  }
}

function advanceTurn(player) {
  state.selected = [];
  if (player.score >= 15) state.roundClosing = true;
  if (player.id === "bot" && state.roundClosing) { render(); return endGame(player.id); }
  state.turn = otherPlayerId(player.id);
  render();
  if (isOnline()) {
    publishRoomState(player.id);
    setStatus(state.turn === localPlayer().id ? "ตาคุณ — เลือกการกระทำ" : "กำลังรอคู่แข่งเลือกการกระทำ…");
  } else if (state.turn === "bot") { setStatus("Amélie กำลังตัดสินใจ…"); runBotTurn(); }
  else setStatus("ตาคุณ — เลือกการกระทำ");
}

async function runBotTurn() {
  await wait(820);
  if (!state || isOnline() || state.gameOver || state.turn !== "bot") return;
  const bot = state.bot;
  const candidates = [...bot.reserved, ...[1,2,3].flatMap((tier) => state.market[tier])];
  const affordable = candidates.filter((card) => canBuy(bot, card)).sort((a,b) => cardValue(b, bot) - cardValue(a, bot));
  if (affordable.length) {
    const card = affordable[0];
    const location = bot.reserved.some((item) => item.id === card.id) ? "reserved" : "market";
    buyCard("bot", card.id, location);
    return;
  }
  const worthy = [...[3,2,1].flatMap((tier) => state.market[tier])].sort((a,b) => cardValue(b, bot) - cardValue(a, bot))[0];
  if (worthy && bot.reserved.length < 3 && worthy.points >= 2 && Math.random() < .34) {
    reserveCard("bot", worthy.id, "market");
    return;
  }
  botTakeTokens(bot, worthy);
}

function cardValue(card, player) {
  const missing = COLORS.reduce((sum, color) => sum + Math.max(0,(card.cost[color] || 0) - player.bonuses[color] - player.tokens[color]), 0);
  return card.points * 12 + (player.bonuses[card.bonus] ? 0 : 3) - missing * .65;
}

function botTakeTokens(bot, target) {
  const room = Math.max(0, 10 - tokenTotal(bot));
  let picks = [];
  const needed = COLORS.map((color) => ({ color, need: target ? Math.max(0, (target.cost[color] || 0) - bot.bonuses[color] - bot.tokens[color]) : 1 }));
  needed.sort((a,b) => b.need - a.need || state.bank[b.color] - state.bank[a.color]);
  const double = needed.find(({color, need}) => need >= 2 && state.bank[color] >= 4);
  if (double && room >= 2) picks = [double.color, double.color];
  else picks = needed.filter(({color}) => state.bank[color] > 0).slice(0, Math.max(1, Math.min(3, room))).map(({color}) => color);
  if (!picks.length) { advanceTurn(bot); return; }
  picks.forEach((color) => { state.bank[color] -= 1; bot.tokens[color] += 1; });
  setStatus(`Amélie รับ ${picks.map(colorText).join(" · ")}`, "ok");
  finishAction(bot);
}

function setStatus(message, tone = "") {
  const el = $("#status-text");
  if (el) el.textContent = message;
  const dot = $(".status-dot");
  if (dot) dot.style.background = tone === "warn" ? "#ec9e59" : tone === "ok" ? "#7dcaa6" : "#f0bd4d";
}

function presentGameOver() {
  state.gameOver = true;
  const human = localPlayer(), bot = rivalPlayer();
  const humanWins = human.score > bot.score || (human.score === bot.score && human.reserved.length < bot.reserved.length);
  $("#final-human-score").textContent = human.score;
  $("#final-bot-score").textContent = bot.score;
  $("#game-over-kicker").textContent = humanWins ? "YOUR MERCHANT DYNASTY" : "THE MARKET CLOSES";
  $("#game-over-title").textContent = humanWins ? "คุณชนะแล้ว!" : "Amélie ชนะในครั้งนี้";
  $("#game-over-copy").textContent = humanWins ? `${human.name} สร้างชื่อเสียงเหนือคู่แข่งด้วย ${human.score} ศักดิ์ศรี` : `ผลคะแนน ${bot.score} ต่อ ${human.score} — ลองเปิดตลาดรอบใหม่อีกครั้ง`;
  $("#victory-seal").textContent = humanWins ? "✦" : "♛";
  render(); showModal("game-over-modal");
}

function endGame(actor = null) {
  state.gameOver = true;
  if (isOnline() && actor === state.localPlayerId) publishRoomState(actor);
  presentGameOver();
}

function showGame() {
  $("#start-screen").classList.add("hidden"); $("#game-screen").classList.remove("hidden");
}

function roomPayload() {
  const payload = structuredClone(state);
  ["localPlayerId", "roomCode", "roomToken", "remoteVersion", "selected", "waitingForNoble", "discarding"].forEach((key) => delete payload[key]);
  payload.mode = "online";
  return payload;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "ไม่สามารถเชื่อมต่อห้องออนไลน์ได้"), { data, status: response.status });
  return data;
}

function setLandingMessage(message, error = false) {
  const note = $("#start-note");
  note.textContent = message;
  note.classList.toggle("is-error", error);
}

function updateRoomModal() {
  if (!isOnline()) return;
  $("#room-code-display").textContent = state.roomCode || "------";
  const ready = state.roomReady;
  $("#room-state-text").textContent = ready ? "คู่แข่งเข้าร่วมแล้ว — เกมกำลังดำเนินอยู่" : "กำลังรอคู่แข่งเข้าร่วม…";
}

function applyRemoteState(snapshot, version) {
  const localId = state.localPlayerId;
  const roomCode = state.roomCode;
  const roomToken = state.roomToken;
  state = snapshot;
  state.mode = "online";
  state.localPlayerId = localId;
  state.roomCode = roomCode;
  state.roomToken = roomToken;
  state.remoteVersion = version;
  state.selected = [];
  state.waitingForNoble = null;
  state.discarding = null;
  render(); updateRoomModal();
  if (state.gameOver && $("#game-over-modal").classList.contains("hidden")) presentGameOver();
  else if (state.roomReady) setStatus(isLocalTurn() ? "ตาคุณ — เลือกการกระทำ" : "กำลังรอคู่แข่งเลือกการกระทำ…");
}

async function pollRoom() {
  if (!isOnline() || !state.roomCode || !state.roomToken) return;
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(state.roomCode)}?token=${encodeURIComponent(state.roomToken)}`);
    if (data.version > state.remoteVersion) applyRemoteState(data.state, data.version);
  } catch (error) {
    if (error.status === 404) setStatus("ไม่พบห้องออนไลน์นี้", "warn");
  }
}

function startRoomPolling() {
  clearInterval(roomPoller);
  pollRoom();
  roomPoller = setInterval(pollRoom, 1100);
}

async function publishRoomState(actor) {
  if (!isOnline() || !state.roomToken) return;
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/state`, {
      method: "POST",
      body: JSON.stringify({ token: state.roomToken, version: state.remoteVersion, actor, state: roomPayload() })
    });
    state.remoteVersion = data.version;
  } catch (error) {
    if (error.data?.state) applyRemoteState(error.data.state, error.data.version);
    else setStatus("การเชื่อมต่อขัดข้อง — กำลังลองเชื่อมใหม่", "warn");
  }
}

async function createOnlineRoom(name) {
  initGame(name);
  state.mode = "online";
  state.roomReady = false;
  state.bot.name = "กำลังรอคู่แข่ง";
  const data = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: state.human.name, state: roomPayload() }) });
  state.roomCode = data.code;
  state.roomToken = data.token;
  state.remoteVersion = data.version;
  showGame(); render(); updateRoomModal(); showModal("room-modal");
  setStatus("ห้องพร้อมแล้ว — ส่งรหัสให้เพื่อน");
  startRoomPolling();
}

async function joinOnlineRoom(code, name) {
  const data = await api(`/api/rooms/${encodeURIComponent(code.toUpperCase())}/join`, { method: "POST", body: JSON.stringify({ name }) });
  state = data.state;
  state.mode = "online";
  state.localPlayerId = "bot";
  state.roomCode = data.code;
  state.roomToken = data.token;
  state.remoteVersion = data.version;
  state.selected = [];
  state.waitingForNoble = null;
  state.discarding = null;
  showGame(); render();
  setStatus(state.turn === "bot" ? "ตาคุณ — เลือกการกระทำ" : "กำลังรอคู่แข่งเลือกการกระทำ…");
  startRoomPolling();
}

async function startFromLanding() {
  const name = $("#player-name").value.trim() || "คุณ";
  const start = $("#start-game");
  if (selectedMode === "solo") {
    showGame(); initGame(name); setStatus("ตาคุณ — เลือกการกระทำ");
    return;
  }
  start.disabled = true;
  setLandingMessage("กำลังเชื่อมต่อโต๊ะออนไลน์…");
  try {
    const code = $("#room-code-input").value.trim();
    if (code) await joinOnlineRoom(code, name);
    else await createOnlineRoom(name);
  } catch (error) {
    setLandingMessage(error.message.includes("Failed to fetch") ? "เปิดผ่าน server.js เพื่อใช้ห้องออนไลน์" : error.message, true);
  } finally {
    start.disabled = false;
  }
}

function selectMode(mode) {
  selectedMode = mode;
  $$(".mode-option").forEach((button) => button.classList.toggle("selected", button.dataset.mode === mode));
  $("#room-code-field").classList.toggle("hidden", mode !== "online");
  updateStartLabel();
  setLandingMessage(mode === "online" ? "เว้นรหัสห้องว่างเพื่อสร้างห้องใหม่ หรือใส่รหัสเพื่อเข้าร่วม" : "แข่งขันสะสมศักดิ์ศรีให้ถึง 15 คะแนนก่อนคู่แข่ง");
}

function updateStartLabel() {
  const hasCode = $("#room-code-input").value.trim().length > 0;
  $("#start-label").textContent = selectedMode === "solo" ? "เริ่มเกมกับ AI" : hasCode ? "เข้าร่วมห้องออนไลน์" : "สร้างห้องออนไลน์";
}

function returnToLobby() {
  clearInterval(roomPoller); roomPoller = null;
  $("#game-screen").classList.add("hidden"); $("#start-screen").classList.remove("hidden");
  ["game-over-modal", "room-modal"].forEach(hideModal);
  state = null;
}

$("#start-game").addEventListener("click", () => startFromLanding());
$("#player-name").addEventListener("keydown", (event) => { if (event.key === "Enter") startFromLanding(); });
$("#room-code-input").addEventListener("input", updateStartLabel);
$$('.mode-option').forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
$("#take-tokens").addEventListener("click", takeSelectedTokens);
$("#clear-tokens").addEventListener("click", clearSelectedTokens);
$("#rules-button").addEventListener("click", () => showModal("rules-modal"));
$("#how-to-play").addEventListener("click", () => showModal("rules-modal"));
$$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => hideModal("rules-modal")));
$("#overlay").addEventListener("click", () => { if (!state?.discarding && !state?.waitingForNoble && !state?.gameOver) { hideModal("rules-modal"); hideModal("room-modal"); } });
$("#new-game").addEventListener("click", () => { if (isOnline()) return returnToLobby(); hideModal("game-over-modal"); initGame(localPlayer().name); setStatus("ตาคุณ — เลือกการกระทำ"); });
$("#play-again").addEventListener("click", () => { if (isOnline()) return returnToLobby(); hideModal("game-over-modal"); initGame(localPlayer().name); setStatus("ตาคุณ — เลือกการกระทำ"); });
$("#room-button").addEventListener("click", () => { updateRoomModal(); showModal("room-modal"); });
$$('[data-close-room]').forEach((button) => button.addEventListener("click", () => hideModal("room-modal")));
$("#copy-room-code").addEventListener("click", async () => { try { await navigator.clipboard.writeText(state.roomCode); $("#copy-room-code").textContent = "คัดลอกแล้ว"; setTimeout(() => { $("#copy-room-code").textContent = "คัดลอก"; }, 1400); } catch { $("#copy-room-code").textContent = state.roomCode; } });
