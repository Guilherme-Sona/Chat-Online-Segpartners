(function () {
  // Use same origin so the client can connect whether served locally or remotely
  const socket = io();
  const messagesEl = document.getElementById("messages");
  const btnSend = document.getElementById("btnSend");
  const msgInput = document.getElementById("msgInput");
  const roomTitle = document.getElementById("room-title");
  const userInfo = document.getElementById("user-info");

  const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
  if (!loggedUser) {
    alert("Você precisa estar logado para usar o chat");
    window.location.href = "../Tela de Login/login.html";
  }

  const room = loggedUser.sector;
  roomTitle.innerText = `Sala: ${room}`;
  userInfo.innerText = `${loggedUser.name} (${loggedUser.email})`;

  function addMessage(m) {
    const div = document.createElement("div");
    div.className = "msg";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerText = `${m.user.name || m.user.email} • ${new Date(
      m.ts
    ).toLocaleString()}`;
    const text = document.createElement("div");
    text.className = "text";
    text.innerText = m.text;
    div.appendChild(meta);
    div.appendChild(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  socket.on("connect", () => {
    console.log("connected to chat server");
    socket.emit("join", { room, user: loggedUser }, (resp) => {
      if (!resp.ok) {
        alert("Não foi possível entrar na sala: " + (resp.msg || ""));
        return;
      }
      // load messages
      messagesEl.innerHTML = "";
      resp.messages.forEach(addMessage);
    });
  });

  socket.on("message", (m) => addMessage(m));

  btnSend.addEventListener("click", () => {
    const text = msgInput.value.trim();
    if (!text) return;
    socket.emit("message", { room, user: loggedUser, text }, (ack) => {
      if (!ack.ok) {
        alert("Erro ao enviar: " + (ack.msg || ""));
        return;
      }
      msgInput.value = "";
    });
  });

  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnSend.click();
    }
  });
})();
