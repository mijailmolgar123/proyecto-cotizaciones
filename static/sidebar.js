document.addEventListener("DOMContentLoaded", function () {
    const toggleSidebar = document.getElementById("toggle-sidebar");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const navbar = document.querySelector(".navbar");

    toggleSidebar.addEventListener("click", function () {
        sidebar.classList.toggle("active");
        mainContent.classList.toggle("shifted");
        navbar.classList.toggle("shifted");
    });

    // Asegurar que la barra superior siempre esté visible
    navbar.style.zIndex = "1001";
    sidebar.style.zIndex = "1000";
});