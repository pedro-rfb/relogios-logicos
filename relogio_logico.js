// config inicial do D3 e da visualização
const svg = d3.select("svg");
const explanationDiv = d3.select("#explanation");
const svgWidth = 800;
const processes = ["P0", "P1", "P2"];
const yScale = d3.scalePoint().domain(processes).range([100, 300]);
const EVENT_X_OFFSET = 80; // Distância horizontal entre eventos
const EVENT_RADIUS = 8;
const MAX_X_POSITION = svgWidth - 50; // limite  para criação de eventos 

let eventIdCounter = 0;
let arrivalIdCounter = 0;

// variáveis
let events = []; // eventos (círculos)
let messages = [];
let arrivalClocks = []; // rótulos visuais para tempo de chegada de mensagens
let processClocks = {}; // relógio lógico atual de cada processo
let lastActivityX = {}; // última posição x de atividade (evento ou msg)

// define a ponta da seta para as mensagens
svg.append("defs").append("marker")
  .attr("id", "arrow")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 10)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "crimson");

// desenha as linhas horizontais para cada processo
svg.selectAll(".line")
  .data(processes)
  .enter()
  .append("line")
  .attr("x1", 50)
  .attr("x2", svgWidth - 20)
  .attr("y1", d => yScale(d))
  .attr("y2", d => yScale(d))
  .attr("stroke", "#333");

// adiciona os rótulos dos processos (P0, P1, P2)
svg.selectAll(".process-label")
  .data(processes)
  .enter()
  .append("text")
  .attr("x", 20)
  .attr("y", d => yScale(d) + 5)
  .text(d => d)
  .attr("class", "process");


//função principal para redesenhar a visualização.
function redraw() {
    // desenha os eventos (círculos)
    const eventCircles = svg.selectAll(".event").data(events, d => d.id);
    eventCircles.exit().remove();
    eventCircles.enter()
      .append("circle")
      .attr("class", "event")
      .attr("cy", d => yScale(d.process))
      .attr("r", EVENT_RADIUS)
      .attr("cx", d => d.x);

    // desenha os rótulos de tempo dos eventos e das chegadas de mensagens
    const allClocks = events.concat(arrivalClocks);
    const clockLabels = svg.selectAll(".clock-label").data(allClocks, d => d.id);
    clockLabels.exit().remove();
    clockLabels.enter()
      .append("text")
      .attr("class", "clock-label")
      .attr("y", d => yScale(d.process) - (EVENT_RADIUS + 5))
      .attr("x", d => d.x)
      .text(d => `t=${d.clock}`);

    // faz a animação das setas
    const messageLines = svg.selectAll(".message").data(messages, d => d.id);
    messageLines.exit().remove();
    messageLines.enter()
      .append("line")
      .attr("class", "message")
      .attr("marker-end", "url(#arrow)")
      .attr("x1", d => d.fromCoords.x)
      .attr("y1", d => d.fromCoords.y)
      .attr("x2", d => d.fromCoords.x)
      .attr("y2", d => d.fromCoords.y)
      .transition()
      .duration(1500)
      .attr("x2", d => d.toCoords.x)
      .attr("y2", d => d.toCoords.y);
}


// cria um novo evento interno, incrementando o relógio local antes.

function createInternalEvent() {
    const selectedProcess = document.getElementById("process-select-create").value;
    const currentX = lastActivityX[selectedProcess];

    if (currentX + EVENT_X_OFFSET > MAX_X_POSITION) {
        alert("Limite máximo de eventos atingidos nesse processo");
        return;
    }
    
    processClocks[selectedProcess]++;
    
    const newX = currentX + EVENT_X_OFFSET;
    lastActivityX[selectedProcess] = newX;

    const newEvent = {
        id: `e${eventIdCounter++}`,
        process: selectedProcess,
        clock: processClocks[selectedProcess],
        x: newX
    };
    events.push(newEvent);
    explanationDiv.text(""); // limpa a explicação ao criar evento interno
    redraw();
}


// envia uma mensagem de um processo a outro, atualizando os relógios lógicos.

