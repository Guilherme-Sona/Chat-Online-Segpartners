// Função que recebe um array de objetos com atributos: itsMe, admin e name
function organize(persons) {
  let me = persons.filter((person) => person.itsMe === true);
  let admins = persons.filter((person) => person.admin === true);
  let users = persons.filter((person) => person.admin !== true);

  // Função para ordenar por nome ignorando maiúsculas e acentos
  const sortByName = (a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  // Aplica ordenação em cada grupo
  admins.sort(sortByName);
  users.sort(sortByName);

  return { me, admins, users };
}

// Dados de exemplo (padrão)
let persons = [];

// Se existir usuário logado em localStorage, adiciona/atualiza como 'me' e loga no console
const loggedUser = JSON.parse(localStorage.getItem("loggedUser"));
if (loggedUser) {
  console.log(
    "%c🔐 Usuário logado:",
    "color: #9b59b6; font-weight: bold;",
    loggedUser
  );

  const existingIndex = persons.findIndex(
    (p) => p.name === loggedUser.name || p.name === loggedUser.email
  );
  if (existingIndex !== -1) {
    persons[existingIndex].itsMe = true;
    if (typeof loggedUser.admin !== "undefined")
      persons[existingIndex].admin = !!loggedUser.admin;
  } else {
    persons.unshift({
      itsMe: true,
      admin: !!loggedUser.admin,
      name: loggedUser.name || loggedUser.email || "Usuário",
    });
  }
}

// Função para exibir resultado bonito no console
function showOrganized(persons) {
  const { me, admins, users } = organize(persons);

  console.clear(); // limpa o console para ficar mais limpo
  console.log("%c👤 ME:", "color: #00bfff; font-weight: bold;");
  console.table(me);

  console.log("%c⭐ ADMINS:", "color: #f1c40f; font-weight: bold;");
  console.table(admins);

  console.log("%c👥 USERS:", "color: #2ecc71; font-weight: bold;");
  console.table(users);
}

// Chamada
showOrganized(persons);
