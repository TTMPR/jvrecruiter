window.addEventListener("scroll", () => {
  document.getElementById("navbar").classList.toggle("scrolled", window.scrollY > 40);
  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.8) {
      el.classList.add("visible");
    }
  });
});

const langButtons = document.querySelectorAll(".lang-btn");
langButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const lang = button.dataset.lang;
    document.body.classList.toggle("lang-es", lang === "es");
    langButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
  });
});

const tabs = document.querySelectorAll(".aud-tab");
const panels = document.querySelectorAll(".audience-panel");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const audience = tab.dataset.audience;
    tabs.forEach((btn) => btn.classList.toggle("active", btn === tab));
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${audience}`);
    });
  });
});
