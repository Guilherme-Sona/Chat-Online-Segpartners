// Validação de Login
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const users = JSON.parse(localStorage.getItem("users")) || [];

  if (users.length === 0) {
    alert("Nenhum usuário cadastrado. Por favor, registre-se primeiro.");
    return;
  }

  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    alert("Usuário ou senha inválidos.");
    return;
  }

  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("loggedUser", JSON.stringify(user));
  alert(`Bem-vindo, ${user.name}!`);
  window.location.href = "../home/home.html"; // Redireciona para a página do Home
}

// Registrar novo usuário
function register() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const sector = document.getElementById("regSector").value.trim();
  const password = document.getElementById("regPassword").value.trim();

  if (!name || !email || !sector || !password) {
    alert("Preencha todos os campos (incluindo setor)");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users")) || [];

  if (users.some((u) => u.email === email)) {
    alert("Usuário já existe");
    return;
  }

  const newUser = { name, email, password, sector, admin: false };
  users.push(newUser);
  localStorage.setItem("users", JSON.stringify(users));

  // Auto-login após registro para facilitar testes
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("loggedUser", JSON.stringify(newUser));

  alert("Usuário registrado e logado com sucesso!");
  document.getElementById("registerModal").style.display = "none";

  // Limpar campos
  document.getElementById("regName").value = "";
  document.getElementById("regEmail").value = "";
  document.getElementById("regSector").value = "";
  document.getElementById("regPassword").value = "";

  // Redireciona para Home (onde estará o acesso ao chat)
  window.location.href = "../home/home.html";
}

// Listeners para abrir/fechar o modal e para o botão registrar
document.addEventListener("DOMContentLoaded", function () {
  const btnOpen = document.getElementById("btnOpenRegister");
  const btnClose = document.getElementById("btnCloseModal");
  const btnRegister = document.getElementById("btnRegister");
  const modal = document.getElementById("registerModal");

  if (btnOpen) {
    btnOpen.addEventListener("click", function (e) {
      e.preventDefault();
      if (modal) modal.style.display = "flex"; // usa flex para centralizar
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", function (e) {
      e.preventDefault();
      if (modal) modal.style.display = "none";
    });
  }

  if (btnRegister) {
    btnRegister.addEventListener("click", function (e) {
      e.preventDefault();
      register();
    });
  }

  // Fecha modal ao clicar fora do conteúdo
  window.addEventListener("click", function (e) {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});
