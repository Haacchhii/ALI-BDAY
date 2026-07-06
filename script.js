const lanterns = document.querySelectorAll(".lantern");
const message = document.querySelector(".revealed-message");
const sparkleField = document.querySelector(".sparkle-field");
const sparkleButton = document.querySelector(".wish__button");

lanterns.forEach((lantern) => {
  lantern.addEventListener("click", () => {
    lanterns.forEach((item) => item.classList.remove("is-active"));
    lantern.classList.add("is-active");
    message.textContent = lantern.dataset.message;
  });
});

function createSparkle() {
  const spark = document.createElement("span");
  spark.className = "spark";
  spark.style.left = `${Math.random() * 100}%`;
  spark.style.top = `${20 + Math.random() * 70}%`;
  spark.style.animationDelay = `${Math.random() * 0.22}s`;
  sparkleField.appendChild(spark);
  window.setTimeout(() => spark.remove(), 1600);
}

sparkleButton.addEventListener("click", () => {
  for (let i = 0; i < 46; i += 1) {
    window.setTimeout(createSparkle, i * 24);
  }
});
