document.addEventListener("DOMContentLoaded", function () {
  loadWhatsApp();
  if (DATA.post_id) {
    loadComments();
  }
});

function loadWhatsApp() {
  fetch(DATA.api_whatsapp + "?number=" + DATA.full_number)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var spinner = document.getElementById("wa-spinner");
      var content = document.getElementById("wa-content");
      if (spinner) spinner.remove();
      if (!content) return;

      if (data.error) {
        content.innerHTML = errorHtml(data.detail);
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
    .catch(function (err) {
      var spinner = document.getElementById("wa-spinner");
      var content = document.getElementById("wa-content");
      if (spinner) spinner.remove();
      if (content) {
        content.innerHTML = errorHtml(err && err.message);
        content.classList.remove("hidden");
      }
    });
}

function loadComments() {
  fetch(DATA.api_comments + "?post_id=" + DATA.post_id)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var spinner = document.getElementById("comments-spinner");
      var content = document.getElementById("comments-content");
      if (spinner) spinner.remove();
      if (!content) return;

      if (data.error) {
        content.innerHTML = errorHtml(data.detail);
      } else if (!Array.isArray(data) || data.length === 0) {
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
    .catch(function (err) {
      var spinner = document.getElementById("comments-spinner");
      var content = document.getElementById("comments-content");
      if (spinner) spinner.remove();
      if (content) {
        content.innerHTML = errorHtml(err && err.message);
        content.classList.remove("hidden");
      }
    });
}

function errorHtml(detail) {
  var id = "err-detail-" + Math.random().toString(36).slice(2);
  var detailPart = detail
    ? ' <a href="#" class="error-detail-link" onclick="var el=document.getElementById(\'' + id + '\');el.style.display=el.style.display===\'none\'?\'inline\':\'none\';return false;">Mostrar detalhes</a>' +
      '<span id="' + id + '" class="error-detail" style="display:none"> &mdash; ' + escapeHtml(detail) + '</span>'
    : '';
  return '<span class="error-msg">Erro ao carregar' + detailPart + '</span>';
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
