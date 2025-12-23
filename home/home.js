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
  window.location.href = "../Tela de Login/login.html";
}
