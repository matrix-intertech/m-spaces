(function () {
  function readCookie(name) {
    var prefix = name + '=';
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i += 1) {
      var item = parts[i].trim();
      if (item.indexOf(prefix) === 0) {
        return decodeURIComponent(item.slice(prefix.length));
      }
    }
    return '';
  }

  function getToken() {
    return readCookie('XSRF-TOKEN');
  }

  function isSafeMethod(method) {
    return /^(GET|HEAD|OPTIONS)$/i.test(method || 'GET');
  }

  function isSameOrigin(url) {
    try {
      var parsed = new URL(url || window.location.href, window.location.href);
      return parsed.origin === window.location.origin;
    } catch (_) {
      return true;
    }
  }

  function ensureFormToken(form) {
    if (!form || String(form.method || 'get').toUpperCase() === 'GET') return;
    var token = getToken();
    if (!token) return;

    var existing = form.querySelector('input[name="_csrf"]');
    if (existing) {
      existing.value = token;
      return;
    }

    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = token;
    form.appendChild(input);
  }

  function bindForms() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i += 1) {
      ensureFormToken(forms[i]);
    }

    document.addEventListener('submit', function (event) {
      ensureFormToken(event.target);
    }, true);

    if (window.HTMLFormElement && window.HTMLFormElement.prototype) {
      var nativeSubmit = window.HTMLFormElement.prototype.submit;
      if (!window.HTMLFormElement.prototype.__csrfWrapped) {
        window.HTMLFormElement.prototype.submit = function submitWithCsrf() {
          ensureFormToken(this);
          return nativeSubmit.call(this);
        };
        window.HTMLFormElement.prototype.__csrfWrapped = true;
      }
    }
  }

  if (window.fetch && !window.__matrixCsrfFetchWrapped) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function csrfAwareFetch(input, init) {
      var request = init || {};
      var method = request.method || (input && input.method) || 'GET';
      var url = typeof input === 'string' ? input : (input && input.url) || window.location.href;

      if (!isSafeMethod(method) && isSameOrigin(url)) {
        var headers = new Headers(request.headers || (input && input.headers) || {});
        if (!headers.has('x-csrf-token') && !headers.has('x-xsrf-token')) {
          var token = getToken();
          if (token) headers.set('x-csrf-token', token);
        }
        request.headers = headers;
      }

      return nativeFetch(input, request);
    };
    window.__matrixCsrfFetchWrapped = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindForms);
  } else {
    bindForms();
  }
})();
