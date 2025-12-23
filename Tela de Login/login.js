// Validação de Login (usando API)
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Preencha email e senha.");
    return;
  }

  try {
    const resp = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      alert("Erro ao logar: " + (data.msg || resp.statusText));
      return;
    }

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("token", data.token);
    localStorage.setItem("loggedUser", JSON.stringify(data.user));
    alert(`Bem-vindo, ${data.user.name}!`);
    window.location.href = "../home/home.html";
  } catch (err) {
    console.error(err);
    alert("Erro ao conectar com o servidor.");
  }
}

// Registrar novo usuário (usando API)
async function register() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const sector = document.getElementById("regSector").value.trim();
  const password = document.getElementById("regPassword").value.trim();

  if (!name || !email || !sector || !password) {
    alert("Preencha todos os campos (incluindo setor)");
    return;
  }

  try {
    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, sector, password }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      alert("Erro ao registrar: " + (data.msg || resp.statusText));
      return;
    }

    // Save token and user
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("token", data.token);
    localStorage.setItem("loggedUser", JSON.stringify(data.user));

    alert("Usuário registrado e logado com sucesso!");
    document.getElementById("registerModal").style.display = "none";

    // Limpar campos
    document.getElementById("regName").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regSector").value = "";
    document.getElementById("regPassword").value = "";

    // Redireciona para Home (onde estará o acesso ao chat)
    window.location.href = "../home/home.html";
  } catch (err) {
    console.error(err);
    alert("Erro ao conectar com o servidor.");
  }
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
