document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".back-button")) return; // Evita que se duplique el botón

    let backButton = document.createElement("a");
    backButton.href = "/gerente_dashboard";  // Redirigir a la página principal
    backButton.classList.add("back-button");

    // Insertar el botón en el body sin afectar el diseño
    document.body.appendChild(backButton);
});
