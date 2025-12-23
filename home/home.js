const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));

// Protege a página
if (!loggedUser) {
  window.location.href = "../Tela de Login/login.html";
} else {
  const displayName = loggedUser.name || loggedUser.email || "Usuário";
  document.getElementById("welcome").innerText = `Olá, ${displayName}${
    loggedUser.email ? " (" + loggedUser.email + ")" : ""
  }`;
  // Atualiza título da aba para conter o e-mail (ou nome)
  document.title = `Home - ${loggedUser.email || displayName}`;
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("loggedUser");
  localStorage.removeItem("token");
  window.location.href = "../Tela de Login/login.html";
}

// Fetch users and render grouped by sector
async function loadUsers() {
  const token = localStorage.getItem("token");
  if (!token) return logout();

  try {
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data || !data.ok) {
      console.error('Erro ao obter usuários', data);
      if (res.status === 401) return logout();
      return;
    }

    const users = data.users || [];
    const bySector = {};
    users.forEach((u) => {
      const s = u.sector || 'Sem Setor';
      if (!bySector[s]) bySector[s] = [];
      bySector[s].push(u);
    });

    const container = document.getElementById('users-container');
    container.innerHTML = '';

    Object.keys(bySector).forEach((sector) => {
      const block = document.createElement('div');
      block.style.border = '1px solid #ddd';
      block.style.padding = '8px';
      block.style.marginBottom = '8px';

      const h = document.createElement('h3');
      h.innerText = sector;
      block.appendChild(h);

      const openSectorBtn = document.createElement('button');
      openSectorBtn.innerText = 'Abrir chat (setor)';
      openSectorBtn.style.marginBottom = '8px';
      openSectorBtn.onclick = () => {
        // store room and optional title, then redirect to chat
        localStorage.setItem('chatRoom', sector);
        localStorage.setItem('chatRoomTitle', `Sala: ${sector}`);
        window.location.href = '../chat/chat.html';
      };
      block.appendChild(openSectorBtn);

      const ul = document.createElement('ul');
      bySector[sector].forEach((u) => {
        const li = document.createElement('li');
        li.style.marginTop = '6px';
        li.innerText = `${u.name || u.email} (${u.email || ''}) `;

        const dmBtn = document.createElement('button');
        dmBtn.innerText = 'Abrir DM';
        dmBtn.style.marginLeft = '8px';
        dmBtn.onclick = () => {
          const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));
          if (!loggedUser) return logout();
          const pair = [loggedUser.id, u.id].sort();
          const dmRoom = `dm:${pair.join(':')}`;
          localStorage.setItem('chatRoom', dmRoom);
          localStorage.setItem('chatRoomTitle', `DM: ${u.name || u.email}`);
          localStorage.setItem('chatWithUser', JSON.stringify(u));
          window.location.href = '../chat/chat.html';
        };

        li.appendChild(dmBtn);
        ul.appendChild(li);
      });

      block.appendChild(ul);
      container.appendChild(block);
    });
  } catch (err) {
    console.error(err);
  }
}

// hook up default open button
document.getElementById('open-default-chat')?.addEventListener('click', () => {
  const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));
  if (!loggedUser) return logout();
  localStorage.setItem('chatRoom', loggedUser.sector);
  localStorage.setItem('chatRoomTitle', `Sala: ${loggedUser.sector}`);
  window.location.href = '../chat/chat.html';
});

// load users on page load
loadUsers();
