document.addEventListener("DOMContentLoaded", function () {
  loadWhatsApp();
  if (DATA.post_id) {
    loadComments();
  }
});

function loadWhatsApp() {
  fetch("/api/whatsapp?number=" + DATA.full_number)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var spinner = document.getElementById("wa-spinner");
      var content = document.getElementById("wa-content");
      if (spinner) spinner.remove();
      if (!content) return;

      if (data.error) {
        content.innerHTML = '<span class="error-msg">Erro ao carregar</span>';
      } else {
        var registered = data.registered;
        var isYes = registered && registered.toLowerCase() === "yes";
        var statusClass = isYes ? "wa-registered" : "wa-not-registered";
        var statusText = isYes ? "Registado" : "Não registado";

        var html = '<div class="wa-row">';
        if (isYes && data.url) {
          html += '<img class="wa-photo" src="' + escapeHtml(data.url) + '" alt="Foto WhatsApp" onerror="this.remove()">';
        }
        html += '<span class="wa-status ' + statusClass + '">' + statusText + '</span>';
        html += "</div>";
        content.innerHTML = html;
      }

      content.classList.remove("hidden");
    })
    .catch(function () {
      var spinner = document.getElementById("wa-spinner");
      var content = document.getElementById("wa-content");
      if (spinner) spinner.remove();
      if (content) {
        content.innerHTML = '<span class="error-msg">Erro ao carregar</span>';
        content.classList.remove("hidden");
      }
    });
}

function loadComments() {
  fetch("/api/comments?post_id=" + DATA.post_id)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var spinner = document.getElementById("comments-spinner");
      var content = document.getElementById("comments-content");
      if (spinner) spinner.remove();
      if (!content) return;

      if (data.error || !Array.isArray(data) || data.length === 0) {
        content.innerHTML = '<span class="not-found">Sem comentários</span>';
      } else {
        var html = "";
        data.forEach(function (c) {
          html += '<div class="comment-item">';
          html += '<div class="comment-meta">' + escapeHtml(c.author) + " &middot; " + escapeHtml(c.date) + "</div>";
          html += '<div class="comment-text">' + escapeHtml(c.text) + "</div>";
          html += "</div>";
        });
        content.innerHTML = html;
      }

      content.classList.remove("hidden");
    })
    .catch(function () {
      var spinner = document.getElementById("comments-spinner");
      var content = document.getElementById("comments-content");
      if (spinner) spinner.remove();
      if (content) {
        content.innerHTML = '<span class="error-msg">Erro ao carregar</span>';
        content.classList.remove("hidden");
      }
    });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
