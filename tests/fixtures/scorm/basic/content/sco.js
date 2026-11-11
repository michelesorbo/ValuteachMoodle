// Test SCO: finds the API the way real packages do (walking up the parent windows).
(function () {
  function findApi(win) {
    var tries = 0;
    while (win && !win.API && win.parent && win.parent !== win && tries < 10) {
      tries += 1;
      win = win.parent;
    }
    return win ? win.API || null : null;
  }

  var api = findApi(window) || (window.opener ? findApi(window.opener) : null);
  var byId = function (id) {
    return document.getElementById(id);
  };

  if (!api) {
    byId("api").textContent = "non trovata";
    return;
  }

  var initialized = api.LMSInitialize("");
  byId("api").textContent = initialized === "true" ? "trovata" : "errore " + api.LMSGetLastError();
  byId("student").textContent = api.LMSGetValue("cmi.core.student_name");
  byId("status").textContent = api.LMSGetValue("cmi.core.lesson_status");
  byId("entry").textContent = api.LMSGetValue("cmi.core.entry") || "(vuoto)";
  byId("location").textContent = api.LMSGetValue("cmi.core.lesson_location") || "(vuoto)";
  byId("suspend").textContent = api.LMSGetValue("cmi.suspend_data") || "(vuoto)";
  byId("total").textContent = api.LMSGetValue("cmi.core.total_time");

  function finish(label) {
    api.LMSSetValue("cmi.core.session_time", "0000:01:30.00");
    api.LMSCommit("");
    var finished = api.LMSFinish("");
    byId("result").textContent = label + ": LMSFinish=" + finished;
    ["suspend-button", "complete-button", "fail-button"].forEach(function (id) {
      byId(id).disabled = true;
    });
  }

  byId("suspend-button").onclick = function () {
    api.LMSSetValue("cmi.core.lesson_status", "incomplete");
    api.LMSSetValue("cmi.core.lesson_location", "pagina-2");
    api.LMSSetValue("cmi.suspend_data", '{"pagina":2,"risposte":["a","c"]}');
    api.LMSSetValue("cmi.core.exit", "suspend");
    finish("sospeso");
  };

  byId("complete-button").onclick = function () {
    api.LMSSetValue("cmi.core.score.raw", "90");
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    api.LMSSetValue("cmi.core.exit", "");
    finish("completato");
  };

  byId("fail-button").onclick = function () {
    api.LMSSetValue("cmi.core.score.raw", "50");
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    finish("terminato");
  };
})();
