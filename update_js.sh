#!/bin/bash
cat << 'JS_EOF' >> app.js

window.toggleHomeCalendar = function() {
  const container = document.getElementById('home-calendar-container');
  if (!container) return;
  if (container.style.display === 'none') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
};
JS_EOF
