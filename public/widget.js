(function initInstlWidget() {
  if (typeof window === "undefined" || window.__INSTL_WIDGET_LOADED__) {
    return;
  }

  window.__INSTL_WIDGET_LOADED__ = true;

  var currentScript = document.currentScript;
  if (!currentScript) {
    return;
  }

  var clientId = currentScript.getAttribute("data-client");
  if (!clientId) {
    console.error("INSTL widget missing data-client attribute");
    return;
  }

  var scriptUrl = new URL(currentScript.src, window.location.href);
  var apiBase = scriptUrl.origin;
  var sessionStorageKey = "instl-widget-session:" + clientId;
  var nameStorageKey = "instl-widget-name:" + clientId;
  var sessionId = window.localStorage.getItem(sessionStorageKey);

  if (!sessionId && window.crypto && typeof window.crypto.randomUUID === "function") {
    sessionId = window.crypto.randomUUID();
    window.localStorage.setItem(sessionStorageKey, sessionId);
  }

  if (!sessionId) {
    sessionId = "session-" + Math.random().toString(36).slice(2);
    window.localStorage.setItem(sessionStorageKey, sessionId);
  }

  var visitorName = window.localStorage.getItem(nameStorageKey) || "";
  var lastRenderedSignature = "";
  var pollIntervalId = null;
  var pollIntervalMs = 10000;

  var style = document.createElement("style");
  style.textContent = ""
    + ".instl-widget-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Arial,sans-serif;color:#1d160f}"
    + ".instl-widget-toggle{border:none;border-radius:999px;background:#1d160f;color:#f7f0e3;padding:14px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 14px 32px rgba(0,0,0,.18)}"
    + ".instl-widget-panel{display:none;width:340px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 110px);margin-top:12px;border-radius:20px;overflow:hidden;background:#f7f0e3;box-shadow:0 20px 50px rgba(0,0,0,.22);border:1px solid rgba(29,22,15,.1)}"
    + ".instl-widget-panel[data-open='true']{display:flex;flex-direction:column}"
    + ".instl-widget-header{padding:16px 18px;background:#1d160f;color:#f7f0e3}"
    + ".instl-widget-title{font-size:16px;font-weight:700;margin:0}"
    + ".instl-widget-subtitle{font-size:12px;line-height:1.5;opacity:.8;margin:6px 0 0}"
    + ".instl-widget-body{flex:1;display:flex;flex-direction:column;min-height:0}"
    + ".instl-widget-messages{flex:1;padding:16px;overflow:auto;display:flex;flex-direction:column;gap:10px;background:#fff9ef}"
    + ".instl-widget-message{max-width:85%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}"
    + ".instl-widget-message[data-direction='outbound']{align-self:flex-end;background:#1d160f;color:#f7f0e3;border-bottom-right-radius:4px}"
    + ".instl-widget-message[data-direction='inbound']{align-self:flex-start;background:#efe4cf;color:#1d160f;border-bottom-left-radius:4px}"
    + ".instl-widget-empty{font-size:13px;line-height:1.6;color:#5a4b3f}"
    + ".instl-widget-form{padding:14px;border-top:1px solid rgba(29,22,15,.08);display:flex;flex-direction:column;gap:10px;background:#f7f0e3}"
    + ".instl-widget-field-label{font-size:11px;font-weight:700;color:#5a4b3f;margin:0 0 -4px}"
    + ".instl-widget-name,.instl-widget-input{width:100%;border:1px solid rgba(29,22,15,.15);border-radius:12px;padding:11px 12px;font-size:13px;outline:none;background:#fff}"
    + ".instl-widget-name:focus,.instl-widget-input:focus,.instl-widget-submit:focus,.instl-widget-toggle:focus{box-shadow:0 0 0 3px rgba(199,109,45,.22)}"
    + ".instl-widget-submit{border:none;border-radius:12px;background:#c76d2d;color:#fff;padding:11px 14px;font-size:13px;font-weight:700;cursor:pointer}"
    + ".instl-widget-submit[disabled]{opacity:.65;cursor:wait}"
    + ".instl-widget-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px;color:#7b6a5b}"
    + "@media (max-width: 640px){.instl-widget-root{right:12px;left:12px;bottom:12px}.instl-widget-panel{width:auto;max-width:none;height:min(70vh,520px)}}";
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.className = "instl-widget-root";
  root.innerHTML = ""
    + "<button type='button' class='instl-widget-toggle'>Chat with us</button>"
    + "<div class='instl-widget-panel' data-open='false'>"
    + "  <div class='instl-widget-header'>"
    + "    <p class='instl-widget-title'>Lead Desk</p>"
    + "    <p class='instl-widget-subtitle'>Ask a question and the team can reply here.</p>"
    + "  </div>"
    + "  <div class='instl-widget-body'>"
    + "    <div class='instl-widget-messages'><div class='instl-widget-empty'>Start the conversation. Replies from the inbox will appear here.</div></div>"
    + "    <form class='instl-widget-form'>"
    + "      <label class='instl-widget-field-label' for='instl-widget-name'>Your name (optional)</label>"
    + "      <input id='instl-widget-name' class='instl-widget-name' type='text' maxlength='80' autocomplete='name' />"
    + "      <label class='instl-widget-field-label' for='instl-widget-message'>Message</label>"
    + "      <textarea id='instl-widget-message' class='instl-widget-input' rows='3' maxlength='1000'></textarea>"
    + "      <div class='instl-widget-meta'><span>Powered by INSTL</span><button type='submit' class='instl-widget-submit'>Send</button></div>"
    + "    </form>"
    + "  </div>"
    + "</div>";
  document.body.appendChild(root);

  var toggle = root.querySelector(".instl-widget-toggle");
  var panel = root.querySelector(".instl-widget-panel");
  var nameInput = root.querySelector(".instl-widget-name");
  var messageInput = root.querySelector(".instl-widget-input");
  var messagesEl = root.querySelector(".instl-widget-messages");
  var form = root.querySelector(".instl-widget-form");
  var submit = root.querySelector(".instl-widget-submit");

  nameInput.value = visitorName;

  function setOpen(open) {
    panel.setAttribute("data-open", open ? "true" : "false");
    toggle.textContent = open ? "Close chat" : "Chat with us";
  }

  function shouldPoll() {
    return panel.getAttribute("data-open") === "true" && document.visibilityState !== "hidden";
  }

  function startPolling() {
    if (pollIntervalId !== null) {
      return;
    }

    pollIntervalId = window.setInterval(function() {
      if (shouldPoll()) {
        fetchMessages();
      }
    }, pollIntervalMs);
  }

  function stopPolling() {
    if (pollIntervalId === null) {
      return;
    }

    window.clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  function syncPolling() {
    if (shouldPoll()) {
      fetchMessages();
      startPolling();
    } else {
      stopPolling();
    }
  }

  function renderMessages(messages) {
    var signature = JSON.stringify(messages);
    if (signature === lastRenderedSignature) {
      return;
    }

    lastRenderedSignature = signature;

    if (!messages.length) {
      messagesEl.innerHTML = "<div class='instl-widget-empty'>Start the conversation. Replies from the inbox will appear here.</div>";
      return;
    }

    messagesEl.innerHTML = messages.map(function renderMessage(message) {
      var direction = message.direction === "outbound" ? "inbound" : "outbound";
      return "<div class='instl-widget-message' data-direction='" + direction + "'>" + escapeHtml(message.text) + "</div>";
    }).join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fetchMessages() {
    return window.fetch(
      apiBase + "/api/widget/messages?clientId=" + encodeURIComponent(clientId) + "&sessionId=" + encodeURIComponent(sessionId),
      { method: "GET" }
    )
      .then(function(response) {
        if (!response.ok) {
          return null;
        }
        return response.json();
      })
      .then(function(payload) {
        if (!payload || !payload.ok || !Array.isArray(payload.messages)) {
          return;
        }
        renderMessages(payload.messages);
      })
      .catch(function() {
        return null;
      });
  }

  function submitMessage(event) {
    event.preventDefault();

    var text = messageInput.value.trim();
    visitorName = nameInput.value.trim();

    if (!text) {
      return;
    }

    window.localStorage.setItem(nameStorageKey, visitorName);
    submit.setAttribute("disabled", "disabled");

    window.fetch(apiBase + "/api/webhook/website", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: sessionId,
        client_id: clientId,
        name: visitorName || undefined,
        message: text
      })
    })
      .then(function(response) {
        if (!response.ok) {
          throw new Error("Failed to send");
        }
        messageInput.value = "";
        return fetchMessages();
      })
      .catch(function() {
        window.alert("Message could not be sent. Please try again.");
      })
      .finally(function() {
        submit.removeAttribute("disabled");
      });
  }

  toggle.addEventListener("click", function() {
    var open = panel.getAttribute("data-open") !== "true";
    setOpen(open);
    syncPolling();
  });

  form.addEventListener("submit", submitMessage);
  document.addEventListener("visibilitychange", syncPolling);

  setOpen(false);
})();