function sendMessage() {
    const sourceProcess = document.getElementById("source-process").value;
    const destProcess = document.getElementById("dest-process").value;

    if (sourceProcess === destProcess) {
        alert("O processo de origem e destino não podem ser o mesmo.");
        return;
    }

    // incrementa o relógio local do remetente (este será o "t=4" por exemplo)
    processClocks[sourceProcess]++;
    const messageTimestamp = processClocks[sourceProcess];
    const oldDestClock = processClocks[destProcess];

    // calcula a posição X onde queremos mostrar o rótulo de envio (sem criar círculo)
    const tentativeSourceX = lastActivityX[sourceProcess] + EVENT_X_OFFSET;
    const destX = lastActivityX[destProcess];

    // origem da linha (vai partir do marcador de tempo que estamos criando)
    const fromX = tentativeSourceX;
    // destino da linha: garantir que fique depois da última atividade do destino
    const toX = Math.max(fromX, destX) + EVENT_X_OFFSET / 2;

    if (toX > MAX_X_POSITION) {
        // não altera nada se ultrapassar o limite
        alert("Não é possível enviar mensagem: limite visual atingido.");
        // reverte o incremento do relógio do remetente? (opcional)
        processClocks[sourceProcess]--; // se preferir cancelar a operação visualmente
        return;
    }

    // só após passar na checagem de limite, atualizamos as últimas posições
    lastActivityX[sourceProcess] = fromX;
    lastActivityX[destProcess] = toX;

    // aplica a regra de Lamport ajustada para o destino
    const newDestClock = Math.max(oldDestClock, messageTimestamp) + 1;
    processClocks[destProcess] = newDestClock;

    // cria a explicação textual (opcional)
    const sender = `c(${sourceProcess})`;
    const receiver = `c(${destProcess})`;
    let explanation;
    if (oldDestClock < messageTimestamp) {
        explanation = `Tempo de ${receiver} < ${sender}, portanto ${receiver} = ${sender} + 1`;
    } else {
        explanation = `Tempo de ${receiver} >= ${sender}, portanto ${receiver} = ${receiver} + 1`;
    }
    explanationDiv.text(explanation);

    // adiciona a linha/âncora da mensagem (seta animada)
    messages.push({
        id: `m${messages.length}`,
        fromCoords: { x: fromX, y: yScale(sourceProcess) },
        toCoords: { x: toX, y: yScale(destProcess) }
    });

    // adiciona apenas o rótulo de tempo no remetente (sem círculo)
    arrivalClocks.push({
        id: `sendClock${arrivalIdCounter++}`,
        process: sourceProcess,
        clock: messageTimestamp,
        x: fromX
    });

    // adiciona o rótulo de chegada no destinatário (t=5, por ex.)
    arrivalClocks.push({
        id: `ac${arrivalIdCounter++}`,
        process: destProcess,
        clock: newDestClock,
        x: toX
    });

    redraw();
}



//Configura o estado inicial da simulação.

function initialize() {
    events = [];
    messages = [];
    arrivalClocks = [];
    eventIdCounter = 0;
    arrivalIdCounter = 0;
    
    processes.forEach(p => {
        processClocks[p] = 0; 
        lastActivityX[p] = 100 - EVENT_X_OFFSET;
        createInternalEventFor(p);
    });

    function createInternalEventFor(processId) {
        processClocks[processId]++;
        const newX = lastActivityX[processId] + EVENT_X_OFFSET;
        lastActivityX[processId] = newX;
        events.push({
            id: `e${eventIdCounter++}`,
            process: processId,
            clock: processClocks[processId],
            x: newX
        });
    }

    explanationDiv.text("");
    redraw();
}


// limpa a visualização e reinicia a simulação.
function reset() {
    svg.selectAll(".event, .clock-label, .message, .arrival-clock-label").remove();
    initialize();
}

// adiciona os listeners de eventos aos botões 
document.getElementById("create-event").addEventListener("click", createInternalEvent);
document.getElementById("send-message").addEventListener("click", sendMessage);
document.getElementById("reset").addEventListener("click", reset);

// inicia simulação
initialize();
